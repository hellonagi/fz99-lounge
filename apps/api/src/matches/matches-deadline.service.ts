import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { MatchStatus } from '@prisma/client';

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

    // Emit WebSocket event
    this.eventsGateway.emitMatchCompleted(match.id);

    this.logger.log(`Match ${match.id} marked as COMPLETED after deadline (awaiting finalization)`);
  }
}
