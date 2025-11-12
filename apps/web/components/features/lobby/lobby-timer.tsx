'use client';

import { useState, useEffect } from 'react';

interface LobbyTimerProps {
  initialSeconds?: number;
}

export function LobbyTimer({ initialSeconds = 165 }: LobbyTimerProps) {
  const [timeLeft, setTimeLeft] = useState(initialSeconds);

  useEffect(() => {
    setTimeLeft(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

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
