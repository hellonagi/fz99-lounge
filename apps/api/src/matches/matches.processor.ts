import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { LobbyStatus } from '@prisma/client';

@Processor('matches')
export class MatchesProcessor {
  private readonly logger = new Logger(MatchesProcessor.name);

  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
    private pushNotificationsService: PushNotificationsService,
  ) {}

  @Process('start-match')
  async handleStartMatch(job: Job<{ lobbyId: string }>) {
    const { lobbyId } = job.data;
    this.logger.log(`Processing start-match job for lobby ${lobbyId}`);

    try {
      // Get lobby
      const lobby = await this.prisma.lobby.findUnique({
        where: { id: lobbyId },
        include: {
          participants: true,
          event: {
            include: {
              season: true,
            },
          },
        },
      });

      if (!lobby) {
        this.logger.warn(`Lobby ${lobbyId} not found`);
        return;
      }

      // Check if lobby is still in WAITING status
      if (lobby.status !== LobbyStatus.WAITING) {
        this.logger.warn(
          `Lobby ${lobbyId} is not in WAITING status (current: ${lobby.status})`
        );
        return;
      }

      // Check if minimum players met
      if (lobby.currentPlayers < lobby.minPlayers) {
        this.logger.warn(
          `Lobby ${lobbyId} does not have enough players (${lobby.currentPlayers}/${lobby.minPlayers})`
        );

        // Update lobby status to CANCELLED
        await this.prisma.lobby.update({
          where: { id: lobbyId },
          data: {
            status: LobbyStatus.CANCELLED,
          },
        });

        this.logger.log(`Lobby ${lobbyId} cancelled due to insufficient players`);

        // Emit WebSocket event to notify clients
        this.eventsGateway.emitLobbyCancelled(lobbyId);

        return;
      }

      // Check if leagueType exists
      if (!lobby.leagueType) {
        this.logger.warn(`Lobby ${lobbyId} has no leagueType. Cannot create match.`);
        return;
      }

      // Generate 4-digit passcode
      const passcode = this.generatePasscode();

      // Get next sequence number for this lobby
      const lastMatch = await this.prisma.match.findFirst({
        where: { lobbyId: lobby.id },
        orderBy: { sequenceNumber: 'desc' },
      });
      const sequenceNumber = lastMatch ? lastMatch.sequenceNumber + 1 : 1;

      // Create match
      const match = await this.prisma.match.create({
        data: {
          lobbyId: lobby.id,
          gameMode: lobby.gameMode,
          leagueType: lobby.leagueType,
          sequenceNumber,
          passcode,
          totalPlayers: lobby.currentPlayers,
          startedAt: new Date(),
        },
      });

      // Update lobby status
      await this.prisma.lobby.update({
        where: { id: lobbyId },
        data: {
          status: LobbyStatus.IN_PROGRESS,
        },
      });

      this.logger.log(
        `Started match ${match.id} for lobby ${lobbyId} with passcode ${passcode}`
      );

      // Format mode for URL (GP -> "gp", CLASSIC -> "classic", TOURNAMENT -> "tournament")
      const modeStr = lobby.gameMode.toLowerCase();
      const seasonNumber = lobby.event?.season?.seasonNumber ?? 0;
      const gameNumber = lobby.gameNumber ?? 0;

      // Emit WebSocket event to all clients
      this.eventsGateway.emitMatchStarted({
        matchId: match.id,
        lobbyId: lobby.id,
        passcode: match.passcode,
        leagueType: match.leagueType,
        totalPlayers: match.totalPlayers,
        startedAt: match.startedAt ? match.startedAt.toISOString() : new Date().toISOString(),
        mode: modeStr,
        season: seasonNumber,
        game: gameNumber,
        url: `/matches/${modeStr}/${seasonNumber}/${gameNumber}`,
      });

      // Send Push notifications to all participants
      try {
        await this.pushNotificationsService.notifyMatchStart({
          id: match.id,
          passcode: match.passcode,
          leagueType: match.leagueType,
          totalPlayers: match.totalPlayers,
          lobby: {
            participants: lobby.participants.map((p) => ({
              userId: p.userId,
            })),
          },
        });
      } catch (error) {
        this.logger.error('Failed to send push notifications:', error);
        // Continue even if push notifications fail
      }

      return match;
    } catch (error) {
      this.logger.error(`Failed to start match for lobby ${lobbyId}:`, error);
      throw error;
    }
  }

  private generatePasscode(): string {
    // Generate random 4-digit number (0000-9999)
    const passcode = Math.floor(Math.random() * 10000);
    return passcode.toString().padStart(4, '0');
  }
}
