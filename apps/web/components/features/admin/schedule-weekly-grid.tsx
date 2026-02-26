'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { RecurringMatch } from '@/types';

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  GP: { bg: 'bg-blue-500/30', border: 'border-l-blue-500', text: 'text-blue-200' },
  CLASSIC: { bg: 'bg-purple-500/30', border: 'border-l-purple-500', text: 'text-purple-200' },
  TEAM_CLASSIC: { bg: 'bg-rose-500/30', border: 'border-l-rose-500', text: 'text-rose-200' },
  TEAM_GP: { bg: 'bg-cyan-500/30', border: 'border-l-cyan-500', text: 'text-cyan-200' },
  TOURNAMENT: { bg: 'bg-amber-500/30', border: 'border-l-amber-500', text: 'text-amber-200' },
};

const DISABLED_COLORS = { bg: 'bg-gray-700/20', border: 'border-l-gray-600', text: 'text-gray-600' };

const DAY_INDICES = [0, 1, 2, 3, 4, 5, 6];
const JST_OFFSET = 9 * 60 * 60 * 1000;

interface ScheduleWeeklyGridProps {
  schedules: RecurringMatch[];
}

interface ScheduleEvent {
  category: string;
  label: string;
  name: string | null;
  isEnabled: boolean;
  timeStr: string;
}

function getCurrentWeekDatesJST(): Date[] {
  const nowJst = new Date(Date.now() + JST_OFFSET);
  const dayOfWeek = nowJst.getUTCDay();
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    dates.push(new Date(Date.UTC(
      nowJst.getUTCFullYear(),
      nowJst.getUTCMonth(),
      nowJst.getUTCDate() - dayOfWeek + i,
    )));
  }
  return dates;
}

function getTodayJST(): string {
  const nowJst = new Date(Date.now() + JST_OFFSET);
  return `${nowJst.getUTCFullYear()}-${String(nowJst.getUTCMonth() + 1).padStart(2, '0')}-${String(nowJst.getUTCDate()).padStart(2, '0')}`;
}

export function ScheduleWeeklyGrid({ schedules }: ScheduleWeeklyGridProps) {
  const t = useTranslations('recurringMatch');
  const weekDates = useMemo(() => getCurrentWeekDatesJST(), []);
  const todayKey = getTodayJST();

  const { eventsByDay, timeSlots } = useMemo(() => {
    const byDay: Record<number, ScheduleEvent[]> = {};
    for (let i = 0; i < 7; i++) byDay[i] = [];

    const timeSlotsSet = new Set<string>();

    for (const schedule of schedules) {
      for (const rule of schedule.rules) {
        timeSlotsSet.add(rule.timeOfDay);

        for (const day of rule.daysOfWeek) {
          byDay[day].push({
            category: schedule.eventCategory,
            label: schedule.eventCategory === 'TEAM_CLASSIC' ? 'TEAM' : schedule.eventCategory === 'TEAM_GP' ? 'T-GP' : schedule.eventCategory,
            name: schedule.name,
            isEnabled: schedule.isEnabled,
            timeStr: rule.timeOfDay,
          });
        }
      }
    }

    const sorted = [...timeSlotsSet].sort();

    return { eventsByDay: byDay, timeSlots: sorted };
  }, [schedules]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>{t('gridTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-6 pb-4">
        {schedules.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            {t('noSchedules')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[540px]">
              {/* Day headers */}
              <div className="flex border-b border-gray-700/60">
                {/* Gutter */}
                <div className="w-12 shrink-0" />
                {/* Day columns */}
                {DAY_INDICES.map((dayIdx) => {
                  const date = weekDates[dayIdx];
                  const dateKey = date.toISOString().split('T')[0];
                  const isToday = dateKey === todayKey;

                  return (
                    <div
                      key={dayIdx}
                      className="flex-1 flex flex-col items-center justify-center h-14"
                    >
                      <span className={cn(
                        'text-[10px] uppercase tracking-wider',
                        isToday ? 'text-blue-400 font-semibold' : 'text-gray-500',
                      )}>
                        {t(`dayNames.${dayIdx}`)}
                      </span>
                      <span className={cn(
                        'leading-tight mt-0.5',
                        isToday
                          ? 'bg-blue-500 text-white w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs'
                          : 'text-gray-300 text-sm',
                      )}>
                        {date.getUTCDate()}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Time grid rows */}
              {timeSlots.map((slot) => (
                <div key={slot} className="flex border-b border-gray-800/40">
                  {/* Time label */}
                  <div className="w-12 shrink-0 flex items-center justify-end pr-1">
                    <span className="text-[10px] font-mono text-gray-500 tabular-nums">
                      {slot}
                    </span>
                  </div>

                  {/* Day cells */}
                  {DAY_INDICES.map((dayIdx) => {
                    const events = (eventsByDay[dayIdx] || []).filter(
                      (e) => e.timeStr === slot,
                    );
                    return (
                      <div
                        key={dayIdx}
                        className={cn(
                          'flex-1 border-l border-gray-800/50 min-h-[36px] flex flex-col justify-center gap-0.5 py-1',
                        )}
                      >
                        {events.map((evt, i) => {
                          const colors = evt.isEnabled
                            ? CATEGORY_COLORS[evt.category] || CATEGORY_COLORS.GP
                            : DISABLED_COLORS;

                          return (
                            <div
                              key={i}
                              className={cn(
                                'mx-0.5 rounded-sm border-l-2 px-1 py-0.5',
                                colors.bg,
                                colors.border,
                                colors.text,
                                !evt.isEnabled && 'opacity-50',
                              )}
                              title={`${evt.timeStr} JST - ${evt.label}${evt.name ? ` (${evt.name})` : ''}`}
                            >
                              <span className={cn(
                                'text-[10px] font-bold whitespace-nowrap',
                                !evt.isEnabled && 'line-through',
                              )}>
                                {evt.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
