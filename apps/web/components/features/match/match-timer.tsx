'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface MatchTimerProps {
  scheduledStart: string;
  timeOffset: number;
}

function SlotDigit({ value }: { value: string }) {
  const [current, setCurrent] = useState(value);
  const [previous, setPrevious] = useState(value);
  const [animating, setAnimating] = useState(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (value !== current) {
      setPrevious(current);
      setCurrent(value);
      setAnimating(true);
    }
  }, [value, current]);

  return (
    <div className="relative inline-flex h-[48px] w-[44px] overflow-hidden rounded-md bg-white/[.06] sm:h-[64px] sm:w-[60px] md:h-[88px] md:w-[80px]">
      {/* Old value - slides out upward */}
      <div
        className={`absolute inset-0 flex items-center justify-center text-4xl font-extrabold tabular-nums text-white sm:text-5xl md:text-7xl ${animating ? 'animate-slot-out' : ''}`}
        onAnimationEnd={() => setAnimating(false)}
      >
        {animating ? previous : current}
      </div>

      {/* New value - slides in from below */}
      {animating && (
        <div className="absolute inset-0 flex items-center justify-center text-4xl font-extrabold tabular-nums text-white animate-slot-in sm:text-5xl md:text-7xl">
          {current}
        </div>
      )}
    </div>
  );
}

function SlotUnit({ value }: { value: string }) {
  const padded = value.padStart(2, '0');
  return (
    <div className="flex gap-1">
      <SlotDigit value={padded[0]} />
      <SlotDigit value={padded[1]} />
    </div>
  );
}

export function MatchTimer({ scheduledStart, timeOffset }: MatchTimerProps) {
  const calculateTimeLeft = useCallback(() => {
    const now = Date.now() + timeOffset;
    const start = new Date(scheduledStart).getTime();
    return Math.max(0, Math.floor((start - now) / 1000));
  }, [scheduledStart, timeOffset]);

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft);

  useEffect(() => {
    setTimeLeft(calculateTimeLeft());
  }, [calculateTimeLeft]);

  useEffect(() => {
    let tickId: ReturnType<typeof setTimeout>;
    let syncId: ReturnType<typeof setTimeout>;

    const tick = () => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
      tickId = setTimeout(tick, 1000 - (Date.now() % 1000));
    };
    tickId = setTimeout(tick, 1000 - (Date.now() % 1000));

    const sync = () => {
      setTimeLeft(calculateTimeLeft());
      syncId = setTimeout(sync, 10000);
    };
    syncId = setTimeout(sync, 10000);

    return () => {
      clearTimeout(tickId);
      clearTimeout(syncId);
    };
  }, [calculateTimeLeft]);

  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="mb-8">
      <div className="inline-flex items-center gap-1.5 text-white sm:gap-2 md:gap-3">
        {hours > 0 && (
          <>
            <SlotUnit value={hours.toString()} />
            <span className="text-3xl font-thin opacity-50 animate-colon-blink sm:text-4xl md:text-6xl">:</span>
          </>
        )}
        <SlotUnit value={minutes.toString()} />
        <span className="text-3xl font-thin opacity-50 animate-colon-blink sm:text-4xl md:text-6xl">:</span>
        <SlotUnit value={seconds.toString()} />
      </div>
    </div>
  );
}
