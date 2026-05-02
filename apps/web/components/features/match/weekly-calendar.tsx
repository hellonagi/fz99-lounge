'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { useWeeklyMatches } from '@/hooks/useWeeklyMatches';
import {
  useWeeklyTournaments,
  type WeeklyTournament,
} from '@/hooks/useWeeklyTournaments';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import {
  RATED_THRESHOLDS,
  START_THRESHOLDS,
  CATEGORY_LABEL,
  CATEGORY_BADGE_CLASS,
  getMatchStatus,
} from './match-constants';
import { ThresholdBar } from './threshold-bar';
import { ParticipantAvatars } from './participant-avatars';

// ── Types ──────────────────────────────────────────────────

type MatchData = ReturnType<typeof useWeeklyMatches>['matches'][number];

type ScheduleItem =
  | { type: 'match'; data: MatchData }
  | { type: 'tournament'; data: WeeklyTournament };

interface DayGroup {
  dateKey: string;
  label: string;
  dayName: string;
  dateStr: string;
  items: ScheduleItem[];
}

// ── Helpers ────────────────────────────────────────────────

function getDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getTimeStr(isoStr: string): string {
  const d = new Date(isoStr);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function getRelativeTimeLabel(isoStr: string, matchStatus: string): string {
  if (matchStatus === 'IN_PROGRESS') return 'NOW';
  if (matchStatus === 'COMPLETED' || matchStatus === 'FINALIZED') return 'ENDED';
  const now = Date.now();
  const target = new Date(isoStr).getTime();
  const diffMs = target - now;
  if (diffMs <= 0) return 'NOW';
  const totalSecs = Math.floor(diffMs / 1000);
  if (totalSecs < 60) return `IN ${totalSecs}S`;
  const mins = Math.floor(totalSecs / 60);
  if (mins < 60) return `IN ${mins}M`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `IN ${h}H` : `IN ${h}H ${m}M`;
}

// ── LiveDot ────────────────────────────────────────────────

function LiveDot() {
  return (
    <span className="relative flex h-1.5 w-1.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-400" />
    </span>
  );
}

// ── ScheduleRow ────────────────────────────────────────────

function ScheduleRow({
  match,
  joiningMatchId,
  onJoinLeave,
}: {
  match: MatchData;
  joiningMatchId: number | null;
  onJoinLeave: (matchId: number) => void;
}) {
  const t = useTranslations('weeklyCalendar');
  const locale = useLocale();
  const { isAuthenticated, user } = useAuthStore();

  const category = match.season?.event?.category;
  const current = match.currentPlayers ?? match.participants.length;
  const rated = RATED_THRESHOLDS[category] ?? match.minPlayers;
  const startThreshold = START_THRESHOLDS[category] ?? match.minPlayers;
  const status = getMatchStatus(
    current,
    match.minPlayers,
    rated,
    match.maxPlayers,
  );
  const isInMatch =
    isAuthenticated && user
      ? match.participants.some((p) => p.userId === user.id)
      : false;
  const isJoining = joiningMatchId === match.id;
  const isWaiting = match.status === 'WAITING';
  const isInProgress = match.status === 'IN_PROGRESS';
  const isFinished =
    match.status === 'COMPLETED' || match.status === 'FINALIZED';
  const timeStr = getTimeStr(match.scheduledStart);
  const relativeLabel = getRelativeTimeLabel(match.scheduledStart, match.status);

  const matchUrl = match.matchNumber
    ? `/${locale}/matches/${category.toLowerCase()}/${match.season.seasonNumber === -1 ? 'unrated' : match.season.seasonNumber}/${match.matchNumber}`
    : null;

  // Status display
  const statusLabel =
    status === 'rated' || status === 'full'
      ? t('rated')
      : status === 'matchOn'
        ? t('matchOn')
        : t('pending');
  const statusColor =
    status === 'rated' || status === 'full'
      ? 'text-emerald-400'
      : status === 'matchOn'
        ? 'text-amber-400'
        : 'text-gray-500';

  // CTA
  const ctaLabel = status === 'full' ? t('full') : t('join');

  const ctaButtonClass = cn(
    'w-[100px] py-2 rounded-[5px] text-[10px] font-extrabold tracking-[.12em] whitespace-nowrap transition-colors cursor-pointer text-center',
    isJoining && 'opacity-50 animate-pulse pointer-events-none',
  );

  const ctaStyle = isInMatch
    ? 'bg-blue-500/30 border border-blue-500/50 text-blue-300 hover:bg-red-500/25 hover:border-red-500/50 hover:text-red-300'
    : status === 'full'
      ? 'bg-transparent border border-white/[.07] text-gray-500 cursor-not-allowed'
      : 'bg-emerald-500/[.25] border border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/35';

  // Row highlight
  const isJoinedWaiting = isInMatch && isWaiting;

  return (
    <div
      className={cn(
        'transition-all',
        'border-b border-white/[.07]',
        'border-l-2',
        isInProgress
          ? 'border-l-red-500/60'
          : isJoinedWaiting
            ? 'border-l-emerald-500/60'
            : 'border-l-transparent',
      )}
      style={
        isInProgress
          ? { background: 'linear-gradient(90deg, rgba(239,68,68,.07), transparent 60%)' }
          : isFinished
            ? { background: 'linear-gradient(90deg, rgba(0,0,0,.3), transparent 60%)' }
            : isJoinedWaiting
              ? { background: 'linear-gradient(90deg, rgba(16,185,129,.07), transparent 60%)' }
              : undefined
      }
    >
      {/* Desktop */}
      <div className="hidden md:grid grid-cols-[76px_1fr_130px] gap-x-3.5 items-center py-4 px-5">
        {/* Time column */}
        <div>
          <div className="text-lg font-bold font-mono tabular-nums text-gray-200">
            {timeStr}
          </div>
          <div
            className="text-[9px] font-bold tracking-[.1em] mt-0.5 text-gray-500"
          >
            {relativeLabel}
          </div>
        </div>

        {/* Center column */}
        <div>
          {/* Line 1: category badge + full name + status */}
          <div className="flex items-center gap-2.5 mb-2">
            <span
              className={cn(
                'text-[10px] font-extrabold tracking-[.1em] px-1.5 py-0.5 border rounded-[3px] bg-black/20',
                CATEGORY_BADGE_CLASS[category] || 'text-gray-400 border-gray-500/50',
              )}
            >
              {CATEGORY_LABEL[category] || category}
            </span>
            {(isWaiting || isInProgress) && (
              <span className={cn('text-[10px] font-bold tracking-[.12em]', statusColor)}>
                ● {statusLabel}
              </span>
            )}
            {isFinished && (
              <span className="text-[10px] font-bold tracking-[.12em] text-gray-600">
                {t('ended')}
              </span>
            )}
          </div>

          {/* Line 2: threshold bar */}
          <ThresholdBar
            current={current}
            startThreshold={startThreshold}
            rated={rated}
            max={match.maxPlayers}
            status={status}
          />

          {/* Line 3: avatars */}
          <div className="flex items-center gap-3.5 mt-2">
            <ParticipantAvatars participants={match.participants} />
          </div>
        </div>

        {/* CTA column */}
        <div className="text-right">
          {isInProgress && matchUrl && (
            <Link
              href={matchUrl}
              className={cn(
                ctaButtonClass,
                'inline-block bg-red-500/20 border border-red-500/40 text-red-400',
              )}
            >
              ● {t('inProgress')}
            </Link>
          )}
          {isFinished && matchUrl && (
            <Link
              href={matchUrl}
              className={cn(
                ctaButtonClass,
                'inline-block bg-white/[.06] border border-white/[.10] text-gray-300 hover:bg-white/[.10] hover:text-gray-200 hover:border-white/[.18]',
              )}
            >
              {t('result')}
            </Link>
          )}
          {isWaiting && (
            <button
              onClick={() =>
                isAuthenticated
                  ? onJoinLeave(match.id)
                  : alert(t('loginToJoin'))
              }
              disabled={isJoining || (!isInMatch && status === 'full')}
              className={cn(ctaButtonClass, ctaStyle, isInMatch && 'group/cta')}
            >
              {isInMatch ? (
                <>
                  <span className="group-hover/cta:hidden">{t('joined')}</span>
                  <span className="hidden group-hover/cta:inline text-red-400">{t('cancel')}</span>
                </>
              ) : ctaLabel}
            </button>
          )}
        </div>
      </div>

      {/* Mobile */}
      <div className="md:hidden px-4 py-3 space-y-2">
        {/* Top: time + category + status + count */}
        <div className="flex items-center gap-2">
          <div className="shrink-0">
            <div className="text-lg font-bold font-mono tabular-nums text-gray-200">
              {timeStr}
            </div>
            <div
              className={cn(
                'text-[9px] font-bold tracking-[.1em] mt-0.5',
                'text-gray-500',
              )}
            >
              {relativeLabel}
            </div>
          </div>
          <span
            className={cn(
              'text-[10px] font-extrabold tracking-[.1em] px-1.5 py-0.5 border rounded-[3px] bg-black/20',
              CATEGORY_BADGE_CLASS[category] || 'text-gray-400 border-gray-500/50',
            )}
          >
            {CATEGORY_LABEL[category] || category}
          </span>
          {(isWaiting || isInProgress) && (
            <span className={cn('text-[10px] font-bold tracking-[.12em]', statusColor)}>
              ● {statusLabel}
            </span>
          )}
          {isFinished && (
            <span className="text-[10px] font-bold tracking-[.12em] text-gray-600">
              {t('ended')}
            </span>
          )}
        </div>

        {/* Threshold bar */}
        <ThresholdBar
          current={current}
          startThreshold={startThreshold}
          rated={rated}
          max={match.maxPlayers}
          status={status}
        />

        {/* Avatars */}
        <div className="flex items-center gap-2">
          <ParticipantAvatars participants={match.participants} />
        </div>

        {/* CTA button (full-width) */}
        {isInProgress && matchUrl && (
          <Link
            href={matchUrl}
            className={cn(
              ctaButtonClass,
              'block text-center bg-red-500/20 border border-red-500/40 text-red-400',
            )}
          >
            ● {t('inProgress')}
          </Link>
        )}
        {isFinished && matchUrl && (
          <Link
            href={matchUrl}
            className={cn(
              ctaButtonClass,
              'block text-center bg-white/[.06] border border-white/[.10] text-gray-300 hover:bg-white/[.10] hover:text-gray-200 hover:border-white/[.18]',
            )}
          >
            {t('result')}
          </Link>
        )}
        {isWaiting && (
          <button
            onClick={() =>
              isAuthenticated
                ? onJoinLeave(match.id)
                : alert(t('loginToJoin'))
            }
            disabled={isJoining || (!isInMatch && status === 'full')}
            className={cn(ctaButtonClass, ctaStyle, 'w-full')}
          >
            {isInMatch ? t('joined') : ctaLabel}
          </button>
        )}
      </div>
    </div>
  );
}

// ── TournamentRow ──────────────────────────────────────────

function TournamentRow({ tournament }: { tournament: WeeklyTournament }) {
  const t = useTranslations('weeklyCalendar');
  const locale = useLocale();
  const isLive = tournament.status === 'IN_PROGRESS';
  const isDone = tournament.status === 'COMPLETED';
  const timeStr = getTimeStr(tournament.tournamentDate);
  const relativeLabel = getRelativeTimeLabel(
    tournament.tournamentDate,
    tournament.status,
  );
  const url = `/${locale}/tournament/${tournament.id}`;

  const ctaButtonClass =
    'py-2 px-3.5 rounded-[5px] text-[10px] font-extrabold tracking-[.12em] whitespace-nowrap transition-colors cursor-pointer inline-block';

  const btnStyle = isLive
    ? 'bg-red-500/20 border border-red-500/40 text-red-400'
    : isDone
      ? 'bg-transparent border border-white/[.07] text-gray-500'
      : 'bg-amber-400 border-0 text-[#0a0e16]';

  return (
    <div
      className={cn(
        'border-b border-white/[.07] border-l-2 border-l-transparent transition-all',
        isDone && 'opacity-35',
      )}
    >
      {/* Desktop */}
      <div className="hidden md:grid grid-cols-[76px_1fr_130px] gap-x-3.5 items-center py-4 px-5">
        <div>
          <div className="text-lg font-bold font-mono tabular-nums text-gray-200">
            {timeStr}
          </div>
          <div
            className={cn(
              'text-[9px] font-bold tracking-[.1em] mt-0.5',
              isLive ? 'text-red-400' : 'text-gray-500',
            )}
          >
            {relativeLabel}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <span className="text-[10px] font-extrabold tracking-[.1em] px-1.5 py-0.5 border rounded-[3px] bg-black/20 text-amber-400 border-amber-500/50">
              TRN
            </span>
            <span className="text-xs font-bold text-gray-200">
              {t('tournament')}
            </span>
            {isLive && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-[.12em] text-red-400">
                <LiveDot />
                LIVE
              </span>
            )}
          </div>
          <div className="flex items-center gap-3.5 mt-2">
            <span className="font-mono tabular-nums text-xs text-gray-500">
              {tournament.registrationCount}/{tournament.maxPlayers}
            </span>
          </div>
        </div>

        <div className="text-right">
          <Link href={url} className={cn(ctaButtonClass, btnStyle)}>
            {isLive ? `● ${t('inProgress')}` : isDone ? t('result') : t('entry')}
          </Link>
        </div>
      </div>

      {/* Mobile */}
      <div className="md:hidden px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="shrink-0">
            <div className="text-lg font-bold font-mono tabular-nums text-gray-200">
              {timeStr}
            </div>
            <div
              className={cn(
                'text-[9px] font-bold tracking-[.1em] mt-0.5',
                isLive ? 'text-red-400' : 'text-gray-500',
              )}
            >
              {relativeLabel}
            </div>
          </div>
          <span className="text-[10px] font-extrabold tracking-[.1em] px-1.5 py-0.5 border rounded-[3px] bg-black/20 text-amber-400 border-amber-500/50">
            TRN
          </span>
          <span className="text-xs font-bold text-gray-200">
            {t('tournament')}
          </span>
          <span className="font-mono tabular-nums text-xs text-gray-500 ml-auto">
            {tournament.registrationCount}/{tournament.maxPlayers}
          </span>
        </div>
        <Link href={url} className={cn(ctaButtonClass, btnStyle, 'block text-center w-full')}>
          {isLive ? `● ${t('inProgress')}` : isDone ? t('result') : t('entry')}
        </Link>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────

export function WeeklyCalendar() {
  const t = useTranslations('weeklyCalendar');
  const { matches, loading, weekStartLocal, joiningMatchId, handleJoinLeave } =
    useWeeklyMatches();
  const { tournaments, loading: tournamentsLoading } = useWeeklyTournaments();

  const isLoading = loading || tournamentsLoading;
  const [showAll, setShowAll] = useState(false);

  // Tick every second to keep relative time labels fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    let id: ReturnType<typeof setTimeout>;
    const tick = () => {
      setTick((v) => v + 1);
      id = setTimeout(tick, 1000 - (Date.now() % 1000));
    };
    id = setTimeout(tick, 1000 - (Date.now() % 1000));
    return () => clearTimeout(id);
  }, []);

  // Build day groups
  const dayGroups = useMemo(() => {
    const now = new Date();
    const todayKey = getDateKey(now);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowKey = getDateKey(tomorrow);

    const dayNameLabels = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    const keys: string[] = [];
    const itemsByDate: Record<string, ScheduleItem[]> = {};

    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStartLocal.getTime());
      d.setDate(d.getDate() + i);
      const dk = getDateKey(d);
      keys.push(dk);
      itemsByDate[dk] = [];
    }

    for (const m of matches) {
      const dk = getDateKey(new Date(m.scheduledStart));
      if (itemsByDate[dk]) {
        itemsByDate[dk].push({ type: 'match', data: m });
      }
    }

    for (const tour of tournaments) {
      const dk = getDateKey(new Date(tour.tournamentDate));
      if (itemsByDate[dk]) {
        itemsByDate[dk].push({ type: 'tournament', data: tour });
      }
    }

    const groups: DayGroup[] = keys.map((dk) => {
      const d = new Date(dk + 'T00:00:00');
      const dayName = dayNameLabels[d.getDay()];
      const month = d.getMonth() + 1;
      const date = d.getDate();

      let label: string;
      if (dk === todayKey) label = t('today');
      else if (dk === tomorrowKey) label = t('tomorrow');
      else label = dayName;

      const items = (itemsByDate[dk] || []).sort((a, b) => {
        const ta =
          a.type === 'match' ? a.data.scheduledStart : a.data.tournamentDate;
        const tb =
          b.type === 'match' ? b.data.scheduledStart : b.data.tournamentDate;
        return new Date(ta).getTime() - new Date(tb).getTime();
      });

      return { dateKey: dk, label, dayName, dateStr: `${month}/${date}`, items };
    });

    return groups;
  }, [matches, tournaments, weekStartLocal, t]);

  return (
    <section className="py-6 md:py-16">
      <div className="max-w-6xl mx-auto sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="border border-white/[.07] sm:rounded-lg overflow-hidden">
            {(() => {
              const now = new Date();
              const todayKey = getDateKey(now);
              const tomorrow = new Date(now);
              tomorrow.setDate(tomorrow.getDate() + 1);
              const tomorrowKey = getDateKey(tomorrow);

              const visibleGroups = showAll
                ? dayGroups
                : dayGroups.filter(
                    (g) => g.dateKey === todayKey || g.dateKey === tomorrowKey,
                  );
              const hiddenCount = dayGroups.length - visibleGroups.length;

              return (
                <>
                  {visibleGroups.map((group) => {
                    const hasItems = group.items.length > 0;
                    return (
                      <div key={group.dateKey}>
                        <div className="sticky top-0 z-10 bg-white/[.04] backdrop-blur-sm border-b border-white/[.07] py-2.5 px-5">
                          <div className="flex items-center">
                            <span className="text-[11px] font-extrabold tracking-[.15em] uppercase text-gray-400">
                              {group.label !== group.dayName
                                ? `${group.label} ${group.dayName} ${group.dateStr}`
                                : `${group.dayName} ${group.dateStr}`}
                            </span>
                          </div>
                        </div>

                        {hasItems ? (
                          <div>
                            {group.items.map((item) =>
                              item.type === 'tournament' ? (
                                <TournamentRow
                                  key={`t-${item.data.id}`}
                                  tournament={item.data}
                                />
                              ) : (
                                <ScheduleRow
                                  key={`m-${item.data.id}`}
                                  match={item.data}
                                  joiningMatchId={joiningMatchId}
                                  onJoinLeave={handleJoinLeave}
                                />
                              ),
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-700 py-3">
                            {t('noMatches')}
                          </p>
                        )}
                      </div>
                    );
                  })}
                  {!showAll && hiddenCount > 0 && (
                    <button
                      onClick={() => setShowAll(true)}
                      className="w-full py-3 text-[11px] font-bold tracking-[.12em] text-gray-400 hover:text-gray-300 border-t border-white/[.07] bg-white/[.02] hover:bg-white/[.04] transition-colors cursor-pointer"
                    >
                      ▼
                    </button>
                  )}
                  {showAll && (
                    <button
                      onClick={() => setShowAll(false)}
                      className="w-full py-3 text-[11px] font-bold tracking-[.12em] text-gray-500 hover:text-gray-400 border-t border-white/[.07] bg-white/[.02] hover:bg-white/[.04] transition-colors cursor-pointer"
                    >
                      ▲
                    </button>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>
    </section>
  );
}
