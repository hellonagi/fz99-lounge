'use client';

import { useEffect, useState } from 'react';

interface MatchPasscodeHeroProps {
  passcode: string;
  league: string;
  totalPlayers: number;
  startedAt: string;
}

export function MatchPasscodeHero({
  passcode,
  league,
  totalPlayers,
  startedAt,
}: MatchPasscodeHeroProps) {
  const [timeLeft, setTimeLeft] = useState(60);

  useEffect(() => {
    // Calculate initial time left
    const now = new Date().getTime();
    const start = new Date(startedAt).getTime();
    const elapsed = Math.floor((now - start) / 1000);
    const remaining = Math.max(0, 60 - elapsed);
    setTimeLeft(remaining);

    // Update every second
    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [startedAt]);

  return (
    <section className="relative min-h-[500px] bg-gradient-to-b from-green-900 to-gray-800 overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-green-900/30 via-emerald-900/30 to-teal-900/30"></div>
        <div className="absolute inset-0 animate-pulse" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.2) 0%, transparent 50%)' }}></div>
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          {/* Status Badge */}
          <div className="mb-6">
            <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-green-500/20 text-green-300 border border-green-500/50">
              <span className="relative flex h-3 w-3 mr-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              MATCH IN PROGRESS
            </span>
          </div>

          {/* League Info */}
          <h1 className="text-3xl md:text-5xl font-black text-white mb-2 tracking-tight">
            {league} LEAGUE
          </h1>
          <p className="text-lg text-gray-300 mb-8">{totalPlayers} Players</p>

          {/* Passcode Display */}
          <div className="mb-8">
            <p className="text-sm text-gray-400 uppercase tracking-widest mb-3">Room Passcode</p>
            <div className="inline-block bg-black/30 backdrop-blur-sm rounded-2xl px-12 py-8 border-2 border-green-500/50 shadow-2xl shadow-green-500/20">
              <div className="flex items-center justify-center space-x-4">
                {passcode.split('').map((digit, index) => (
                  <div
                    key={index}
                    className="w-16 h-20 md:w-20 md:h-24 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-lg"
                  >
                    <span className="text-5xl md:text-6xl font-black text-white">
                      {digit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Timer */}
          <div className="mb-6">
            <p className="text-sm text-gray-400 mb-2">Passcode visible for</p>
            <div className="inline-flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-gray-800/50 border-2 border-green-500/50 flex items-center justify-center">
                <span className="text-3xl font-black text-green-400 tabular-nums">
                  {timeLeft}
                </span>
              </div>
              <span className="text-lg text-gray-400 ml-2">sec</span>
            </div>
          </div>

          {/* Message */}
          <div className="mt-8">
            <p className="text-2xl font-bold text-white mb-2">Good Luck! 🏁</p>
            <p className="text-sm text-gray-400">
              Enter the passcode in F-ZERO 99 to join the match
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
