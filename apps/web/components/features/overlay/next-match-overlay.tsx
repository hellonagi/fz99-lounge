'use client';

import { useEffect, useRef, useState } from 'react';
import {
  RATED_THRESHOLDS,
  START_THRESHOLDS,
  CATEGORY_COLOR,
  getMatchStatus,
  type MatchStatus,
} from '@/components/features/match/match-constants';
interface Participant {
  userId: number;
  user: {
    id: number;
    discordId: string;
    displayName: string | null;
    avatarHash: string | null;
  };
  rank?: number | null;
  country?: string | null;
  displayRating?: number | null;
  liveScore?: number | null;
  liveStatus?: string | null;
}

interface NextMatchOverlayProps {
  category?: string;
  season?: number;
  match?: number;
  league?: string | null;
  currentPlayers?: number;
  minPlayers?: number;
  maxPlayers?: number;
  scheduledStart?: string;
  timeOffset?: number;
  isInProgress?: boolean;
  participants?: Participant[];
  errorMessage?: string;
  lang?: 'en' | 'ja';
  forcePhase?: Phase;
}

const COPY = {
  en: {
    startsIn: 'STARTS IN',
    inProgress: 'LIVE',
    pending: 'PENDING',
    matchOn: 'MATCH ON',
    rated: 'RATED',
    full: 'FULL',
    needMore: (n: number) => `${n} more to start`,
    matchConfirmed: 'Match confirmed',
    ratedMatch: 'Rated match',
    noMatch: 'No upcoming match',
    waitForNext: 'Wait for the next one',
    matchFound: 'GRID SET',
    matchFoundSub: 'Players locked in',
    racers: 'RACERS',
  },
  ja: {
    startsIn: '開始まで',
    inProgress: '進行中',
    pending: '待機中',
    matchOn: '開催決定',
    rated: 'レート戦',
    full: '満員',
    needMore: (n: number) => `あと${n}人で開催`,
    matchConfirmed: '開催決定',
    ratedMatch: 'レート戦',
    noMatch: '次の試合はまだです',
    waitForNext: 'お待ちください',
    matchFound: 'GRID SET',
    matchFoundSub: '出走者確定',
    racers: '出走者',
  },
};

function getHeroTitle(category?: string, league?: string | null) {
  const cat = category?.toLowerCase();
  if (cat === 'classic') return 'CLASSIC MINI';
  if (cat === 'team_classic') return 'TEAM CLASSIC';
  if (cat === 'team_gp') return league ? `TEAM ${league} GP` : 'TEAM GP';
  if (cat === 'gp') return league ? `${league} GP` : 'GRAND PRIX';
  return league ? `${league} LEAGUE` : 'NEXT MATCH';
}

function CompactTimer({
  scheduledStart,
  timeOffset = 0,
}: {
  scheduledStart: string;
  timeOffset?: number;
}) {
  const calc = () => {
    const now = Date.now() + timeOffset;
    const start = new Date(scheduledStart).getTime();
    return Math.max(0, Math.floor((start - now) / 1000));
  };
  const [timeLeft, setTimeLeft] = useState(calc);

  useEffect(() => {
    setTimeLeft(calc());
    const id = setInterval(() => setTimeLeft(calc()), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduledStart, timeOffset]);

  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');

  return (
    <div className="inline-flex items-center gap-1 tabular-nums leading-none">
      {hours > 0 && (
        <>
          <span className="text-4xl font-extrabold">{pad(hours)}</span>
          <span className="text-3xl font-thin opacity-50 animate-colon-blink">:</span>
        </>
      )}
      <span className="text-4xl font-extrabold">{pad(minutes)}</span>
      <span className="text-3xl font-thin opacity-50 animate-colon-blink">:</span>
      <span className="text-4xl font-extrabold">{pad(seconds)}</span>
    </div>
  );
}

function OverlayThresholdBar({
  current,
  startThreshold,
  rated,
  max,
  status,
  copy,
}: {
  current: number;
  startThreshold: number;
  rated: number;
  max: number;
  status: MatchStatus;
  copy: typeof COPY['en'];
}) {
  let rangeMin: number;
  let rangeMax: number;
  let label: string;
  let color: string;

  if (status === 'pending') {
    rangeMin = 0;
    rangeMax = startThreshold;
    label = 'Min';
    color = '#7a8093';
  } else if (status === 'matchOn') {
    rangeMin = startThreshold;
    rangeMax = rated;
    label = 'Rated';
    color = '#fbbf24';
  } else {
    rangeMin = rated;
    rangeMax = max;
    label = String(max);
    color = '#34d399';
  }

  const clamped = Math.max(rangeMin, Math.min(current, rangeMax));
  const span = rangeMax - rangeMin;
  const progress = span > 0 ? ((clamped - rangeMin) / span) * 100 : 0;
  const goalReached = current >= rangeMax;
  const remaining = rangeMax - clamped;

  const message = (() => {
    if (status === 'pending') {
      return goalReached ? copy.matchConfirmed : copy.needMore(remaining);
    }
    if (status === 'matchOn') {
      return goalReached ? copy.ratedMatch : copy.matchConfirmed;
    }
    return goalReached ? copy.full : copy.matchConfirmed;
  })();

  const messageColor = (() => {
    if (status === 'pending') return goalReached ? '#fbbf24' : '#9ca3af';
    if (status === 'matchOn') return goalReached ? '#34d399' : '#fbbf24';
    return goalReached ? '#9ca3af' : '#34d399';
  })();

  return (
    <div className="w-full">
      <div
        className="relative h-1.5 rounded-[3px]"
        style={{ background: 'rgba(255,255,255,.08)' }}
      >
        <div
          className="absolute left-0 top-0 bottom-0 rounded-[3px] transition-[width] duration-500 ease-out"
          style={{
            width: `${progress}%`,
            background: color,
            boxShadow: `0 0 6px ${color}aa`,
          }}
        />
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10px] font-bold tracking-wide" style={{ color: messageColor }}>
          {message}
        </span>
        <span
          className="text-[10px] font-bold tracking-wide"
          style={{ color: goalReached ? color : '#7a8093' }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

function PlayerRow({
  participant,
  index,
  animate,
  showLive,
  position,
}: {
  participant: Participant;
  index: number;
  animate: boolean;
  showLive: boolean;
  position?: number;
}) {
  const name = participant.user.displayName || '???';
  const country = participant.country?.toLowerCase();
  const rating = participant.displayRating;
  const liveScore = participant.liveScore;
  const hasSubmitted = liveScore !== null && liveScore !== undefined;

  return (
    <div
      className={`flex items-center gap-1.5 min-w-0 px-1.5 py-px ${
        animate ? 'animate-player-pop-in' : ''
      }`}
      style={animate ? { animationDelay: `${index * 60}ms` } : undefined}
    >
      <span
        className={`fi fi-${country || 'un'} shrink-0 rounded-sm overflow-hidden`}
        style={{
          width: 16,
          height: 12,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          boxShadow: '0 0 0 1px rgba(0,0,0,.4)',
        }}
      />
      <span
        className="flex-1 min-w-0 text-[11px] font-bold text-white truncate"
        style={{ textShadow: '0 1px 2px rgba(0,0,0,.6)', lineHeight: 1.4 }}
      >
        {name}
      </span>
      {showLive ? (
        <span
          className="shrink-0 text-[10px] font-bold tabular-nums min-w-[28px] text-right"
          style={{
            color: hasSubmitted ? '#ffffff' : '#6b7280',
            lineHeight: 1.4,
          }}
        >
          {hasSubmitted ? liveScore : '–'}
        </span>
      ) : rating ? (
        <span
          className="shrink-0 text-[10px] font-bold text-gray-300 tabular-nums min-w-[28px] text-right"
          style={{ lineHeight: 1.4 }}
        >
          {rating}
        </span>
      ) : null}
    </div>
  );
}

export type Phase = 'idle' | 'flash' | 'reveal' | 'roster';

export function NextMatchOverlay({
  category,
  season,
  match,
  league,
  currentPlayers,
  minPlayers,
  maxPlayers,
  scheduledStart,
  timeOffset = 0,
  isInProgress = false,
  participants,
  errorMessage,
  lang = 'en',
  forcePhase,
}: NextMatchOverlayProps) {
  const copy = COPY[lang];
  const categoryKey = category?.toUpperCase() ?? '';
  const current = currentPlayers ?? 0;
  const max = maxPlayers ?? 12;
  const rated = RATED_THRESHOLDS[categoryKey] ?? minPlayers ?? max;
  const startThreshold = START_THRESHOLDS[categoryKey] ?? minPlayers ?? 4;
  const status = getMatchStatus(current, startThreshold, rated, max);
  const catColor =
    CATEGORY_COLOR[categoryKey] ?? { color: '#6b7280', soft: 'rgba(107,114,128,.18)' };

  const seasonLabel =
    season !== undefined && season !== -1
      ? `SEASON ${season} #${match}`
      : season === -1
        ? `UNRATED #${match}`
        : null;

  const heroTitle = getHeroTitle(category, league);

  const [phaseState, setPhase] = useState<Phase>(isInProgress ? 'roster' : 'idle');
  const prevInProgress = useRef(isInProgress);

  useEffect(() => {
    if (prevInProgress.current === isInProgress) return;
    prevInProgress.current = isInProgress;

    if (isInProgress) {
      setPhase('flash');
      const t1 = setTimeout(() => setPhase('reveal'), 1900);
      const t2 = setTimeout(() => setPhase('roster'), 3200);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    } else {
      setPhase('idle');
    }
  }, [isInProgress]);

  const phase: Phase = forcePhase ?? phaseState;
  const showAnimation = phase === 'flash' || phase === 'reveal';

  const playerCount = participants?.length ?? 0;
  // Show up to ~10 players in a single column list; overflow as "+N more"
  const maxVisible = 10;

  // Detect if any participant has submitted live results.
  // When true, sort by liveScore desc and show match positions.
  const showLive = !!participants?.some(
    (p) => p.liveScore !== null && p.liveScore !== undefined,
  );
  const sortedParticipants = participants
    ? [...participants].sort((a, b) => {
        if (!showLive) return 0;
        const aHas = a.liveScore !== null && a.liveScore !== undefined;
        const bHas = b.liveScore !== null && b.liveScore !== undefined;
        if (aHas && !bHas) return -1;
        if (!aHas && bHas) return 1;
        if (aHas && bHas) return (b.liveScore ?? 0) - (a.liveScore ?? 0);
        return 0;
      })
    : [];
  const visibleParticipants = sortedParticipants.slice(0, maxVisible);
  const overflow = playerCount - visibleParticipants.length;

  return (
    <div
      className={`relative overflow-hidden flex flex-col ${phase === 'flash' ? 'animate-overlay-shake' : ''}`}
      style={
        {
          width: 250,
          height: 300,
          background:
            'linear-gradient(180deg, rgba(15,17,25,.78) 0%, rgba(8,10,18,.86) 100%)',
          border: `1px solid ${catColor.color}55`,
          borderRadius: 12,
          boxShadow: `0 0 24px ${catColor.color}33, inset 0 0 40px ${catColor.soft}`,
          ['--cat-color' as string]: catColor.color,
          ['--cat-soft' as string]: catColor.soft,
        } as React.CSSProperties
      }
    >
      {/* Category accent stripe */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px] z-20"
        style={{ background: catColor.color, boxShadow: `0 0 12px ${catColor.color}` }}
      />

      {/* Radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(180px 110px at 50% 0%, ${catColor.soft}, transparent 75%)`,
        }}
      />

      {/* Match-found flash + sweep overlays */}
      {phase === 'flash' && (
        <>
          <div
            className="absolute inset-0 z-30 pointer-events-none animate-overlay-flash"
            style={{ background: '#fff' }}
          />
          <div
            className="absolute inset-y-0 -left-[40%] w-1/2 z-30 pointer-events-none animate-scan-sweep"
            style={{
              background:
                'linear-gradient(110deg, transparent 0%, rgba(255,255,255,.5) 50%, transparent 100%)',
              filter: 'blur(2px)',
              transform: 'skewX(-20deg)',
            }}
          />
        </>
      )}

      {/* Match-found centered text overlay */}
      {showAnimation && (
        <div
          className="absolute inset-0 z-40 flex flex-col items-center justify-center pointer-events-none"
          style={{ background: 'radial-gradient(closest-side, rgba(0,0,0,.5), transparent 80%)' }}
        >
          <div
            className={`text-3xl font-black tracking-[.18em] text-white ${
              phase === 'flash' ? 'animate-match-found-in' : 'animate-match-found-out'
            }`}
            style={{
              textShadow: `0 0 12px ${catColor.color}, 0 0 24px ${catColor.color}88`,
            }}
          >
            {copy.matchFound}
          </div>
          {phase === 'flash' && copy.matchFoundSub && (
            <div
              className="mt-1.5 text-[13px] font-bold tracking-[.2em] text-gray-200 animate-match-found-sub-in"
              style={{ textShadow: '0 1px 4px rgba(0,0,0,.8)' }}
            >
              {copy.matchFoundSub}
            </div>
          )}
        </div>
      )}

      <div className="relative z-10 flex-1 min-h-0 flex flex-col px-4 pt-3 pb-2 text-center">
        {errorMessage ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="text-lg font-extrabold text-white mb-2">{copy.noMatch}</div>
            <div className="text-[13px] text-gray-400">{copy.waitForNext}</div>
          </div>
        ) : phase === 'roster' || phase === 'reveal' ? (
          // ── In-progress / reveal: player list ────────────────────
          <>
            <div>
              {seasonLabel && (
                <div
                  className="text-[10px] font-semibold uppercase tracking-[.18em]"
                  style={{ color: catColor.color }}
                >
                  {seasonLabel}
                </div>
              )}
              <h1 className="text-xl font-extrabold text-white mt-0.5 leading-tight">
                {heroTitle}
              </h1>
            </div>

            <div className="flex-1 flex flex-col gap-px mt-1.5 overflow-hidden">
              {visibleParticipants.map((p, i) => (
                <PlayerRow
                  key={p.userId}
                  participant={p}
                  index={i}
                  animate={phase === 'reveal'}
                  showLive={showLive}
                  position={i + 1}
                />
              ))}
              {overflow > 0 && !showLive && (
                <div className="text-[10px] text-gray-400 font-bold text-center mt-0.5">
                  +{overflow} more
                </div>
              )}
            </div>
          </>
        ) : (
          // ── Idle / waiting ───────────────────────────────────────
          <div className="flex-1 flex flex-col justify-between">
            <div>
              {seasonLabel && (
                <div
                  className="text-[10px] font-semibold uppercase tracking-[.18em]"
                  style={{ color: catColor.color }}
                >
                  {seasonLabel}
                </div>
              )}
              <h1 className="text-xl font-extrabold text-white mt-0.5 leading-tight">
                {heroTitle}
              </h1>
            </div>

            <div className="flex flex-col items-center gap-1">
              <div className="text-[10px] tracking-[.2em] text-gray-300">{copy.startsIn}</div>
              {scheduledStart && (
                <CompactTimer scheduledStart={scheduledStart} timeOffset={timeOffset} />
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              {currentPlayers !== undefined && (
                <OverlayThresholdBar
                  current={current}
                  startThreshold={startThreshold}
                  rated={rated}
                  max={max}
                  status={status}
                  copy={copy}
                />
              )}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-[.15em] text-gray-400">
                  PLAYERS
                </span>
                <span className="text-sm font-extrabold tabular-nums text-white">
                  {current}
                  <span className="text-gray-500 font-bold">/{max}</span>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div
        className="relative z-50 px-4 py-1.5 text-center text-[11px] font-bold tracking-[.2em]"
        style={{
          color: '#9ca3af',
          borderTop: '1px solid rgba(255,255,255,.06)',
          background: 'rgba(0,0,0,.6)',
        }}
      >
        fz99lounge.com
      </div>
    </div>
  );
}
