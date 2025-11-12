import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { LobbyStatus, MatchStatus } from '@prisma/client';

@Injectable()
export class MatchSchedulerService {
  private readonly logger = new Logger(MatchSchedulerService.name);

  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async checkAndStartMatches() {
    const now = new Date();

    // Find lobbies that should start
    const lobbies = await this.prisma.lobby.findMany({
      where: {
        status: LobbyStatus.WAITING,
        scheduledStart: {
          lte: now,
        },
      },
      include: {
        participants: true,
      },
    });

    if (lobbies.length === 0) {
      return;
    }

    this.logger.log(`Found ${lobbies.length} lobbies to start`);

    for (const lobby of lobbies) {
      try {
        // Check if minimum players met
        if (lobby.currentPlayers < lobby.minPlayers) {
          // Check if grace period (5 minutes) has passed
          const gracePeriodMs = 5 * 60 * 1000; // 5 minutes
          const scheduledStart = new Date(lobby.scheduledStart);
          const elapsedMs = now.getTime() - scheduledStart.getTime();

          if (elapsedMs >= gracePeriodMs) {
            // Cancel lobby due to insufficient players
            await this.prisma.lobby.update({
              where: { id: lobby.id },
              data: {
                status: LobbyStatus.CANCELLED,
              },
            });

            this.logger.warn(
              `Lobby ${lobby.id} cancelled due to insufficient players (${lobby.currentPlayers}/${lobby.minPlayers}) after grace period.`,
            );
          } else {
            this.logger.warn(
              `Lobby ${lobby.id} does not have enough players (${lobby.currentPlayers}/${lobby.minPlayers}). Waiting for grace period...`,
            );
          }
          continue;
        }

        // Check if leagueType exists (required for Match)
        if (!lobby.leagueType) {
          this.logger.warn(
            `Lobby ${lobby.id} has no leagueType. Cannot create match.`,
          );
          continue;
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
            startedAt: now,
            status: MatchStatus.ONGOING,
          },
        });

        // Update lobby status
        await this.prisma.lobby.update({
          where: { id: lobby.id },
          data: {
            status: LobbyStatus.IN_PROGRESS,
          },
        });

        this.logger.log(
          `Started match ${match.id} for lobby ${lobby.id} with passcode ${passcode}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to start match for lobby ${lobby.id}:`,
          error,
        );
      }
    }
  }

  private generatePasscode(): string {
    // Generate random 4-digit number (1000-9999)
    const passcode = Math.floor(Math.random() * 9000) + 1000;
    return passcode.toString();
  }
}
