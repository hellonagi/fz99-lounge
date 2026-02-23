'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { useWeeklyMatches } from '@/hooks/useWeeklyMatches';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperType } from 'swiper';
import 'swiper/css';

const JST_OFFSET = 9 * 60 * 60 * 1000;

const CATEGORY_CARD_COLORS: Record<string, { border: string; bg: string }> = {
  GP: { border: 'border-blue-500/50', bg: 'bg-blue-500/10' },
  CLASSIC: { border: 'border-purple-500/50', bg: 'bg-purple-500/10' },
  TEAM_CLASSIC: { border: 'border-rose-500/50', bg: 'bg-rose-500/10' },
  TOURNAMENT: { border: 'border-amber-500/50', bg: 'bg-amber-500/10' },
};

const COMPLETED_CARD = { border: 'border-gray-500/30', bg: 'bg-gray-500/10' };

interface MatchCardProps {
  match: {
    id: number;
    matchNumber: number | null;
    status: string;
    scheduledStart: string;
    minPlayers: number;
    maxPlayers: number;
    season: {
      seasonNumber: number;
      event: { category: string };
    };
    participants: Array<{
      userId: number;
      user: { id: number; displayName: string | null };
    }>;
    games: Array<{
      inGameMode: string;
      leagueType: string | null;
    }>;
  };
  joiningMatchId: number | null;
  onJoinLeave: (matchId: number) => void;
  showTime?: boolean;
  layout?: 'stacked' | 'horizontal';
}

function MatchCard({ match, joiningMatchId, onJoinLeave, showTime = true, layout = 'stacked' }: MatchCardProps) {
  const tHero = useTranslations('matchHero');
  const tCal = useTranslations('weeklyCalendar');
  const { isAuthenticated, user } = useAuthStore();
  const category = match.season?.event?.category;
  const isInMatch =
    isAuthenticated && user
      ? match.participants.some((p) => p.userId === user.id)
      : false;
  const isJoiningThis = joiningMatchId === match.id;
  const isWaiting = match.status === 'WAITING';
  const isInProgress = match.status === 'IN_PROGRESS';
  const isFinished = match.status === 'COMPLETED' || match.status === 'FINALIZED';
  const scheduledDate = new Date(match.scheduledStart);
  const timeStr = scheduledDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Tokyo',
  });

  const actionButton = (
    <>
      {isInProgress && match.matchNumber && (
        <Link
          href={`/matches/${category.toLowerCase()}/${match.season.seasonNumber}/${match.matchNumber}`}
          className="inline-flex items-center justify-center gap-1 px-2.5 h-6 rounded text-[10px] font-medium bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-400" />
          </span>
          {tCal('inProgress')}
        </Link>
      )}
      {isFinished && match.matchNumber && (
        <Link
          href={`/matches/${category.toLowerCase()}/${match.season.seasonNumber}/${match.matchNumber}`}
          className="inline-flex items-center justify-center px-2.5 h-6 rounded text-[10px] font-medium bg-gray-500/20 text-gray-400 hover:bg-gray-500/30 transition-colors"
        >
          {tCal('ended')}
        </Link>
      )}
      {isWaiting && isAuthenticated && (
        <button
          onClick={() => onJoinLeave(match.id)}
          disabled={isJoiningThis}
          className={cn(
            'inline-flex items-center justify-center px-2.5 h-6 rounded text-[10px] font-medium transition-colors',
            isJoiningThis
              ? 'opacity-50 animate-pulse pointer-events-none'
              : '',
            isInMatch
              ? 'bg-gray-600/60 text-gray-300 hover:bg-gray-600/80'
              : 'bg-green-600/60 text-green-100 hover:bg-green-600/80',
          )}
        >
          {isInMatch ? tHero('leave') : tHero('join')}
        </button>
      )}
    </>
  );

  const cardColors = (() => {
    const fin = match.status === 'COMPLETED' || match.status === 'FINALIZED';
    const colors = fin ? COMPLETED_CARD : (CATEGORY_CARD_COLORS[category] || CATEGORY_CARD_COLORS.GP);
    return `${colors.border} ${colors.bg}`;
  })();

  if (layout === 'horizontal') {
    return (
      <div className={cn('rounded-lg border px-3 py-2 transition-colors', cardColors)}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold text-white shrink-0">
              {category === 'TEAM_CLASSIC' ? 'TEAM CLASSIC' : category}
            </span>
            {showTime && (
              <span className="text-xs font-medium text-gray-400">{timeStr}</span>
            )}
            <span className="text-xs text-gray-500 tabular-nums">
              {match.participants.length}/{match.maxPlayers}
            </span>
          </div>
          <div className="shrink-0">{actionButton}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rounded-lg border p-2.5 transition-colors', cardColors)}>
      <div className="flex items-center justify-between gap-1.5 mb-2">
        <span className="text-[11px] font-semibold text-white shrink-0 leading-none">
          {category === 'TEAM_CLASSIC' ? 'TEAM CLASSIC' : category}
        </span>
        <span className="text-[11px] text-gray-500 tabular-nums leading-none">
          {match.participants.length}/{match.maxPlayers}
        </span>
      </div>
      <div className="[&>a]:w-full [&>button]:w-full">{actionButton}</div>
    </div>
  );
}

/** Get JST date key (YYYY-MM-DD) from a UTC Date object that represents a JST midnight */
function jstDateKey(jstMidnight: Date, offsetDays: number): string {
  const d = new Date(jstMidnight.getTime());
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

/** Get today's date key in JST */
function getTodayKeyJST(): string {
  const nowJst = new Date(Date.now() + JST_OFFSET);
  return `${nowJst.getUTCFullYear()}-${String(nowJst.getUTCMonth() + 1).padStart(2, '0')}-${String(nowJst.getUTCDate()).padStart(2, '0')}`;
}

/** Get JST time string (HH:mm) from a scheduledStart */
function getJstTimeStr(scheduledStart: string): string {
  const jst = new Date(new Date(scheduledStart).getTime() + JST_OFFSET);
  return `${String(jst.getUTCHours()).padStart(2, '0')}:${String(jst.getUTCMinutes()).padStart(2, '0')}`;
}

export function WeeklyCalendar() {
  const t = useTranslations('weeklyCalendar');
  const {
    matches,
    loading,
    weekStartLocal,
    joiningMatchId,
    handleJoinLeave,
  } = useWeeklyMatches();

  const todayKey = getTodayKeyJST();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [swiperInstance, setSwiperInstance] = useState<SwiperType | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  // Generate day keys for the week and group matches by day and by time slot
  const { dayKeys, timeSlots, timeSlotGrid } = useMemo(() => {
    const keys: string[] = [];
    for (let i = 0; i < 7; i++) {
      keys.push(jstDateKey(weekStartLocal, i));
    }

    const timeSet = new Set<string>();
    const tsGrid: Record<string, Record<string, typeof matches>> = {};

    for (const match of matches) {
      const timeKey = getJstTimeStr(match.scheduledStart);
      const jst = new Date(new Date(match.scheduledStart).getTime() + JST_OFFSET);
      const dateKey = `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, '0')}-${String(jst.getUTCDate()).padStart(2, '0')}`;

      timeSet.add(timeKey);
      if (!tsGrid[timeKey]) tsGrid[timeKey] = {};
      if (!tsGrid[timeKey][dateKey]) tsGrid[timeKey][dateKey] = [];
      tsGrid[timeKey][dateKey].push(match);
    }

    const timeSlots = Array.from(timeSet).sort();
    return { dayKeys: keys, timeSlots, timeSlotGrid: tsGrid };
  }, [matches, weekStartLocal]);

  const todayIndex = useMemo(() => {
    const idx = dayKeys.indexOf(todayKey);
    return idx >= 0 ? idx : 0;
  }, [dayKeys, todayKey]);

  // Sync activeSlide with todayIndex on load
  useEffect(() => {
    setActiveSlide(todayIndex);
  }, [todayIndex]);

  // Desktop: auto-scroll to today
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || todayIndex < 0) return;
    requestAnimationFrame(() => {
      const timeColWidth = 56;
      const colWidth = (el.scrollWidth - timeColWidth) / 7;
      el.scrollLeft = Math.max(0, timeColWidth + colWidth * todayIndex - 16);
    });
  }, [todayIndex, loading]);

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const formatDayHeader = (dateKey: string) => {
    const d = new Date(dateKey + 'T00:00:00');
    const dayName = dayNames[d.getDay()];
    const month = d.getMonth() + 1;
    const date = d.getDate();
    return { dayName, dateStr: `${month}/${date}` };
  };

  return (
    <section className="py-6 md:py-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {/* Mobile: Swiper day view */}
            <div className="md:hidden">
              {/* Day tab bar */}
              <div className="flex items-center justify-around mb-4">
                {dayKeys.map((dateKey, i) => {
                  const isActive = i === activeSlide;
                  const isToday = dateKey === todayKey;
                  const { dayName, dateStr } = formatDayHeader(dateKey);
                  return (
                    <button
                      key={dateKey}
                      onClick={() => swiperInstance?.slideTo(i)}
                      className={cn(
                        'flex flex-col items-center gap-0.5 py-1 px-1.5 rounded-lg transition-colors',
                        isActive
                          ? isToday ? 'text-blue-300' : 'text-white'
                          : isToday ? 'text-blue-400/60' : 'text-gray-600',
                      )}
                    >
                      <span className="text-[10px] uppercase tracking-wide">{dayName}</span>
                      <span className={cn(
                        'text-sm font-medium w-8 h-8 flex items-center justify-center rounded-full transition-colors',
                        isActive && isToday && 'bg-blue-500/20',
                        isActive && !isToday && 'bg-white/10',
                      )}>
                        {dateStr}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Swiper slides */}
              <Swiper
                spaceBetween={16}
                slidesPerView={1}
                initialSlide={todayIndex}
                onSwiper={setSwiperInstance}
                onSlideChange={(swiper) => setActiveSlide(swiper.activeIndex)}
              >
                {dayKeys.map((dateKey) => {
                  const dayHasMatches = timeSlots.some(
                    (slot) => (timeSlotGrid[slot]?.[dateKey]?.length ?? 0) > 0,
                  );
                  return (
                    <SwiperSlide key={dateKey}>
                      <div className="min-h-[200px]">
                        {dayHasMatches ? (
                          <div className="space-y-3">
                            {timeSlots.map((slot) => {
                              const cellMatches = timeSlotGrid[slot]?.[dateKey];
                              if (!cellMatches || cellMatches.length === 0) return null;
                              return (
                                <div key={slot} className="flex gap-3 items-start">
                                  <div className="w-12 shrink-0 pt-2.5 text-right">
                                    <span className="text-sm font-mono text-gray-400 tabular-nums font-medium">
                                      {slot}
                                    </span>
                                  </div>
                                  <div className="flex-1 flex flex-col gap-1.5 border-l border-white/10 pl-3 pr-1">
                                    {cellMatches.map((match) => (
                                      <MatchCard
                                        key={match.id}
                                        match={match}
                                        joiningMatchId={joiningMatchId}
                                        onJoinLeave={handleJoinLeave}
                                        showTime={false}
                                        layout="horizontal"
                                      />
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-center text-sm text-gray-600 py-8">
                            {t('noMatches')}
                          </p>
                        )}
                      </div>
                    </SwiperSlide>
                  );
                })}
              </Swiper>
            </div>

            {/* Desktop: full table */}
            <div ref={scrollRef} className="hidden md:block overflow-x-auto [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb:hover]:bg-white/20">
              <table className="w-full border-separate border-spacing-0 table-fixed" style={{ minWidth: 1022 }}>
                <thead>
                  <tr>
                    <th className="w-14 border-b border-white/10" />
                    {dayKeys.map((dateKey) => {
                      const { dayName, dateStr } = formatDayHeader(dateKey);
                      const isToday = dateKey === todayKey;
                      return (
                        <th
                          key={dateKey}
                          className={cn(
                            'text-center h-14 text-sm font-medium border-b border-white/10',
                            isToday
                              ? 'bg-blue-500/10 text-blue-300'
                              : 'text-gray-400 font-normal',
                          )}
                        >
                          <div className="text-[10px] uppercase tracking-wide">{dayName}</div>
                          <div className={cn('leading-tight', isToday && 'font-bold')}>{dateStr}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {timeSlots.length > 0 ? (
                    timeSlots.map((slot) => (
                      <tr key={slot}>
                        <td className="text-right pr-2 border-t border-white/10 align-middle">
                          <span className="text-sm font-mono text-gray-500 tabular-nums">
                            {slot}
                          </span>
                        </td>
                        {dayKeys.map((dateKey) => {
                          const cellMatches = timeSlotGrid[slot]?.[dateKey];
                          const isToday = dateKey === todayKey;
                          return (
                            <td
                              key={`${slot}-${dateKey}`}
                              className={cn(
                                'border-t border-white/10 p-1 align-top',
                                isToday && 'bg-blue-500/5',
                              )}
                              style={{ minWidth: 138 }}
                            >
                              <div className="flex flex-col gap-1">
                                {cellMatches?.map((match) => (
                                  <MatchCard
                                    key={match.id}
                                    match={match}
                                    joiningMatchId={joiningMatchId}
                                    onJoinLeave={handleJoinLeave}
                                    showTime={false}
                                  />
                                ))}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="w-14 border-white/10" />
                      <td colSpan={7} className="text-center text-sm text-gray-600 py-8">
                        {t('noMatches')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
