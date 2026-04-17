import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventCategory, MatchStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DiscordBotService } from './discord-bot.service';

@Injectable()
export class DailyLoungeAnnouncementCron {
  private readonly logger = new Logger(DailyLoungeAnnouncementCron.name);

  constructor(
    private prisma: PrismaService,
    private discordBotService: DiscordBotService,
  ) {}

  /**
   * Post today's lounge schedule to the match-announcements channel
   * every day at 00:05 UTC. The 5-minute offset gives the recurring-match
   * replenishment cron room to finish creating today's matches first.
   */
  @Cron('5 0 * * *', { timeZone: 'UTC' })
  async announceTodaysLounge() {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    this.logger.log(
      `Running daily lounge announcement for ${todayStart.toISOString()} - ${todayEnd.toISOString()}`,
    );

    try {
      const matches = await this.prisma.match.findMany({
        where: {
          scheduledStart: { gte: todayStart, lt: todayEnd },
          status: MatchStatus.WAITING,
          season: {
            event: {
              category: { not: EventCategory.TOURNAMENT },
            },
          },
        },
        orderBy: { scheduledStart: 'asc' },
        select: {
          scheduledStart: true,
          season: {
            select: {
              event: { select: { category: true } },
            },
          },
        },
      });

      if (matches.length === 0) {
        this.logger.log('No matches scheduled for today, skipping announcement');
        return;
      }

      await this.discordBotService.announceDailyLoungeSchedule(
        matches.map((m) => ({
          scheduledStart: m.scheduledStart,
          category: m.season.event.category,
        })),
      );
    } catch (error) {
      this.logger.error('Failed to run daily lounge announcement:', error);
    }
  }
}
