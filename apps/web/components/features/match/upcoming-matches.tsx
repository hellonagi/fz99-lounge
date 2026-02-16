'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { useAuthStore } from '@/store/authStore';
import { Loader2 } from 'lucide-react';
import { SiDiscord } from 'react-icons/si';

interface Match {
  id: number;
  category: string;
  matchNumber: number;
  scheduledStart: string;
  maxPlayers: number;
  season: {
    id: number;
    seasonNumber: number;
    event: {
      id: number;
      category: string;
    };
  };
  participants: Array<{
    userId: number;
    user: {
      id: number;
      displayName: string;
      avatarHash: string | null;
    };
  }>;
}

interface UpcomingMatchesProps {
  matches: Match[];
  loading?: boolean;
  joiningMatchId: number | null;
  onJoinLeave: (matchId: number) => void;
}

function CompactCountdown({ scheduledStart, label }: { scheduledStart: string; label: (time: string) => string }) {
  const calculateTimeLeft = useCallback(() => {
    const now = Date.now();
    const start = new Date(scheduledStart).getTime();
    return Math.max(0, Math.floor((start - now) / 1000));
  }, [scheduledStart]);

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft);

  useEffect(() => {
    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    const syncTimer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 10000);
    return () => {
      clearInterval(timer);
      clearInterval(syncTimer);
    };
  }, [calculateTimeLeft]);

  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;

  const time = hours > 0
    ? `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    : `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return (
    <span className="text-lg text-gray-300">
      {label(time).split(time).map((part, i, arr) => (
        <span key={i}>
          {part}
          {i < arr.length - 1 && (
            <span className="font-mono text-2xl font-bold text-white tabular-nums">{time}</span>
          )}
        </span>
      ))}
    </span>
  );
}

export function UpcomingMatches({ matches, loading, joiningMatchId, onJoinLeave }: UpcomingMatchesProps) {
  const t = useTranslations('home');
  const tHero = useTranslations('matchHero');
  const { isAuthenticated, user } = useAuthStore();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';

  if (loading || !matches || matches.length === 0) {
    return null;
  }

  return (
    <section className="py-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-8 text-center">
          {t('upcomingMatches')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mx-0 md:mx-6">
          {matches.map((match) => {
            const category = match.category || match.season?.event?.category;
            const isInMatch = isAuthenticated && user
              ? match.participants.some((p) => p.userId === user.id)
              : false;
            const isJoiningThis = joiningMatchId === match.id;

            return (
              <Card key={match.id} className="p-4 flex flex-col gap-3 bg-gray-700/50 border-gray-600">
                {/* Header: Badge + Match number */}
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex items-center px-2 py-1 rounded text-xs font-medium border',
                      category === 'CLASSIC'
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/50'
                        : category === 'TEAM_CLASSIC'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                          : 'bg-blue-500/20 text-blue-300 border-blue-500/50'
                    )}
                  >
                    {category === 'TEAM_CLASSIC' ? 'TEAM CLASSIC' : category}
                  </span>
                  <span className="text-gray-400 text-sm font-medium">
                    Season{match.season?.seasonNumber} #{match.matchNumber}
                  </span>
                </div>

                {/* Countdown */}
                <div className="flex items-center justify-center py-2">
                  <CompactCountdown
                    scheduledStart={match.scheduledStart}
                    label={(time) => t('startsInTime', { time })}
                  />
                </div>

                {/* Bottom row: Join/Leave button (left) + Player count (right) */}
                <div className="flex items-center justify-between">
                  {isAuthenticated ? (
                    <button
                      onClick={() => onJoinLeave(match.id)}
                      disabled={isJoiningThis}
                      className={cn(
                        'inline-flex items-center justify-center px-4 py-1.5 rounded-md text-xs font-medium border min-w-[80px] transition-all disabled:opacity-50',
                        isInMatch
                          ? 'bg-gray-500/10 text-gray-400 border-gray-500/40 hover:bg-gray-500/25 hover:text-gray-200'
                          : 'bg-green-500/10 text-green-400 border-green-500/40 hover:bg-green-500/25 hover:text-green-200'
                      )}
                    >
                      {isJoiningThis ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isInMatch ? (
                        tHero('leave')
                      ) : (
                        tHero('join')
                      )}
                    </button>
                  ) : (
                    <a
                      href={`${baseUrl}/api/auth/discord`}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium border bg-[#5865F2]/10 text-[#8b9aff] border-[#5865F2]/40 hover:bg-[#5865F2]/25 hover:text-white transition-all"
                    >
                      <SiDiscord className="h-3.5 w-3.5" />
                      {tHero('loginToJoin')}
                    </a>
                  )}
                  <span className="text-sm text-gray-400">
                    {match.participants.length}/{match.maxPlayers}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
