import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MatchesService, CATEGORY_SPAN_MINUTES } from '../matches/matches.service';
import { SeasonsService } from '../seasons/seasons.service';
import { CreateRecurringMatchDto } from './dto/create-recurring-match.dto';
import { UpdateRecurringMatchDto } from './dto/update-recurring-match.dto';

@Injectable()
export class RecurringMatchService {
  private readonly logger = new Logger(RecurringMatchService.name);

  constructor(
    private prisma: PrismaService,
    private matchesService: MatchesService,
    private seasonsService: SeasonsService,
  ) {}

  async create(dto: CreateRecurringMatchDto, createdBy: number) {
    // Validate daysOfWeek values (0-6) in all rules
    for (const rule of dto.rules) {
      if (rule.daysOfWeek.some((d) => d < 0 || d > 6)) {
        throw new BadRequestException('daysOfWeek values must be between 0 and 6');
      }
    }

    // スパン重複チェック
    await this.validateNoTimeOverlap(null, dto.eventCategory as EventCategory, dto.rules);

    // 1カテゴリ1スケジュール制約チェック
    const existing = await this.prisma.recurringMatch.findUnique({
      where: { eventCategory: dto.eventCategory },
    });
    if (existing) {
      throw new BadRequestException(
        `A schedule already exists for category ${dto.eventCategory}`,
      );
    }

    const schedule = await this.prisma.recurringMatch.create({
      data: {
        eventCategory: dto.eventCategory,
        inGameMode: dto.inGameMode,
        leagueType: dto.leagueType,
        minPlayers: dto.minPlayers ?? 12,
        maxPlayers: dto.maxPlayers ?? 20,
        name: dto.name,
        notes: dto.notes,
        createdBy,
        rules: {
          create: dto.rules.map((rule) => ({
            daysOfWeek: rule.daysOfWeek,
            timeOfDay: rule.timeOfDay,
          })),
        },
      },
      include: { rules: true },
    });

    // Generate matches for the next 7 days
    await this.generateMatchesForSchedule(schedule, 7, createdBy);

    return this.findById(schedule.id);
  }

  async findAll() {
    return this.prisma.recurringMatch.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        rules: true,
        createdByUser: {
          select: { id: true, displayName: true, username: true },
        },
      },
    });
  }

  async findById(id: number) {
    const schedule = await this.prisma.recurringMatch.findUnique({
      where: { id },
      include: {
        rules: true,
        createdByUser: {
          select: { id: true, displayName: true, username: true },
        },
      },
    });
    if (!schedule) {
      throw new NotFoundException(`RecurringMatch #${id} not found`);
    }
    return schedule;
  }

  async update(id: number, dto: UpdateRecurringMatchDto, userId?: number) {
    const existing = await this.findById(id); // Ensure exists

    if (dto.rules) {
      for (const rule of dto.rules) {
        if (rule.daysOfWeek?.some((d) => d < 0 || d > 6)) {
          throw new BadRequestException('daysOfWeek values must be between 0 and 6');
        }
      }

      // スパン重複チェック
      const category = (dto.eventCategory ?? existing.eventCategory) as EventCategory;
      await this.validateNoTimeOverlap(id, category, dto.rules);
    }

    // Update parent fields + replace rules if provided
    await this.prisma.$transaction(async (tx) => {
      await tx.recurringMatch.update({
        where: { id },
        data: {
          ...(dto.eventCategory !== undefined && { eventCategory: dto.eventCategory }),
          ...(dto.inGameMode !== undefined && { inGameMode: dto.inGameMode }),
          ...(dto.leagueType !== undefined && { leagueType: dto.leagueType }),
          ...(dto.minPlayers !== undefined && { minPlayers: dto.minPlayers }),
          ...(dto.maxPlayers !== undefined && { maxPlayers: dto.maxPlayers }),
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
        },
      });

      // Replace all rules if provided
      if (dto.rules) {
        await tx.recurringMatchRule.deleteMany({ where: { recurringMatchId: id } });
        await tx.recurringMatchRule.createMany({
          data: dto.rules.map((rule) => ({
            recurringMatchId: id,
            daysOfWeek: rule.daysOfWeek,
            timeOfDay: rule.timeOfDay,
          })),
        });
      }
    });

    // If rules changed, clean up old WAITING matches and regenerate
    const updated = await this.findById(id);
    if (dto.rules) {
      await this.deleteWaitingMatchesForSchedule(id);
      if (updated.isEnabled) {
        await this.generateMatchesForSchedule(updated, 7, userId ?? updated.createdBy ?? undefined);
      }
    } else if (updated.isEnabled) {
      // No rule change, just fill in any missing matches
      await this.generateMatchesForSchedule(updated, 7, userId ?? updated.createdBy ?? undefined);
    }

    return updated;
  }

  async toggleEnabled(id: number, enabled: boolean, userId?: number) {
    const schedule = await this.findById(id);

    await this.prisma.recurringMatch.update({
      where: { id },
      data: { isEnabled: enabled },
    });

    if (enabled) {
      // Re-enabling: generate matches for 7 days
      await this.generateMatchesForSchedule(schedule, 7, userId ?? schedule.createdBy ?? undefined);
    } else {
      // Disabling: clean up WAITING matches
      await this.deleteWaitingMatchesForSchedule(id);
    }

    return this.findById(id);
  }

  async delete(id: number) {
    await this.findById(id); // Ensure exists
    // Clean up WAITING matches before deleting schedule
    await this.deleteWaitingMatchesForSchedule(id);
    await this.prisma.recurringMatch.delete({ where: { id } });
    return { message: 'Recurring match schedule deleted' };
  }

  /**
   * Delete all WAITING matches linked to a schedule, then reassign matchNumbers.
   */
  private async deleteWaitingMatchesForSchedule(scheduleId: number): Promise<void> {
    // Find WAITING matches for this schedule to get their seasonIds
    const waitingMatches = await this.prisma.match.findMany({
      where: { recurringMatchId: scheduleId, status: 'WAITING' },
      select: { id: true, seasonId: true },
    });

    if (waitingMatches.length > 0) {
      // Collect unique seasonIds for matchNumber reassignment
      const seasonIds = [...new Set(waitingMatches.map((m) => m.seasonId))];

      // Delete related data and matches
      const matchIds = waitingMatches.map((m) => m.id);
      await this.prisma.$transaction(async (tx) => {
        await tx.game.deleteMany({ where: { matchId: { in: matchIds } } });
        await tx.matchParticipant.deleteMany({ where: { matchId: { in: matchIds } } });
        await tx.match.deleteMany({
          where: { recurringMatchId: scheduleId, status: 'WAITING' },
        });

        // Reassign matchNumbers for affected seasons
        for (const seasonId of seasonIds) {
          await this.matchesService.reassignWaitingMatchNumbers(tx, seasonId);
        }
      });

      this.logger.log(
        `Deleted ${waitingMatches.length} WAITING matches for schedule #${scheduleId}`,
      );
    }

    // Always reset lastScheduledAt so matches can be regenerated on re-enable
    await this.prisma.recurringMatchRule.updateMany({
      where: { recurringMatchId: scheduleId },
      data: { lastScheduledAt: null },
    });
  }

  /**
   * スケジュールのルール同士、および他スケジュールとのスパン重複をチェック。
   * scheduleId が null なら新規作成、number なら更新（自身を除外）。
   */
  private async validateNoTimeOverlap(
    scheduleId: number | null,
    category: EventCategory,
    rules: Array<{ daysOfWeek: number[]; timeOfDay: string }>,
  ): Promise<void> {
    const newSpan = CATEGORY_SPAN_MINUTES[category];
    if (!newSpan) return;

    // 同スケジュール内のルール同士チェック
    for (let i = 0; i < rules.length; i++) {
      for (let j = i + 1; j < rules.length; j++) {
        const sharedDays = rules[i].daysOfWeek.filter((d) =>
          rules[j].daysOfWeek.includes(d),
        );
        if (sharedDays.length === 0) continue;

        const [h1, m1] = rules[i].timeOfDay.split(':').map(Number);
        const [h2, m2] = rules[j].timeOfDay.split(':').map(Number);
        const start1 = h1 * 60 + m1;
        const start2 = h2 * 60 + m2;

        if (start1 < start2 + newSpan && start2 < start1 + newSpan) {
          throw new BadRequestException(
            `Time slots ${rules[i].timeOfDay} and ${rules[j].timeOfDay} overlap (${newSpan}-minute window required)`,
          );
        }
      }
    }

    // 他の有効スケジュールとのチェック
    const spanCategories = Object.keys(CATEGORY_SPAN_MINUTES) as EventCategory[];
    const otherSchedules = await this.prisma.recurringMatch.findMany({
      where: {
        ...(scheduleId && { id: { not: scheduleId } }),
        isEnabled: true,
        eventCategory: { in: spanCategories },
      },
      include: { rules: true },
    });

    for (const rule of rules) {
      const [newH, newM] = rule.timeOfDay.split(':').map(Number);
      const newStartMin = newH * 60 + newM;

      for (const other of otherSchedules) {
        const otherSpan = CATEGORY_SPAN_MINUTES[other.eventCategory] ?? 0;
        if (otherSpan === 0) continue;

        for (const otherRule of other.rules) {
          const sharedDays = rule.daysOfWeek.filter((d) =>
            otherRule.daysOfWeek.includes(d),
          );
          if (sharedDays.length === 0) continue;

          const [otherH, otherM] = otherRule.timeOfDay.split(':').map(Number);
          const otherStartMin = otherH * 60 + otherM;

          if (
            newStartMin < otherStartMin + otherSpan &&
            otherStartMin < newStartMin + newSpan
          ) {
            throw new BadRequestException(
              `Time ${rule.timeOfDay} overlaps with ${other.eventCategory} schedule at ${otherRule.timeOfDay} (${newSpan}-minute window required)`,
            );
          }
        }
      }
    }
  }

  /**
   * Generate matches for a schedule up to `horizonDays` days ahead.
   * Iterates over each rule and generates occurrences per rule.
   */
  async generateMatchesForSchedule(
    schedule: {
      id: number;
      eventCategory: any;
      inGameMode: any;
      leagueType: any;
      minPlayers: number;
      maxPlayers: number;
      notes: string | null;
      rules: Array<{
        id: number;
        daysOfWeek: number[];
        timeOfDay: string;
        lastScheduledAt: Date | null;
      }>;
    },
    horizonDays: number,
    createdBy?: number,
  ) {
    const now = new Date();
    const horizon = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);
    const JST_OFFSET = 9 * 60 * 60 * 1000;

    // Get active season for this category
    let season;
    try {
      season = await this.seasonsService.getActive(schedule.eventCategory);
    } catch {
      this.logger.warn(
        `No active season for ${schedule.eventCategory}, skipping match generation for schedule #${schedule.id}`,
      );
      return;
    }

    for (const rule of schedule.rules) {
      const [hours, minutes] = rule.timeOfDay.split(':').map(Number);

      // Generate all occurrence datetimes within the window
      const occurrences: Date[] = [];
      const current = new Date(now);
      current.setUTCHours(0, 0, 0, 0);

      for (let day = 0; day <= horizonDays; day++) {
        const date = new Date(current.getTime() + day * 24 * 60 * 60 * 1000);
        const jstDate = new Date(date.getTime() + JST_OFFSET);
        const dayOfWeek = jstDate.getUTCDay();

        if (rule.daysOfWeek.includes(dayOfWeek)) {
          const utcDateTime = new Date(
            Date.UTC(
              jstDate.getUTCFullYear(),
              jstDate.getUTCMonth(),
              jstDate.getUTCDate(),
              hours,
              minutes,
              0,
            ) - JST_OFFSET,
          );

          if (
            utcDateTime > now &&
            utcDateTime <= horizon &&
            (!rule.lastScheduledAt || utcDateTime > rule.lastScheduledAt)
          ) {
            occurrences.push(utcDateTime);
          }
        }
      }

      if (occurrences.length === 0) {
        continue;
      }

      let latestScheduledAt = rule.lastScheduledAt;

      for (const occurrence of occurrences) {
        try {
          await this.matchesService.create(
            {
              seasonId: season.id,
              inGameMode: schedule.inGameMode,
              leagueType: schedule.leagueType ?? undefined,
              scheduledStart: occurrence.toISOString(),
              minPlayers: schedule.minPlayers,
              maxPlayers: schedule.maxPlayers,
              notes: schedule.notes ?? undefined,
              recurringMatchId: schedule.id,
            },
            createdBy ?? 0,
            { silent: true },
          );

          if (!latestScheduledAt || occurrence > latestScheduledAt) {
            latestScheduledAt = occurrence;
          }
        } catch (error) {
          this.logger.error(
            `Failed to create match for schedule #${schedule.id} rule #${rule.id} at ${occurrence.toISOString()}:`,
            error,
          );
        }
      }

      // Update lastScheduledAt per rule
      if (latestScheduledAt) {
        await this.prisma.recurringMatchRule.update({
          where: { id: rule.id },
          data: { lastScheduledAt: latestScheduledAt },
        });
      }
    }
  }
}
