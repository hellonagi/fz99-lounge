import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ClassicRatingService } from '../rating/classic-rating.service';
import { EventsGateway } from '../events/events.gateway';
import { MatchStatus, EventCategory } from '@prisma/client';

@Injectable()
export class MatchesDeadlineService {
  private readonly logger = new Logger(MatchesDeadlineService.name);

  constructor(
    private prisma: PrismaService,
    private classicRatingService: ClassicRatingService,
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

    const category = match.season?.event?.category;

    // Calculate ratings for each game in the match
    for (const game of match.games) {
      try {
        if (category === EventCategory.CLASSIC) {
          await this.classicRatingService.calculateAndUpdateRatings(game.id);
          this.logger.log(`Calculated ratings for CLASSIC game ${game.id}`);
        }
        // TODO: Add GP and TOURNAMENT rating services when implemented
      } catch (error) {
        this.logger.error(
          `Failed to calculate ratings for game ${game.id}:`,
          error,
        );
      }
    }

    // Mark match as completed
    await this.prisma.match.update({
      where: { id: match.id },
      data: { status: MatchStatus.COMPLETED },
    });

    // Emit WebSocket event
    this.eventsGateway.emitMatchCompleted(match.id);

    this.logger.log(`Match ${match.id} completed after deadline`);
  }
}
