'use client';

import { useState, useEffect, useCallback } from 'react';

interface MatchTimerProps {
  scheduledStart: string;
  timeOffset: number;
}

export function MatchTimer({ scheduledStart, timeOffset }: MatchTimerProps) {
  const calculateTimeLeft = useCallback(() => {
    const now = Date.now() + timeOffset;
    const start = new Date(scheduledStart).getTime();
    return Math.max(0, Math.floor((start - now) / 1000));
  }, [scheduledStart, timeOffset]);

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft);

  useEffect(() => {
    // Recalculate when scheduledStart or timeOffset changes
    setTimeLeft(calculateTimeLeft());
  }, [calculateTimeLeft]);

  useEffect(() => {
    // Decrement every second
    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    // Re-sync every 10 seconds
    const syncTimer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 10000);

    return () => {
      clearInterval(timer);
      clearInterval(syncTimer);
    };
  }, [calculateTimeLeft]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="mb-8">
      <div className="inline-flex items-baseline space-x-2 text-white">
        <span className="text-6xl md:text-7xl font-black tabular-nums">{minutes.toString().padStart(2, '0')}</span>
        <span className="text-5xl md:text-6xl font-thin opacity-50">:</span>
        <span className="text-6xl md:text-7xl font-black tabular-nums">{seconds.toString().padStart(2, '0')}</span>
      </div>
    </div>
  );
}
