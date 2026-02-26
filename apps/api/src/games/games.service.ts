import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventCategory, MatchStatus, ResultStatus, ScreenshotType } from '@prisma/client';
import { SubmitScoreDto } from './dto/submit-score.dto';
import { UpdateScoreDto } from './dto/update-score.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { ClassicRatingService } from '../rating/classic-rating.service';
import { TeamClassicRatingService } from '../rating/team-classic-rating.service';
import { DiscordBotService } from '../discord-bot/discord-bot.service';
import { TeamAssignmentService } from '../matches/team-assignment.service';

export interface SplitVoteStatus {
  currentVotes: number;
  requiredVotes: number;
  hasVoted: boolean;
  passcode: string;
  passcodeVersion: number;
}

export interface SplitVoteResult {
  regenerated: boolean;
  currentVotes: number;
  requiredVotes: number;
  passcode: string;
  passcodeVersion: number;
}

@Injectable()
export class GamesService {
  private readonly logger = new Logger(GamesService.name);

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    private classicRatingService: ClassicRatingService,
    private teamClassicRatingService: TeamClassicRatingService,
    private teamAssignmentService: TeamAssignmentService,
    private discordBotService: DiscordBotService,
    @InjectQueue('matches') private matchQueue: Queue,
  ) {}

  async getById(gameId: number, userId?: number) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        match: {
          include: {
            season: {
              include: {
                event: true,
                tournamentConfig: true,
              },
            },
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    discordId: true,
                    displayName: true,
                    avatarHash: true,
                  },
                },
              },
            },
          },
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                discordId: true,
                displayName: true,
                avatarHash: true,
                profile: {
                  select: { country: true },
                },
              },
            },
            raceResults: true,
          },
        },
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Check if user is a participant
    const isParticipant = userId
      ? game.match?.participants?.some((p) => p.userId === userId) || false
      : false;

    // Check if user is excluded (TEAM_CLASSIC / TEAM_GP)
    const isExcluded = userId
      ? game.participants.some((p) => p.userId === userId && p.isExcluded)
      : false;

    // Only show passcode to non-excluded participants
    if (!isParticipant || isExcluded) {
      const { passcode, ...gameWithoutPasscode } = game;
      return gameWithoutPasscode;
    }

    return game;
  }

  async getByEventSeasonMatch(
    eventCategory: EventCategory,
    seasonNumber: number,
    matchNumber: number,
    gameNumber: number = 1,
    userId?: number,
  ) {
    // Find game by event category, season number, match number, and sequence
    const game = await this.prisma.game.findFirst({
      where: {
        gameNumber,
        match: {
          matchNumber,
          season: {
            seasonNumber,
            event: {
              category: eventCategory,
            },
          },
        },
      },
      include: {
        match: {
          include: {
            season: {
              include: {
                event: true,
                tournamentConfig: true,
              },
            },
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    discordId: true,
                    displayName: true,
                    avatarHash: true,
                    profile: {
                      select: { country: true },
                    },
                    seasonStats: {
                      where: {
                        season: {
                          seasonNumber,
                          event: {
                            category: eventCategory,
                          },
                        },
                      },
                      select: {
                        displayRating: true,
                      },
                    },
                  },
                },
              },
            },
            ratingHistories: true,
          },
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                discordId: true,
                displayName: true,
                avatarHash: true,
                profile: {
                  select: { country: true },
                },
              },
            },
            raceResults: true,
          },
        },
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Build rating map from rating histories
    const ratingMap = new Map<number, { displayRating: number }>();
    if (game.match?.ratingHistories) {
      for (const rh of game.match.ratingHistories) {
        ratingMap.set(rh.userId, { displayRating: rh.displayRating });
      }
    }

    // Get previous ratings for each user to calculate change
    // Important: Filter by the SAME season to avoid cross-season rating comparison
    const userIds = game.participants.map(p => p.userId);
    const seasonId = game.match?.seasonId;
    const previousRatings = await this.prisma.ratingHistory.findMany({
      where: {
        userId: { in: userIds },
        matchId: { lt: game.matchId },
        match: { seasonId }, // Only consider matches in the same season
      },
      orderBy: { createdAt: 'desc' },
      distinct: ['userId'],
    });
    const previousRatingMap = new Map<number, number>();
    for (const pr of previousRatings) {
      previousRatingMap.set(pr.userId, pr.displayRating);
    }

    // Add rating info to participants
    const participantsWithRating = game.participants.map(p => {
      const currentRating = ratingMap.get(p.userId);
      const previousRating = previousRatingMap.get(p.userId) ?? 0; // 0 if first match
      const ratingAfter = currentRating?.displayRating ?? null;
      const ratingChange = ratingAfter !== null ? ratingAfter - previousRating : null;

      return {
        ...p,
        ratingAfter,
        ratingChange,
      };
    });

    // Replace participants with enhanced version
    const gameWithRatings = {
      ...game,
      participants: participantsWithRating,
    };

    // Check if user is a participant
    const isParticipant = userId
      ? game.match?.participants?.some((p) => p.userId === userId) || false
      : false;

    // Check if user is excluded (TEAM_CLASSIC / TEAM_GP)
    const isExcluded = userId
      ? game.participants.some((p) => p.userId === userId && p.isExcluded)
      : false;

    // Only show passcode to non-excluded participants
    if (!isParticipant || isExcluded) {
      const { passcode, ...gameWithoutPasscode } = gameWithRatings;
      return gameWithoutPasscode;
    }

    return gameWithRatings;
  }

  /**
   * Submit score for a game
   * TODO: Refactor for new RaceResult-based schema
   * Current implementation creates GameParticipant with basic info,
   * RaceResult submission needs to be implemented separately
   */
  async submitScore(gameId: number, userId: number, submitScoreDto: SubmitScoreDto) {
    // Find the game and verify it's in progress
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        match: {
          include: {
            participants: true,
            season: {
              include: { event: true },
            },
          },
        },
        participants: {
          where: { userId },
        },
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    const eventCategory = game.match.season.event.category;
    const isGpMode = eventCategory === EventCategory.GP || eventCategory === EventCategory.TEAM_GP;

    // Check match status - allow score submission during IN_PROGRESS
    if (game.match.status !== MatchStatus.IN_PROGRESS) {
      throw new BadRequestException('Cannot submit score - match is not in progress');
    }

    // Check user is a match participant
    const isMatchParticipant = game.match.participants.some(
      (p) => p.userId === userId,
    );
    if (!isMatchParticipant) {
      throw new BadRequestException('User is not a participant in this match');
    }

    // Block excluded players from submitting scores (TEAM_CLASSIC / TEAM_GP)
    if (game.participants.length && game.participants[0].isExcluded) {
      throw new BadRequestException('Excluded players cannot submit scores');
    }

    const now = new Date();
    let participantId: number;

    // Check if user is a participant
    if (!game.participants.length) {
      // User is not a participant yet, add them
      const participant = await this.prisma.gameParticipant.create({
        data: {
          gameId,
          userId,
          machine: submitScoreDto.machine,
          assistEnabled: submitScoreDto.assistEnabled,
          status: ResultStatus.PENDING,
          submittedAt: now,
        },
      });
      participantId = participant.id;
    } else {
      // Update existing participant's status
      await this.prisma.gameParticipant.update({
        where: {
          id: game.participants[0].id,
        },
        data: {
          machine: submitScoreDto.machine,
          assistEnabled: submitScoreDto.assistEnabled,
          status: ResultStatus.PENDING,
          submittedAt: now,
          // Clear rejection metadata on resubmit
          rejectedBy: null,
          rejectedAt: null,
        },
      });
      participantId = game.participants[0].id;
    }

    // Handle race results for CLASSIC/GP mode
    if (submitScoreDto.raceResults && submitScoreDto.raceResults.length > 0) {
      const maxRaces = isGpMode ? 5 : 3;

      // Per-race max positions and elimination thresholds
      const raceMaxPositions = isGpMode ? [99, 80, 60, 40, 20] : [20, 16, 12];
      const eliminationThresholds: (number | null)[] = isGpMode
        ? [81, 61, 41, 21, null]
        : [17, 13, 9];

      // Generic race validation: validate each race sequentially
      const races = Array.from({ length: maxRaces }, (_, i) =>
        submitScoreDto.raceResults!.find(r => r.raceNumber === i + 1),
      );

      let eliminated = false;
      for (let i = 0; i < maxRaces; i++) {
        const race = races[i];
        if (eliminated) break; // Subsequent races after elimination don't need validation

        const raceMaxPosition = raceMaxPositions[i];

        if (!race?.isDisconnected) {
          // Check if all previous races are not eliminated/dc
          const prevEliminated = races.slice(0, i).some(r => r?.isEliminated || r?.isDisconnected);
          if (!prevEliminated) {
            if (!race || race.position === undefined || race.position === null) {
              throw new BadRequestException(`Race ${i + 1} position is required`);
            }
            if (race.position < 1 || race.position > raceMaxPosition) {
              throw new BadRequestException(`Race ${i + 1} position must be between 1 and ${raceMaxPosition}`);
            }
          }
        }

        // Auto-enforce elimination based on position threshold
        if (race && race.position && eliminationThresholds[i] !== null) {
          if (race.position >= eliminationThresholds[i]!) {
            race.isEliminated = true;
          }
        }

        if (race?.isEliminated || race?.isDisconnected) {
          eliminated = true;
        }
      }

      // Delete existing race results for this participant
      await this.prisma.raceResult.deleteMany({
        where: { gameParticipantId: participantId },
      });

      let totalScore = 0;
      let eliminatedAtRace: number | null = null;
      const raceResultsData: {
        gameParticipantId: number;
        raceNumber: number;
        position: number | null;
        points: number;
        isEliminated: boolean;
        isDisconnected: boolean;
      }[] = [];

      // Calculate race results data
      for (const raceResult of submitScoreDto.raceResults) {
        // 既にDNF/DCしている場合、以降のレースはnull（参加していない）
        const isAfterElimination = eliminatedAtRace !== null;

        // ポイント計算
        let points = 0;
        let position: number | null = null;
        let isEliminated = false;
        let isDisconnected = false;

        if (isAfterElimination) {
          // DNF/DC後のレースは参加していない扱い
          points = 0;
          position = null;
          isEliminated = false;
          isDisconnected = false;
        } else if (raceResult.isDisconnected) {
          // Disconnected: 0点、順位なし
          points = 0;
          position = null;
          isEliminated = false;
          isDisconnected = true;
          eliminatedAtRace = raceResult.raceNumber;
        } else if (raceResult.position) {
          // 順位がある場合 - GP uses different points formula
          points = isGpMode
            ? this.calculateGpRacePoints(raceResult.position)
            : this.calculateRacePoints(raceResult.position);
          position = raceResult.position;
          isEliminated = raceResult.isEliminated ?? false;
          isDisconnected = false;
          if (isEliminated) {
            eliminatedAtRace = raceResult.raceNumber;
          }
        }

        raceResultsData.push({
          gameParticipantId: participantId,
          raceNumber: raceResult.raceNumber,
          position,
          points,
          isEliminated,
          isDisconnected,
        });

        totalScore += points;
      }

      // Batch insert all race results
      await this.prisma.raceResult.createMany({ data: raceResultsData });

      // Update participant with calculated totals
      await this.prisma.gameParticipant.update({
        where: { id: participantId },
        data: {
          totalScore,
          eliminatedAtRace,
        },
      });
    }

    // Get the updated participant
    const updatedParticipant = await this.prisma.gameParticipant.findUnique({
      where: { id: participantId },
      include: {
        user: {
          select: {
            id: true,
            discordId: true,
            displayName: true,
            avatarHash: true,
            profile: {
              select: { country: true },
            },
          },
        },
        raceResults: true,
      },
    });

    // Emit event for real-time update
    this.eventEmitter.emit('game.scoreUpdated', {
      gameId,
      participant: updatedParticipant,
    });

    return updatedParticipant;
  }

  async submitScoreByEventSeasonMatch(
    eventCategory: EventCategory,
    seasonNumber: number,
    matchNumber: number,
    userId: number,
    submitScoreDto: SubmitScoreDto,
    gameNumber: number = 1,
  ) {
    // Find game by event category, season number, match number, and sequence
    const game = await this.prisma.game.findFirst({
      where: {
        gameNumber,
        match: {
          matchNumber,
          season: {
            seasonNumber,
            event: {
              category: eventCategory,
            },
          },
        },
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    return this.submitScore(game.id, userId, submitScoreDto);
  }

  /**
   * Update score for existing participant (moderator action)
   * Only updates race results, not machine/assist settings
   */
  async updateScoreByEventSeasonMatch(
    eventCategory: EventCategory,
    seasonNumber: number,
    matchNumber: number,
    userId: number,
    updateScoreDto: UpdateScoreDto,
    gameNumber: number = 1,
  ) {
    // Find game by event category, season number, match number, and sequence
    const game = await this.prisma.game.findFirst({
      where: {
        gameNumber,
        match: {
          matchNumber,
          season: {
            seasonNumber,
            event: {
              category: eventCategory,
            },
          },
        },
      },
      include: {
        match: true,
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Find existing participant
    const participant = await this.prisma.gameParticipant.findFirst({
      where: {
        gameId: game.id,
        userId,
      },
    });

    if (!participant) {
      throw new NotFoundException('Participant not found in this game');
    }

    const isGpMode = eventCategory === EventCategory.GP || eventCategory === EventCategory.TEAM_GP;
    const maxRaces = isGpMode ? 5 : 3;

    // Per-race max positions and elimination thresholds
    const raceMaxPositions = isGpMode ? [99, 80, 60, 40, 20] : [20, 16, 12];
    const eliminationThresholds: (number | null)[] = isGpMode
      ? [81, 61, 41, 21, null]
      : [17, 13, 9];

    // Generic race validation: validate each race sequentially
    const races = Array.from({ length: maxRaces }, (_, i) =>
      updateScoreDto.raceResults.find(r => r.raceNumber === i + 1),
    );

    let eliminatedCheck = false;
    for (let i = 0; i < maxRaces; i++) {
      const race = races[i];
      if (eliminatedCheck) break;

      const raceMaxPosition = raceMaxPositions[i];

      if (!race?.isDisconnected) {
        const prevEliminated = races.slice(0, i).some(r => r?.isEliminated || r?.isDisconnected);
        if (!prevEliminated) {
          if (!race || race.position === undefined || race.position === null) {
            throw new BadRequestException(`Race ${i + 1} position is required`);
          }
          if (race.position < 1 || race.position > raceMaxPosition) {
            throw new BadRequestException(`Race ${i + 1} position must be between 1 and ${raceMaxPosition}`);
          }
        }
      }

      // Auto-enforce elimination based on position threshold
      if (race && race.position && eliminationThresholds[i] !== null) {
        if (race.position >= eliminationThresholds[i]!) {
          race.isEliminated = true;
        }
      }

      if (race?.isEliminated || race?.isDisconnected) {
        eliminatedCheck = true;
      }
    }

    // Delete existing race results
    await this.prisma.raceResult.deleteMany({
      where: { gameParticipantId: participant.id },
    });

    let totalScore = 0;
    let eliminatedAtRace: number | null = null;
    const raceResultsData: {
      gameParticipantId: number;
      raceNumber: number;
      position: number | null;
      points: number;
      isEliminated: boolean;
      isDisconnected: boolean;
    }[] = [];

    // Calculate race results data
    for (const raceResult of updateScoreDto.raceResults) {
      // 既にDNF/DCしている場合、以降のレースはnull（参加していない）
      const isAfterElimination = eliminatedAtRace !== null;

      // ポイント計算
      let points = 0;
      let position: number | null = null;
      let isEliminated = false;
      let isDisconnected = false;

      if (isAfterElimination) {
        // DNF/DC後のレースは参加していない扱い
        points = 0;
        position = null;
        isEliminated = false;
        isDisconnected = false;
      } else if (raceResult.isDisconnected) {
        // Disconnected: 0点、順位なし
        points = 0;
        position = null;
        isEliminated = false;
        isDisconnected = true;
        eliminatedAtRace = raceResult.raceNumber;
      } else if (raceResult.position) {
        // 順位がある場合 - GP uses different points formula
        points = isGpMode
          ? this.calculateGpRacePoints(raceResult.position)
          : this.calculateRacePoints(raceResult.position);
        position = raceResult.position;
        isEliminated = raceResult.isEliminated ?? false;
        isDisconnected = false;
        if (isEliminated) {
          eliminatedAtRace = raceResult.raceNumber;
        }
      }

      raceResultsData.push({
        gameParticipantId: participant.id,
        raceNumber: raceResult.raceNumber,
        position,
        points,
        isEliminated,
        isDisconnected,
      });

      totalScore += points;
    }

    // Batch insert all race results
    await this.prisma.raceResult.createMany({ data: raceResultsData });

    // Update participant with calculated totals
    await this.prisma.gameParticipant.update({
      where: { id: participant.id },
      data: {
        totalScore,
        eliminatedAtRace,
        status: ResultStatus.PENDING,
        submittedAt: new Date(),
        // Clear rejection metadata on resubmit
        rejectedBy: null,
        rejectedAt: null,
      },
    });

    // Get the updated participant
    const updatedParticipant = await this.prisma.gameParticipant.findUnique({
      where: { id: participant.id },
      include: {
        user: {
          select: {
            id: true,
            discordId: true,
            displayName: true,
            avatarHash: true,
            profile: {
              select: { country: true },
            },
          },
        },
        raceResults: true,
      },
    });

    // Emit event for real-time update
    this.eventEmitter.emit('game.scoreUpdated', {
      gameId: game.id,
      participant: updatedParticipant,
    });

    return updatedParticipant;
  }

  /**
   * Calculate points from position (CLASSIC mode)
   * 1st = 100pts, 2nd = 95pts, 3rd = 90pts... (5pt decrements)
   * 20th = 5pts, eliminated = 0pts
   */
  private calculateRacePoints(position: number): number {
    if (position < 1 || position > 20) return 0;
    return 105 - (position * 5); // 1st=100, 2nd=95, 3rd=90...
  }

  /**
   * Calculate points from position (GP mode)
   * 1st=200, 2nd=196, 3rd=194, 4th=192, ..., 99th=2
   * Formula: pos=1 → 200, pos>=2 → 200 - position * 2
   */
  private calculateGpRacePoints(position: number): number {
    if (position < 1 || position > 99) return 0;
    if (position === 1) return 200;
    return 200 - position * 2; // 2nd=196, 3rd=194, ..., 99th=2
  }

  /**
   * Finalize a match - calculate ratings and mark as FINALIZED
   * Can be called from IN_PROGRESS or COMPLETED status
   * Only MODERATOR/ADMIN can call this
   */
  async endMatch(
    eventCategory: EventCategory,
    seasonNumber: number,
    matchNumber: number,
    gameNumber: number = 1,
  ) {
    // Find the game
    const game = await this.prisma.game.findFirst({
      where: {
        gameNumber,
        match: {
          matchNumber,
          season: {
            seasonNumber,
            event: {
              category: eventCategory,
            },
          },
        },
      },
      include: {
        match: {
          include: {
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
      throw new NotFoundException('Game not found');
    }

    // Check if match is in a state that can be finalized
    if (game.match.status !== MatchStatus.IN_PROGRESS && game.match.status !== MatchStatus.COMPLETED) {
      throw new BadRequestException(
        `Cannot finalize match - current status is ${game.match.status}`,
      );
    }

    // Calculate ratings based on event category
    if (eventCategory === EventCategory.TEAM_CLASSIC || eventCategory === EventCategory.TEAM_GP) {
      // For TEAM_CLASSIC / TEAM_GP: Calculate team scores first, then ratings
      await this.calculateAndSaveTeamScores(game.id);
      await this.teamClassicRatingService.calculateAndUpdateRatings(game.id);
    } else if (eventCategory === EventCategory.GP) {
      // For GP: Use same classic rating algorithm (stored in DB, not displayed on frontend)
      await this.classicRatingService.calculateAndUpdateRatings(game.id);
    } else {
      // For CLASSIC: Use standard rating calculation
      await this.classicRatingService.calculateAndUpdateRatings(game.id);
    }

    // Update match status to FINALIZED
    await this.prisma.match.update({
      where: { id: game.matchId },
      data: {
        status: MatchStatus.FINALIZED,
      },
    });

    // Emit event for real-time status update
    this.eventEmitter.emit('game.finalized', {
      gameId: game.id,
      matchId: game.matchId,
      finalizedAt: new Date(),
    });

    // Announce match results to Discord
    await this.announceMatchResultsToDiscord(game.id);

    // Post match results to match channel
    await this.postMatchResultsToChannel(game.id);

    // Schedule Discord channel deletion after 24 hours
    try {
      await this.matchQueue.add(
        'delete-discord-channel',
        { gameId: game.id },
        { delay: 24 * 60 * 60 * 1000 }, // 24 hours
      );
    } catch (error) {
      this.logger.error('Failed to schedule Discord channel deletion:', error);
    }

    return {
      success: true,
      message: `Match finalized and ratings calculated for game ${game.id}`,
      gameId: game.id,
      matchId: game.matchId,
    };
  }

  /**
   * Update tracks for a CLASSIC game
   * Only MODERATOR/ADMIN can call this
   */
  async updateTracks(
    eventCategory: EventCategory,
    seasonNumber: number,
    matchNumber: number,
    tracks: (number | null)[],
    gameNumber: number = 1,
  ) {
    // Validate tracks
    if (!Array.isArray(tracks)) {
      throw new BadRequestException('Tracks must be an array');
    }

    // Filter out nulls for validation
    const nonNullTracks = tracks.filter((t): t is number => t !== null);

    // Validate track IDs exist in database
    if (nonNullTracks.length > 0) {
      const validTracks = await this.prisma.track.findMany({
        where: { id: { in: nonNullTracks } },
        select: { id: true },
      });
      const validTrackIds = new Set(validTracks.map((t) => t.id));
      for (const trackId of nonNullTracks) {
        if (!validTrackIds.has(trackId)) {
          throw new BadRequestException(`Invalid track ID: ${trackId}`);
        }
      }
    }

    // Check for duplicates (excluding nulls)
    const uniqueTracks = new Set(nonNullTracks);
    if (uniqueTracks.size !== nonNullTracks.length) {
      throw new BadRequestException('Duplicate tracks are not allowed');
    }

    // Find the game
    const game = await this.prisma.game.findFirst({
      where: {
        gameNumber,
        match: {
          matchNumber,
          season: {
            seasonNumber,
            event: {
              category: eventCategory,
            },
          },
        },
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Update tracks
    const updatedGame = await this.prisma.game.update({
      where: { id: game.id },
      data: {
        tracks,
      },
    });

    return {
      success: true,
      gameId: updatedGame.id,
      tracks: updatedGame.tracks,
    };
  }

  /**
   * Announce match results to Discord
   * Retrieves top 3 participants (handling ties) and sends notification
   */
  private async announceMatchResultsToDiscord(gameId: number): Promise<void> {
    try {
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        include: {
          match: {
            include: {
              season: {
                include: {
                  event: true,
                },
              },
            },
          },
          participants: {
            where: {
              status: ResultStatus.VERIFIED,
            },
            include: {
              user: {
                select: {
                  displayName: true,
                },
              },
            },
            orderBy: {
              totalScore: 'desc',
            },
          },
        },
      });

      if (!game || game.participants.length === 0) {
        this.logger.debug(`No verified participants for game ${gameId}, skipping results announcement`);
        return;
      }

      // Calculate positions with ties
      const participantsWithPositions: Array<{
        position: number;
        displayName: string;
        totalScore: number;
      }> = [];

      let currentPosition = 1;
      let previousScore: number | null = null;

      for (const participant of game.participants) {
        // If score is different from previous, update position
        if (previousScore !== null && participant.totalScore !== previousScore) {
          currentPosition = participantsWithPositions.length + 1;
        }

        participantsWithPositions.push({
          position: currentPosition,
          displayName: participant.user.displayName ?? 'Unknown',
          totalScore: participant.totalScore ?? 0,
        });

        previousScore = participant.totalScore;
      }

      // Filter to top 3 positions (may include ties)
      const topParticipants = participantsWithPositions.filter((p) => p.position <= 3);

      if (topParticipants.length === 0) {
        this.logger.debug(`No top participants for game ${gameId}`);
        return;
      }

      const category = game.match.season?.event?.category || 'CLASSIC';
      const seasonNumber = game.match.season?.seasonNumber ?? 1;
      const seasonName = game.match.season?.event?.name || category;

      // Skip if matchNumber is null (cancelled matches)
      if (game.match.matchNumber === null) {
        this.logger.warn(`Game ${gameId} has no matchNumber, skipping announcement`);
        return;
      }

      // Extract top 3 teams data for TEAM_CLASSIC
      const topTeams = this.extractTopTeamsData(category, game);

      await this.discordBotService.announceMatchResults({
        matchNumber: game.match.matchNumber,
        seasonNumber,
        category: category.toLowerCase(),
        seasonName,
        topParticipants,
        topTeams,
      });

      this.logger.log(`Announced match results for game ${gameId}`);
    } catch (error) {
      this.logger.error(`Failed to announce match results for game ${gameId}:`, error);
      // Continue even if Discord fails
    }
  }

  /**
   * Post match results embed to the match Discord channel
   * Shows all participants with medals for top 3, numbers for rest
   */
  private async postMatchResultsToChannel(gameId: number): Promise<void> {
    try {
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        include: {
          match: {
            include: {
              season: {
                include: {
                  event: true,
                },
              },
            },
          },
          participants: {
            where: {
              status: ResultStatus.VERIFIED,
            },
            include: {
              user: {
                select: {
                  displayName: true,
                },
              },
            },
            orderBy: {
              totalScore: 'desc',
            },
          },
        },
      });

      if (!game || game.participants.length === 0) {
        this.logger.debug(`No verified participants for game ${gameId}, skipping channel results`);
        return;
      }

      // Calculate positions with ties
      const participantsWithPositions: Array<{
        position: number;
        displayName: string;
        totalScore: number;
      }> = [];

      let currentPosition = 1;
      let previousScore: number | null = null;

      for (const participant of game.participants) {
        if (previousScore !== null && participant.totalScore !== previousScore) {
          currentPosition = participantsWithPositions.length + 1;
        }

        participantsWithPositions.push({
          position: currentPosition,
          displayName: participant.user.displayName ?? 'Unknown',
          totalScore: participant.totalScore ?? 0,
        });

        previousScore = participant.totalScore;
      }

      // Extract all teams data for TEAM_CLASSIC
      const category = game.match?.season?.event?.category || 'CLASSIC';
      const allTeams = this.extractAllTeamsData(category, game);

      await this.discordBotService.postMatchResultsToChannel({
        gameId,
        participants: participantsWithPositions,
        allTeams,
      });

      this.logger.log(`Posted match results to channel for game ${gameId}`);
    } catch (error) {
      this.logger.error(`Failed to post match results to channel for game ${gameId}:`, error);
    }
  }

  /**
   * Extract top 3 teams data from a game for Discord announcements
   */
  private extractTopTeamsData(
    category: string,
    game: {
      teamScores: unknown;
      participants: Array<{
        teamIndex: number | null;
        user: { displayName: string | null };
      }>;
    },
  ): { teamLabel: string; score: number; rank: number; members: string[] }[] | undefined {
    if ((category !== 'TEAM_CLASSIC' && category !== 'TEAM_GP') || !game.teamScores) {
      return undefined;
    }

    const teamScores = game.teamScores as {
      teamIndex: number;
      score: number;
      rank: number;
    }[];

    return teamScores
      .filter((t) => t.rank <= 3)
      .sort((a, b) => a.rank - b.rank)
      .map((team) => ({
        teamLabel: String.fromCharCode(65 + team.teamIndex),
        score: team.score,
        rank: team.rank,
        members: game.participants
          .filter((p) => p.teamIndex === team.teamIndex)
          .map((p) => p.user.displayName ?? 'Unknown'),
      }));
  }

  /**
   * Extract all teams data from a game for Discord channel results
   */
  private extractAllTeamsData(
    category: string,
    game: {
      teamScores: unknown;
      participants: Array<{
        teamIndex: number | null;
        user: { displayName: string | null };
      }>;
    },
  ): Array<{ label: string; score: number; rank: number; members: string[] }> | undefined {
    if ((category !== 'TEAM_CLASSIC' && category !== 'TEAM_GP') || !game.teamScores) {
      return undefined;
    }

    const teamScores = game.teamScores as {
      teamIndex: number;
      score: number;
      rank: number;
    }[];

    return teamScores
      .sort((a, b) => a.rank - b.rank)
      .map((t) => {
        const label = String.fromCharCode(65 + t.teamIndex);
        const members = game.participants
          .filter((p) => p.teamIndex === t.teamIndex)
          .map((p) => p.user.displayName ?? 'Unknown');

        return {
          label,
          score: t.score,
          rank: t.rank,
          members,
        };
      });
  }

  // ========================================
  // Split Vote Methods
  // ========================================

  /**
   * Get current split vote status for a game
   */
  async getSplitVoteStatus(gameId: number, userId: number): Promise<SplitVoteStatus> {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        match: {
          include: {
            participants: true,
          },
        },
        splitVotes: {
          where: {
            passcodeVersion: undefined, // Will be set dynamically below
          },
        },
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Re-fetch split votes for current passcode version
    const splitVotes = await this.prisma.splitVote.findMany({
      where: {
        gameId,
        passcodeVersion: game.passcodeVersion,
      },
    });

    const totalParticipants = game.match.participants.length;
    const requiredVotes = Math.ceil(totalParticipants / 3);
    const currentVotes = splitVotes.length;
    const hasVoted = splitVotes.some((v) => v.userId === userId);

    return {
      currentVotes,
      requiredVotes,
      hasVoted,
      passcode: game.passcode,
      passcodeVersion: game.passcodeVersion,
    };
  }

  /**
   * Cast a split vote
   */
  async castSplitVote(gameId: number, userId: number): Promise<SplitVoteResult> {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        match: {
          include: {
            participants: true,
          },
        },
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Check if match is IN_PROGRESS
    if (game.match.status !== MatchStatus.IN_PROGRESS) {
      throw new BadRequestException('Can only vote during an in-progress match');
    }

    // Check if user is a participant
    const isParticipant = game.match.participants.some((p) => p.userId === userId);
    if (!isParticipant) {
      throw new ForbiddenException('Only participants can vote');
    }

    // Check if user already voted for this passcode version
    const existingVote = await this.prisma.splitVote.findUnique({
      where: {
        gameId_userId_passcodeVersion: {
          gameId,
          userId,
          passcodeVersion: game.passcodeVersion,
        },
      },
    });

    if (existingVote) {
      throw new BadRequestException('Already voted for this passcode version');
    }

    // Create the vote
    await this.prisma.splitVote.create({
      data: {
        gameId,
        userId,
        passcodeVersion: game.passcodeVersion,
      },
    });

    // Count current votes
    const voteCount = await this.prisma.splitVote.count({
      where: {
        gameId,
        passcodeVersion: game.passcodeVersion,
      },
    });

    const totalParticipants = game.match.participants.length;
    const requiredVotes = Math.ceil(totalParticipants / 3);

    // Emit vote update event
    this.eventEmitter.emit('game.splitVoteUpdated', {
      gameId,
      currentVotes: voteCount,
      requiredVotes,
      votedBy: userId,
    });

    // Check if threshold reached
    if (voteCount >= requiredVotes) {
      return this.regeneratePasscode(gameId);
    }

    return {
      regenerated: false,
      currentVotes: voteCount,
      requiredVotes,
      passcode: game.passcode,
      passcodeVersion: game.passcodeVersion,
    };
  }

  /**
   * Regenerate passcode (called when vote threshold reached or by moderator)
   */
  async regeneratePasscode(gameId: number): Promise<SplitVoteResult> {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        match: {
          include: {
            participants: true,
          },
        },
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Check if match is IN_PROGRESS
    if (game.match.status !== MatchStatus.IN_PROGRESS) {
      throw new BadRequestException('Can only regenerate passcode during an in-progress match');
    }

    // Generate new passcode
    const newPasscode = this.generatePasscode();
    const newVersion = game.passcodeVersion + 1;

    // Update game
    await this.prisma.game.update({
      where: { id: gameId },
      data: {
        passcode: newPasscode,
        passcodeVersion: newVersion,
        passcodePublishedAt: new Date(),
      },
    });

    const totalParticipants = game.match.participants.length;
    const requiredVotes = Math.ceil(totalParticipants / 3);

    // Emit passcode regenerated event
    this.eventEmitter.emit('game.passcodeRegenerated', {
      gameId,
      passcode: newPasscode,
      passcodeVersion: newVersion,
      requiredVotes,
    });

    // Post new passcode to Discord channel
    try {
      await this.discordBotService.postNewPasscode({
        gameId,
        passcode: newPasscode,
        passcodeVersion: newVersion,
      });
    } catch (error) {
      this.logger.error('Failed to post new passcode to Discord:', error);
      // Continue even if Discord fails
    }

    return {
      regenerated: true,
      currentVotes: 0,
      requiredVotes,
      passcode: newPasscode,
      passcodeVersion: newVersion,
    };
  }

  /**
   * Force regenerate passcode (moderator only)
   * Permission check is done in controller
   */
  async forceRegeneratePasscode(gameId: number): Promise<SplitVoteResult> {
    return this.regeneratePasscode(gameId);
  }

  /**
   * Generate a random 4-digit passcode
   */
  private generatePasscode(): string {
    const passcode = Math.floor(Math.random() * 10000);
    return passcode.toString().padStart(4, '0');
  }

  /**
   * Verify a participant's score (moderator action)
   */
  async verifyParticipantScore(
    gameId: number,
    targetUserId: number,
    moderatorId: number,
  ) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        match: {
          include: {
            season: {
              include: { event: true },
            },
          },
        },
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    const participant = await this.prisma.gameParticipant.findFirst({
      where: { gameId, userId: targetUserId },
      include: { raceResults: true },
    });

    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    // Check all non-excluded participants have submitted
    const allParticipants = await this.prisma.gameParticipant.findMany({
      where: { gameId },
      include: { raceResults: true },
    });
    const hasUnsubmitted = allParticipants.some(
      (p) => !p.isExcluded && p.status === ResultStatus.UNSUBMITTED,
    );
    if (hasUnsubmitted) {
      throw new BadRequestException(
        'Cannot verify: not all participants have submitted their scores',
      );
    }

    // Allow verification of PENDING or REJECTED scores (after screenshot resubmission)
    if (participant.status !== ResultStatus.PENDING && participant.status !== ResultStatus.REJECTED) {
      // Already verified or in other state
      if (participant.status === ResultStatus.VERIFIED) {
        return participant;
      }
      throw new BadRequestException('Can only verify pending or rejected scores');
    }

    // Check for position conflicts in CLASSIC modes
    const eventCategory = game.match.season?.event?.category;
    if (
      eventCategory === EventCategory.CLASSIC ||
      eventCategory === EventCategory.TEAM_CLASSIC
    ) {
      // Reuse allParticipants, excluding excluded players
      const allSubmitted = allParticipants.filter((p) => !p.isExcluded);

      for (let raceNumber = 1; raceNumber <= 3; raceNumber++) {
        const positionCounts = new Map<number, number[]>();
        for (const p of allSubmitted) {
          const rr = p.raceResults.find((r) => r.raceNumber === raceNumber);
          if (!rr || rr.isDisconnected || rr.position === null) continue;
          const userIds = positionCounts.get(rr.position) || [];
          userIds.push(p.userId);
          positionCounts.set(rr.position, userIds);
        }

        // Find invalid positions due to ties
        const invalidPositions = new Set<number>();
        for (const [position, userIds] of positionCounts.entries()) {
          if (userIds.length > 1) {
            for (let i = 1; i < userIds.length; i++) {
              const invalidPos = position + i;
              if (invalidPos <= 20) invalidPositions.add(invalidPos);
            }
          }
        }

        // Check if target user is involved in a conflict
        for (const invalidPos of invalidPositions) {
          const usersAtInvalid = positionCounts.get(invalidPos);
          if (!usersAtInvalid) continue;
          // Target user claimed an invalid position
          if (usersAtInvalid.includes(targetUserId)) {
            throw new BadRequestException(
              `Cannot verify: position conflict in Race ${raceNumber}`,
            );
          }
          // Target user is part of the tie that causes the conflict
          const targetRr = participant.raceResults.find(
            (r) => r.raceNumber === raceNumber,
          );
          if (targetRr?.position !== null && !targetRr?.isDisconnected) {
            const tiedUsers = positionCounts.get(targetRr!.position!);
            if (tiedUsers && tiedUsers.length > 1 && tiedUsers.includes(targetUserId)) {
              // Check if this tie causes the invalid position
              const pos = targetRr!.position!;
              for (let i = 1; i < tiedUsers.length; i++) {
                if (pos + i === invalidPos) {
                  throw new BadRequestException(
                    `Cannot verify: position conflict in Race ${raceNumber}`,
                  );
                }
              }
            }
          }
        }
      }
    }

    const updated = await this.prisma.gameParticipant.update({
      where: { id: participant.id },
      data: {
        status: ResultStatus.VERIFIED,
        verifiedBy: moderatorId,
        verifiedAt: new Date(),
        rejectedBy: null,
        rejectedAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            profile: { select: { country: true } },
          },
        },
        raceResults: true,
      },
    });

    this.eventEmitter.emit('game.participantVerified', {
      gameId,
      participant: updated,
    });

    return updated;
  }

  /**
   * Reject a participant's score (moderator action)
   * Also requests screenshot and sends Discord notification
   */
  async rejectParticipantScore(
    gameId: number,
    targetUserId: number,
    moderatorId: number,
  ) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        match: {
          include: {
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
      throw new NotFoundException('Game not found');
    }

    const participant = await this.prisma.gameParticipant.findFirst({
      where: { gameId, userId: targetUserId },
    });

    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    // Check all non-excluded participants have submitted
    const allParticipants = await this.prisma.gameParticipant.findMany({
      where: { gameId },
      select: { status: true, isExcluded: true },
    });
    const hasUnsubmitted = allParticipants.some(
      (p) => !p.isExcluded && p.status === ResultStatus.UNSUBMITTED,
    );
    if (hasUnsubmitted) {
      throw new BadRequestException(
        'Cannot reject: not all participants have submitted their scores',
      );
    }

    if (participant.status === ResultStatus.VERIFIED) {
      throw new BadRequestException('Cannot reject a verified score');
    }

    const updated = await this.prisma.gameParticipant.update({
      where: { id: participant.id },
      data: {
        status: ResultStatus.REJECTED,
        rejectedBy: moderatorId,
        rejectedAt: new Date(),
        // Also request screenshot
        screenshotRequested: true,
        screenshotRequestedBy: moderatorId,
        screenshotRequestedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            discordId: true,
            displayName: true,
            profile: { select: { country: true } },
          },
        },
        raceResults: true,
      },
    });

    // Soft delete existing SS1/SS2 screenshots
    await this.prisma.gameScreenshotSubmission.updateMany({
      where: {
        gameId,
        userId: targetUserId,
        type: { in: [ScreenshotType.INDIVIDUAL_1, ScreenshotType.INDIVIDUAL_2] },
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    // Discord notification via channel
    if (game.discordChannelId && updated.user.discordId) {
      const category =
        game.match.season?.event?.category?.toLowerCase() || 'classic';
      const seasonNumber = game.match.season?.seasonNumber ?? 1;
      const matchUrl = `${process.env.FRONTEND_URL}/matches/${category}/${seasonNumber}/${game.match.matchNumber}`;
      this.discordBotService.postScreenshotRequest(
        game.discordChannelId,
        updated.user.discordId,
        matchUrl,
      );
    }

    this.eventEmitter.emit('game.participantRejected', {
      gameId,
      participant: updated,
    });

    return updated;
  }

  /**
   * Request a participant to submit a screenshot (moderator action)
   */
  async requestScreenshot(
    gameId: number,
    targetUserId: number,
    moderatorId: number,
  ) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        match: {
          include: {
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
      throw new NotFoundException('Game not found');
    }

    const participant = await this.prisma.gameParticipant.findFirst({
      where: { gameId, userId: targetUserId },
      include: { user: true },
    });

    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    const updated = await this.prisma.gameParticipant.update({
      where: { id: participant.id },
      data: {
        screenshotRequested: true,
        screenshotRequestedBy: moderatorId,
        screenshotRequestedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            discordId: true,
            displayName: true,
            profile: { select: { country: true } },
          },
        },
        raceResults: true,
      },
    });

    // Discord notification via channel
    if (game.discordChannelId && updated.user.discordId) {
      const category = game.match.season?.event?.category?.toLowerCase() || 'classic';
      const seasonNumber = game.match.season?.seasonNumber ?? 1;
      const matchUrl = `${process.env.FRONTEND_URL}/matches/${category}/${seasonNumber}/${game.match.matchNumber}`;
      this.discordBotService.postScreenshotRequest(
        game.discordChannelId,
        updated.user.discordId,
        matchUrl,
      );
    }

    this.eventEmitter.emit('game.screenshotRequested', {
      gameId,
      participant: updated,
    });

    return updated;
  }

  /**
   * Calculate and save team scores for a TEAM_CLASSIC / TEAM_GP game
   * Called before rating calculation
   */
  private async calculateAndSaveTeamScores(gameId: number): Promise<void> {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        participants: {
          where: {
            status: ResultStatus.VERIFIED,
            isExcluded: false,
          },
          select: {
            userId: true,
            totalScore: true,
            teamIndex: true,
          },
        },
      },
    });

    if (!game) {
      throw new NotFoundException(`Game ${gameId} not found`);
    }

    if (!game.teamConfig) {
      throw new BadRequestException(`Game ${gameId} has no team config`);
    }

    // Group participants by team
    const teamUserIdsMap = new Map<number, number[]>();
    for (const p of game.participants) {
      if (p.teamIndex !== null) {
        const list = teamUserIdsMap.get(p.teamIndex) || [];
        list.push(p.userId);
        teamUserIdsMap.set(p.teamIndex, list);
      }
    }

    // Build teams array for score calculation
    const teams: number[][] = [];
    for (const [teamIndex, userIds] of teamUserIdsMap.entries()) {
      teams[teamIndex] = userIds;
    }

    // Build participant scores map
    const participantScores = new Map<number, number>();
    for (const p of game.participants) {
      participantScores.set(p.userId, p.totalScore ?? 0);
    }

    // Calculate team scores
    const teamScores = this.teamAssignmentService.calculateTeamScores(
      participantScores,
      teams,
    );

    // Save team scores to game
    await this.prisma.game.update({
      where: { id: gameId },
      data: {
        teamScores: teamScores,
      },
    });

    this.logger.log(
      `Calculated team scores for game ${gameId}: ${JSON.stringify(teamScores)}`,
    );
  }

}
