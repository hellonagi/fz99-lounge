import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { DiscordBotService } from '../discord-bot/discord-bot.service';
import { MatchStatus } from '@prisma/client';

@Processor('matches')
export class MatchesProcessor {
  private readonly logger = new Logger(MatchesProcessor.name);

  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
    private pushNotificationsService: PushNotificationsService,
    private discordBotService: DiscordBotService,
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
                select: { discordId: true },
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

        // Update match status to CANCELLED
        await this.prisma.match.update({
          where: { id: matchId },
          data: {
            status: MatchStatus.CANCELLED,
          },
        });

        this.logger.log(`Match ${matchId} cancelled due to insufficient players`);

        // Emit WebSocket event to notify clients
        this.eventsGateway.emitMatchCancelled(matchId);

        // Announce cancellation to Discord
        try {
          await this.discordBotService.announceMatchCancelled({
            matchNumber: match.matchNumber,
            seasonNumber: match.season.seasonNumber,
            category: match.season.event.category,
            seasonName: match.season.event.name,
          });
        } catch (error) {
          this.logger.error('Failed to announce match cancellation to Discord:', error);
        }

        return;
      }

      // Get existing game (created when match was created)
      const game = match.games[0];
      if (!game) {
        this.logger.error(`No game found for match ${matchId}`);
        return;
      }

      // Generate 4-digit passcode and update game
      const passcode = this.generatePasscode();

      const updatedGame = await this.prisma.game.update({
        where: { id: game.id },
        data: {
          passcode,
          passcodePublishedAt: new Date(),
          startedAt: new Date(),
        },
      });

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

      // Emit WebSocket event to all clients
      this.eventsGateway.emitMatchStarted({
        matchId: match.id,
        gameId: updatedGame.id,
        passcode: updatedGame.passcode,
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
          passcode: updatedGame.passcode,
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

      // Create Discord passcode channel for participants
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
