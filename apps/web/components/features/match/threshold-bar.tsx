'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { type MatchStatus } from './match-constants';

function getRange(
  status: MatchStatus,
  startThreshold: number,
  rated: number,
  max: number,
) {
  if (status === 'pending') {
    return { min: 0, max: startThreshold, label: 'Min', color: '#7a8093' };
  }
  if (status === 'matchOn') {
    return { min: startThreshold, max: rated, label: 'Rated', color: '#fbbf24' };
  }
  // rated | full
  return { min: rated, max: max, label: String(max), color: '#34d399' };
}

interface ThresholdBarProps {
  current: number;
  startThreshold: number;
  rated: number;
  max: number;
  status: MatchStatus;
  variant?: 'compact' | 'hero';
}

export function ThresholdBar({
  current,
  startThreshold,
  rated,
  max,
  status,
  variant = 'compact',
}: ThresholdBarProps) {
  if (variant === 'hero') {
    return (
      <HeroThresholdBar
        current={current}
        startThreshold={startThreshold}
        rated={rated}
        max={max}
        status={status}
      />
    );
  }

  return (
    <CompactThresholdBar
      current={current}
      startThreshold={startThreshold}
      rated={rated}
      max={max}
      status={status}
    />
  );
}

/* ── Compact: original full-range bar (for weekly calendar) ── */

function CompactThresholdBar({
  current,
  startThreshold,
  rated,
  max,
  status,
}: Omit<ThresholdBarProps, 'variant'>) {
  const pct = (n: number) => (n / max) * 100;
  const fillPct = Math.min(pct(current), 100);
  const startPct = pct(startThreshold);
  const ratedPct = pct(rated);

  const fillColor =
    status === 'rated' || status === 'full'
      ? '#34d399'
      : status === 'matchOn'
        ? '#fbbf24'
        : '#7a8093';

  const startReached = current >= startThreshold;
  const ratedReached = current >= rated;

  return (
    <div className="relative mb-3.5">
      {/* Bar */}
      <div className="relative h-2 rounded-[3px]" style={{ background: 'rgba(255,255,255,.05)' }}>
        {/* Background segments */}
        <div className="absolute inset-0 rounded-[3px] overflow-hidden flex">
          <div
            style={{
              width: `${startPct}%`,
              background: startReached ? 'rgba(251,191,36,.45)' : 'rgba(255,255,255,.04)',
            }}
          />
          <div
            style={{
              width: `${ratedPct - startPct}%`,
              background: ratedReached
                ? 'rgba(52,211,153,.5)'
                : startReached
                  ? 'rgba(251,191,36,.22)'
                  : 'rgba(255,255,255,.04)',
            }}
          />
          <div
            style={{
              flex: 1,
              background: ratedReached ? 'rgba(52,211,153,.28)' : 'rgba(255,255,255,.04)',
            }}
          />
        </div>
        {/* Fill overlay */}
        <div
          className="absolute left-0 top-0 bottom-0 rounded-l-[3px] transition-all duration-500"
          style={{
            width: `${fillPct}%`,
            background: fillColor,
            boxShadow: `0 0 8px ${fillColor}aa`,
          }}
        />
        {/* Gate markers */}
        {[
          { at: startThreshold, color: startReached ? '#fbbf24' : 'rgba(255,255,255,.25)' },
          { at: rated, color: ratedReached ? '#34d399' : 'rgba(255,255,255,.25)' },
          { at: max, color: current >= max ? '#7a8093' : 'rgba(255,255,255,.25)' },
        ].map((g) => (
          <div
            key={g.at}
            className="absolute"
            style={{
              left: `${pct(g.at)}%`,
              top: -2,
              bottom: -2,
              transform: 'translateX(-50%)',
            }}
          >
            <div style={{ width: 2, height: '100%', background: g.color }} />
          </div>
        ))}
      </div>
      {/* Gate labels */}
      <div className="relative">
        {[
          { at: startThreshold, label: 'Min', reached: startReached, color: '#fbbf24' },
          { at: rated, label: 'Rated', reached: ratedReached, color: '#34d399' },
          { at: max, label: String(max), reached: current >= max, color: '#7a8093' },
        ].map((g) => (
          <span
            key={g.at}
            className="absolute text-[9px] font-bold tracking-[.05em]"
            style={{
              left: `${pct(g.at)}%`,
              transform: 'translateX(-50%)',
              top: 4,
              color: g.reached ? g.color : '#7a8093',
              opacity: g.reached ? 1 : 0.7,
            }}
          >
            {g.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Hero: progressive single-range bar (for match hero) ── */

function HeroThresholdBar({
  current,
  startThreshold,
  rated,
  max,
  status,
}: Omit<ThresholdBarProps, 'variant'>) {
  const t = useTranslations('matchHero');
  const prevStatusRef = useRef(status);
  const [transitioning, setTransitioning] = useState(false);
  const [displayStatus, setDisplayStatus] = useState(status);

  useEffect(() => {
    if (prevStatusRef.current !== status) {
      prevStatusRef.current = status;
      setTransitioning(true);
      const timer = setTimeout(() => {
        setDisplayStatus(status);
        setTransitioning(false);
      }, 200);
      return () => clearTimeout(timer);
    } else {
      setDisplayStatus(status);
    }
  }, [status]);

  const range = getRange(displayStatus, startThreshold, rated, max);
  const rangeSize = range.max - range.min;
  const clamped = Math.max(range.min, Math.min(current, range.max));
  const progress = rangeSize > 0 ? ((clamped - range.min) / rangeSize) * 100 : 0;
  const goalReached = current >= range.max;

  const remaining = range.max - clamped;

  const statusMessage = (() => {
    if (displayStatus === 'pending') {
      return goalReached ? t('matchConfirmed') : t('needMore', { count: remaining });
    }
    if (displayStatus === 'matchOn') {
      return goalReached ? t('ratedMatch') : t('matchConfirmed');
    }
    return goalReached ? 'FULL' : t('matchConfirmed');
  })();

  const statusColor = (() => {
    if (displayStatus === 'pending') {
      return goalReached ? '#fbbf24' : '#7a8093';
    }
    if (displayStatus === 'matchOn') {
      return goalReached ? '#34d399' : '#fbbf24';
    }
    return goalReached ? '#7a8093' : '#34d399';
  })();

  return (
    <div className="relative mb-3.5">
      <div
        className={transitioning ? 'animate-bar-exit' : 'animate-bar-enter'}
        style={{ transformOrigin: 'left center' }}
      >
        {/* Track */}
        <div
          className="relative h-2 rounded-[3px]"
          style={{ background: 'rgba(255,255,255,.06)' }}
        >
          {/* Fill */}
          <div
            className="absolute left-0 top-0 bottom-0 rounded-[3px] transition-[width] duration-500 ease-out"
            style={{
              width: `${progress}%`,
              background: range.color,
              boxShadow: `0 0 8px ${range.color}aa`,
            }}
          />
          {/* Goal marker at right edge */}
          <div
            className="absolute"
            style={{ right: 0, top: -2, bottom: -2 }}
          >
            <div
              style={{
                width: 2,
                height: '100%',
                background: goalReached ? range.color : 'rgba(255,255,255,.25)',
              }}
            />
          </div>
        </div>

        {/* Labels below bar */}
        <div className="flex items-center justify-between mt-1.5">
          <span
            className="flex items-center gap-1 text-xs font-bold"
            style={{ color: statusColor }}
          >
            {goalReached && <Check className="w-3.5 h-3.5" />}
            {statusMessage}
          </span>
          <span
            className="flex items-center gap-1 text-[11px] font-bold tracking-[.05em]"
            style={{
              color: goalReached ? range.color : '#7a8093',
              opacity: goalReached ? 1 : 0.7,
            }}
          >
            {goalReached && <Check className="w-2.5 h-2.5" />}
            {range.label}
          </span>
        </div>
      </div>
    </div>
  );
}
