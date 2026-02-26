import { Processor, Process, InjectQueue } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job, Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { DiscordBotService } from '../discord-bot/discord-bot.service';
import { EventCategory, MatchStatus } from '@prisma/client';
import { TeamConfigService, TEAM_COLORS, TEAM_COLOR_HEX, TEAM_GRID_NUMBERS, TEAM_GP_GRID_NUMBERS } from './team-config.service';
import { TeamAssignmentService, PlayerForAssignment } from './team-assignment.service';
import { TracksService } from '../tracks/tracks.service';
import { MatchesService } from './matches.service';

// Team announcement phase duration (2 minutes)
const TEAM_ANNOUNCEMENT_DELAY_MS = 2 * 60 * 1000;

@Processor('matches')
export class MatchesProcessor {
  private readonly logger = new Logger(MatchesProcessor.name);

  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
    private pushNotificationsService: PushNotificationsService,
    private discordBotService: DiscordBotService,
    private teamConfigService: TeamConfigService,
    private teamAssignmentService: TeamAssignmentService,
    private tracksService: TracksService,
    private matchesService: MatchesService,
    @InjectQueue('matches') private matchQueue: Queue,
  ) {}

  @Process('start-match')
  async handleStartMatch(job: Job<{ matchId: number }>) {
    const { matchId } = job.data;
    this.logger.log(`Processing start-match job for match ${matchId}`);

    try {
      // Get match with existing game
      const match = await this.prisma.match.findUnique({
        where: { id: matchId },
        include: {
          participants: {
            include: {
              user: {
                select: { discordId: true, displayName: true },
              },
            },
          },
          games: {
            orderBy: { gameNumber: 'desc' },
            take: 1,
          },
          season: {
            include: {
              event: true,
            },
          },
        },
      });

      if (!match) {
        this.logger.warn(`Match ${matchId} not found`);
        return;
      }

      // Check if match is still in WAITING status
      if (match.status !== MatchStatus.WAITING) {
        this.logger.warn(
          `Match ${matchId} is not in WAITING status (current: ${match.status})`,
        );
        return;
      }

      // Check if minimum players met
      const currentPlayers = match.participants.length;
      if (currentPlayers < match.minPlayers) {
        this.logger.warn(
          `Match ${matchId} does not have enough players (${currentPlayers}/${match.minPlayers})`,
        );

        // Save original matchNumber before clearing it (for Discord announcement)
        const originalMatchNumber = match.matchNumber;

        // Update match status to CANCELLED and clear matchNumber to free it for reuse
        await this.prisma.match.update({
          where: { id: matchId },
          data: {
            status: MatchStatus.CANCELLED,
            matchNumber: null,
          },
        });

        this.logger.log(`Match ${matchId} cancelled due to insufficient players`);

        // Emit WebSocket event to notify clients
        this.eventsGateway.emitMatchCancelled(matchId);

        // Reassign WAITING matchNumbers after cancellation to fill gaps
        await this.matchesService.reassignWaitingMatchNumbers(this.prisma, match.seasonId);

        // Announce cancellation to Discord
        if (originalMatchNumber !== null) {
          try {
            await this.discordBotService.announceMatchCancelled({
              matchNumber: originalMatchNumber,
              seasonNumber: match.season.seasonNumber,
              category: match.season.event.category,
              seasonName: match.season.event.name,
              reason: 'insufficient_players',
            });
          } catch (error) {
            this.logger.error('Failed to announce match cancellation to Discord:', error);
          }
        }

        return;
      }

      // Get existing game (created when match was created)
      const game = match.games[0];
      if (!game) {
        this.logger.error(`No game found for match ${matchId}`);
        return;
      }

      // Generate 4-digit passcode
      const passcode = this.generatePasscode();

      // Check if this is a team mode match
      const isTeamClassic =
        match.season.event.category === EventCategory.TEAM_CLASSIC;
      const isTeamGp =
        match.season.event.category === EventCategory.TEAM_GP;
      const isTeamMode = isTeamClassic || isTeamGp;

      let updatedGame;

      if (isTeamMode) {
        // TEAM_CLASSIC / TEAM_GP: Assign teams and delay passcode reveal
        updatedGame = await this.handleTeamModeStart(
          match,
          game,
          passcode,
          currentPlayers,
          isTeamGp,
        );
        if (!updatedGame) {
          return; // Team assignment failed
        }
      } else {
        // Normal mode: Reveal passcode immediately
        updatedGame = await this.prisma.game.update({
          where: { id: game.id },
          data: {
            passcode,
            passcodePublishedAt: new Date(),
            startedAt: new Date(),
          },
        });
      }

      // Update match status
      await this.prisma.match.update({
        where: { id: matchId },
        data: {
          status: MatchStatus.IN_PROGRESS,
          actualStart: new Date(),
        },
      });

      this.logger.log(
        `Started match ${matchId} with game ${updatedGame.id} and passcode ${passcode}`,
      );

      // Format category for URL (GP -> "gp", CLASSIC -> "classic", TOURNAMENT -> "tournament")
      const categoryStr = match.season.event.category.toLowerCase();
      const seasonNumber = match.season.seasonNumber;
      const matchNumber = match.matchNumber;

      // Guard: matchNumber should never be null for a valid WAITING match
      if (matchNumber === null) {
        this.logger.error(`Match ${matchId} has no matchNumber, cannot start`);
        return;
      }

      // For team modes, hide passcode in the initial event (will be revealed later)
      const emitPasscode = isTeamMode ? '' : updatedGame.passcode;

      // Emit WebSocket event to all clients
      this.eventsGateway.emitMatchStarted({
        matchId: match.id,
        gameId: updatedGame.id,
        passcode: emitPasscode,
        leagueType: updatedGame.leagueType,
        totalPlayers: currentPlayers,
        startedAt: updatedGame.startedAt
          ? updatedGame.startedAt.toISOString()
          : new Date().toISOString(),
        category: categoryStr,
        season: seasonNumber,
        match: matchNumber,
        url: `/matches/${categoryStr}/${seasonNumber}/${matchNumber}`,
      });

      // Send Push notifications to all participants
      try {
        await this.pushNotificationsService.notifyMatchStart({
          id: updatedGame.id,
          passcode: emitPasscode, // Hide passcode for TEAM_CLASSIC
          leagueType: updatedGame.leagueType,
          totalPlayers: currentPlayers,
          url: `/matches/${categoryStr}/${seasonNumber}/${matchNumber}`,
          match: {
            participants: match.participants.map((p) => ({
              userId: p.userId,
            })),
          },
        });
      } catch (error) {
        this.logger.error('Failed to send push notifications:', error);
        // Continue even if push notifications fail
      }

      // Create Discord passcode channel for participants (skip for team modes - done at reveal)
      if (!isTeamMode) {
        try {
          const participantDiscordIds = match.participants
            .map((p) => p.user?.discordId)
            .filter((id): id is string => !!id);

          await this.discordBotService.createPasscodeChannel({
            gameId: updatedGame.id,
            category: categoryStr,
            seasonNumber,
            matchNumber,
            passcode,
            leagueType: updatedGame.leagueType,
            participantDiscordIds,
          });
        } catch (error) {
          this.logger.error('Failed to create Discord channel:', error);
          // Continue even if Discord channel creation fails
        }
      }

      return updatedGame;
    } catch (error) {
      this.logger.error(`Failed to start match ${matchId}:`, error);
      throw error;
    }
  }

  private generatePasscode(): string {
    // Generate random 4-digit number (0000-9999)
    const passcode = Math.floor(Math.random() * 10000);
    return passcode.toString().padStart(4, '0');
  }

  /**
   * Handle TEAM_CLASSIC / TEAM_GP match start:
   * 1. Assign teams using snake draft
   * 2. Create GameParticipants with team assignments
   * 3. Recalculate tracks based on passcode reveal time
   * 4. Schedule passcode reveal after announcement phase
   */
  private async handleTeamModeStart(
    match: any,
    game: any,
    passcode: string,
    currentPlayers: number,
    isTeamGp: boolean = false,
  ) {
    // Validate player count
    const modeLabel = isTeamGp ? 'TEAM_GP' : 'TEAM_CLASSIC';
    const isValid = isTeamGp
      ? this.teamConfigService.isValidTeamGpPlayerCount(currentPlayers)
      : this.teamConfigService.isValidPlayerCount(currentPlayers);

    if (!isValid) {
      const range = isTeamGp ? '30-99' : '12-20';
      this.logger.error(
        `Invalid player count for ${modeLabel}: ${currentPlayers} (need ${range})`,
      );

      // Cancel the match
      const originalMatchNumber = match.matchNumber;
      await this.prisma.match.update({
        where: { id: match.id },
        data: {
          status: MatchStatus.CANCELLED,
          matchNumber: null,
        },
      });

      this.eventsGateway.emitMatchCancelled(match.id);

      // Reassign WAITING matchNumbers after cancellation to fill gaps
      await this.matchesService.reassignWaitingMatchNumbers(this.prisma, match.seasonId);

      if (originalMatchNumber !== null) {
        try {
          await this.discordBotService.announceMatchCancelled({
            matchNumber: originalMatchNumber,
            seasonNumber: match.season.seasonNumber,
            category: match.season.event.category,
            seasonName: match.season.event.name,
            reason: 'invalid_player_count',
          });
        } catch (error) {
          this.logger.error(
            'Failed to announce match cancellation to Discord:',
            error,
          );
        }
      }

      return null;
    }

    // Get ratings for all participants
    const participantRatings = await this.prisma.userSeasonStats.findMany({
      where: {
        seasonId: match.seasonId,
        userId: { in: match.participants.map((p: any) => p.userId) },
      },
      select: {
        userId: true,
        internalRating: true,
      },
    });

    const ratingMap = new Map<number, number>();
    for (const stat of participantRatings) {
      ratingMap.set(stat.userId, stat.internalRating);
    }

    // Build player data for team assignment
    const players: PlayerForAssignment[] = match.participants.map((p: any) => ({
      userId: p.userId,
      rating: ratingMap.get(p.userId) ?? 2750, // Default rating if not found
      joinedAt: p.joinedAt,
    }));

    // Assign teams
    const assignment = isTeamGp
      ? this.teamAssignmentService.assignTeamGpTeams(players)
      : this.teamAssignmentService.assignTeams(players);
    if (!assignment) {
      this.logger.error(`Team assignment failed for match ${match.id}`);
      return null;
    }

    const passcodeRevealTime = new Date(Date.now() + TEAM_ANNOUNCEMENT_DELAY_MS);

    // Recalculate tracks based on passcode reveal time
    // TEAM_GP uses GP tracks (already set at match creation), TEAM_CLASSIC recalculates classic mini tracks
    let tracks: number[] | null = null;
    if (!isTeamGp) {
      tracks = this.tracksService.calculateClassicMiniTracks(passcodeRevealTime);
    }

    // Randomly pick N colors from available grid positions, then sort ascending
    // so that Team A < B < C < D in grid position order
    const teamCount = assignment.teams.length;
    const gridPool = isTeamGp ? TEAM_GP_GRID_NUMBERS : TEAM_GRID_NUMBERS;
    const shuffled = [...gridPool].sort(() => Math.random() - 0.5);
    // teamCount <= 16 is guaranteed by getTeamGpDivisorPairs constraint
    const finalGridNumbers = shuffled.slice(0, teamCount).sort((a, b) => a - b);

    // Store config with color mapping: "4x3|5,1,8" (configString|gridNumbers)
    const teamConfigWithColors = `${assignment.config.configString}|${finalGridNumbers.join(',')}`;

    // Update game and create GameParticipants in transaction
    const updatedGame = await this.prisma.$transaction(async (tx) => {
      // Update game with team config and passcode (not published yet)
      const updated = await tx.game.update({
        where: { id: game.id },
        data: {
          passcode,
          passcodePublishedAt: null, // Will be set when revealed
          startedAt: new Date(),
          teamConfig: teamConfigWithColors,
          passcodeRevealTime,
          // TEAM_GP tracks are already set at match creation; TEAM_CLASSIC recalculates
          ...(tracks && { tracks }),
        },
      });

      // Create GameParticipants with team assignments
      for (let teamIndex = 0; teamIndex < assignment.teams.length; teamIndex++) {
        const teamUserIds = assignment.teams[teamIndex];
        for (const oderId of teamUserIds) {
          await tx.gameParticipant.create({
            data: {
              gameId: game.id,
              userId: oderId,
              machine: '', // Will be set when player submits
              teamIndex,
              isExcluded: false,
            },
          });
        }
      }

      // Create GameParticipants for excluded players
      for (const oderId of assignment.excludedUserIds) {
        await tx.gameParticipant.create({
          data: {
            gameId: game.id,
            userId: oderId,
            machine: '',
            teamIndex: null,
            isExcluded: true,
          },
        });
      }

      return updated;
    });

    // Schedule passcode reveal job
    await this.matchQueue.add(
      'reveal-passcode',
      { gameId: game.id, matchId: match.id },
      {
        delay: TEAM_ANNOUNCEMENT_DELAY_MS,
        removeOnComplete: true,
        removeOnFail: { count: 10 },
        jobId: `reveal-passcode-${game.id}`,
      },
    );

    // Build team data for WebSocket event
    const teamsData = assignment.teams.map((userIds, index) => {
      const teamNumber = finalGridNumbers[index];
      return {
        teamIndex: index,
        teamNumber,
        color: TEAM_COLORS[teamNumber] || 'Unknown',
        colorHex: TEAM_COLOR_HEX[teamNumber] || '#808080',
        userIds,
      };
    });

    // Emit team-assigned event (passcode hidden)
    this.eventsGateway.emitTeamAssigned({
      matchId: match.id,
      gameId: game.id,
      teamConfig: assignment.config.configString,
      teams: teamsData,
      excludedUserIds: assignment.excludedUserIds,
      passcodeRevealTime: passcodeRevealTime.toISOString(),
    });

    this.logger.log(
      `${modeLabel} match ${match.id}: Assigned ${assignment.teams.length} teams (${assignment.config.configString}), ${assignment.excludedUserIds.length} excluded`,
    );

    // Create Discord channel immediately at team assignment
    try {
      const participantDiscordIds = match.participants
        .map((p: any) => p.user?.discordId)
        .filter((id: string | undefined): id is string => !!id);

      const categoryStr = match.season.event.category.toLowerCase();
      const baseUrl = process.env.CORS_ORIGIN || 'https://fz99lounge.com';
      const matchUrl = `${baseUrl}/matches/${categoryStr}/${match.season.seasonNumber}/${match.matchNumber}`;

      // Build userId -> displayName map
      const userNameMap = new Map<number, string>();
      for (const p of match.participants) {
        userNameMap.set(p.userId, p.user?.displayName ?? 'Unknown');
      }

      const teams = teamsData.map((team: any) => ({
        label: String.fromCharCode(65 + (team.teamIndex as number)),
        memberNames: (team.userIds as number[]).map(
          (uid) => userNameMap.get(uid) ?? 'Unknown',
        ),
      }));

      await this.discordBotService.createTeamSetupChannel({
        gameId: game.id,
        category: categoryStr,
        seasonNumber: match.season.seasonNumber,
        matchNumber: match.matchNumber,
        participantDiscordIds,
        matchUrl,
        teams,
      });
    } catch (error) {
      this.logger.error('Failed to create Discord team setup channel:', error);
    }

    return updatedGame;
  }

  @Process('reveal-passcode')
  async handleRevealPasscode(job: Job<{ gameId: number; matchId: number }>) {
    const { gameId, matchId } = job.data;
    this.logger.log(`Processing reveal-passcode job for game ${gameId}`);

    try {
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        include: {
          match: {
            include: {
              participants: {
                include: {
                  user: {
                    select: { discordId: true },
                  },
                },
              },
              season: {
                include: {
                  event: true,
                },
              },
            },
          },
        },
      });

      if (!game) {
        this.logger.warn(`Game ${gameId} not found for passcode reveal`);
        return;
      }

      // Update passcodePublishedAt
      await this.prisma.game.update({
        where: { id: gameId },
        data: {
          passcodePublishedAt: new Date(),
        },
      });

      // Emit passcode-revealed event
      this.eventsGateway.emitPasscodeRevealed({
        matchId,
        gameId,
        passcode: game.passcode,
      });

      // Post passcode to existing Discord channel
      try {
        await this.discordBotService.postPasscodeToChannel(gameId, game.passcode);
      } catch (error) {
        this.logger.error('Failed to post passcode to Discord channel:', error);
      }

      this.logger.log(`Passcode revealed for game ${gameId}`);
    } catch (error) {
      this.logger.error(
        `Failed to reveal passcode for game ${gameId}:`,
        error,
      );
    }
  }

  @Process('delete-discord-channel')
  async handleDeleteDiscordChannel(job: Job<{ gameId: number }>) {
    const { gameId } = job.data;
    this.logger.log(`Processing delete-discord-channel job for game ${gameId}`);

    try {
      await this.discordBotService.deletePasscodeChannel(gameId);
      this.logger.log(`Deleted Discord channel for game ${gameId}`);
    } catch (error) {
      this.logger.error(`Failed to delete Discord channel for game ${gameId}:`, error);
    }
  }

  @Process('reminder-match')
  async handleReminderMatch(job: Job<{ matchId: number }>) {
    const { matchId } = job.data;
    this.logger.log(`Processing reminder-match job for match ${matchId}`);

    try {
      const match = await this.prisma.match.findUnique({
        where: { id: matchId },
        include: {
          season: {
            include: {
              event: true,
            },
          },
        },
      });

      if (!match) {
        this.logger.warn(`Match ${matchId} not found for reminder`);
        return;
      }

      // Only send reminder if match is still in WAITING status
      if (match.status !== MatchStatus.WAITING) {
        this.logger.log(
          `Skipping reminder for match ${matchId} (status: ${match.status})`,
        );
        return;
      }

      // Skip if matchNumber is null (shouldn't happen for WAITING matches)
      if (match.matchNumber === null) {
        this.logger.warn(`Match ${matchId} has no matchNumber, skipping reminder`);
        return;
      }

      await this.discordBotService.announceMatchReminder({
        matchNumber: match.matchNumber,
        seasonNumber: match.season.seasonNumber,
        category: match.season.event.category,
        seasonName: match.season.event.name,
      });

      this.logger.log(`Sent reminder for match ${matchId}`);
    } catch (error) {
      this.logger.error(`Failed to send reminder for match ${matchId}:`, error);
    }
  }
}
