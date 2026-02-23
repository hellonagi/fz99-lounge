import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { RecurringMatchService } from './recurring-match.service';

@Injectable()
export class RecurringMatchCron {
  private readonly logger = new Logger(RecurringMatchCron.name);

  constructor(
    private prisma: PrismaService,
    private recurringMatchService: RecurringMatchService,
  ) {}

  @Cron('0 0 * * *') // Every day at midnight (server time)
  async replenishMatches() {
    this.logger.log('Running daily recurring match replenishment...');

    const schedules = await this.prisma.recurringMatch.findMany({
      where: { isEnabled: true },
      include: { rules: true },
    });

    for (const schedule of schedules) {
      try {
        await this.recurringMatchService.generateMatchesForSchedule(
          schedule,
          7,
          schedule.createdBy ?? undefined,
        );
      } catch (error) {
        this.logger.error(
          `Failed to replenish matches for schedule #${schedule.id}:`,
          error,
        );
      }
    }

    this.logger.log(`Replenishment complete. Processed ${schedules.length} schedules.`);
  }
}
