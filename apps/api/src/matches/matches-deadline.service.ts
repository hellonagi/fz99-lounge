import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { MatchStatus, ResultStatus } from '@prisma/client';

@Injectable()
export class MatchesDeadlineService {
  private readonly logger = new Logger(MatchesDeadlineService.name);

  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
  ) {}

  /**
   * Check for matches past their deadline every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkDeadlines() {
    const now = new Date();

    // Find IN_PROGRESS matches past their deadline
    const expiredMatches = await this.prisma.match.findMany({
      where: {
        status: MatchStatus.IN_PROGRESS,
        deadline: {
          lte: now,
        },
      },
      include: {
        games: true,
        season: {
          include: {
            event: true,
          },
        },
      },
    });

    if (expiredMatches.length === 0) {
      return;
    }

    this.logger.log(`Found ${expiredMatches.length} matches past deadline`);

    for (const match of expiredMatches) {
      try {
        await this.processExpiredMatch(match);
      } catch (error) {
        this.logger.error(
          `Failed to process expired match ${match.id}:`,
          error,
        );
      }
    }
  }

  private async processExpiredMatch(match: any) {
    this.logger.log(`Processing expired match ${match.id}`);

    // Mark match as COMPLETED (submission deadline reached)
    // Rating calculation happens when match is FINALIZED
    await this.prisma.match.update({
      where: { id: match.id },
      data: { status: MatchStatus.COMPLETED },
    });

    // Auto-mark UNSUBMITTED participants as NO_SHOW
    for (const game of match.games) {
      // Update existing UNSUBMITTED GameParticipants
      const updated = await this.prisma.gameParticipant.updateMany({
        where: {
          gameId: game.id,
          status: ResultStatus.UNSUBMITTED,
        },
        data: { status: ResultStatus.NO_SHOW },
      });

      if (updated.count > 0) {
        this.logger.log(
          `Marked ${updated.count} unsubmitted participants as NO_SHOW in game ${game.id}`,
        );
      }

      // Create NO_SHOW records for match participants without GameParticipant
      const matchParticipants = await this.prisma.matchParticipant.findMany({
        where: { matchId: match.id, hasWithdrawn: false },
        select: { userId: true },
      });

      const existingGameParticipants = await this.prisma.gameParticipant.findMany({
        where: { gameId: game.id },
        select: { userId: true },
      });

      const existingUserIds = new Set(existingGameParticipants.map((p) => p.userId));
      const missingUserIds = matchParticipants
        .map((p) => p.userId)
        .filter((uid) => !existingUserIds.has(uid));

      if (missingUserIds.length > 0) {
        await this.prisma.gameParticipant.createMany({
          data: missingUserIds.map((userId) => ({
            gameId: game.id,
            userId,
            status: ResultStatus.NO_SHOW,
          })),
        });
        this.logger.log(
          `Created NO_SHOW records for ${missingUserIds.length} missing participants in game ${game.id}`,
        );
      }
    }

    // Emit WebSocket event
    this.eventsGateway.emitMatchCompleted(match.id);

    this.logger.log(`Match ${match.id} marked as COMPLETED after deadline (awaiting finalization)`);
  }
}
