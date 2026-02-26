'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { cn } from '@/lib/utils';

interface MatchResult {
  id: number;
  matchNumber: number;
  category: string;
  seasonNumber: number;
  playerCount: number;
  status: string;
  startedAt: string | null;
  winner: {
    id: number;
    displayName: string | null;
    totalScore: number | null;
  } | null;
}

interface MatchListProps {
  matches: MatchResult[];
  loading?: boolean;
}

export function MatchList({ matches, loading }: MatchListProps) {
  const locale = useLocale();

  if (loading) {
    return (
      <div className="text-gray-400 text-sm py-8 text-center">Loading...</div>
    );
  }

  const filteredMatches = matches?.filter(
    (match) => match.winner && match.playerCount > 1
  ) ?? [];

  if (filteredMatches.length === 0) {
    return (
      <div className="text-gray-400 text-sm py-8 text-center">
        No matches found
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filteredMatches.map((match) => (
        <Link
          key={match.id}
          href={`/matches/${match.category.toLowerCase()}/${match.seasonNumber}/${match.matchNumber}`}
          className="block"
        >
          <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-gray-700/50 border border-gray-600 hover:bg-gray-700/80 transition-colors">
            {/* Left: Category & Match Info */}
            <div className="flex items-center gap-3 shrink-0">
              <span
                className={cn(
                  'inline-flex items-center px-2 py-1 rounded text-xs font-medium border',
                  match.category === 'GP'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                    : match.category === 'CLASSIC'
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/50'
                      : match.category === 'TEAM_CLASSIC'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                        : match.category === 'TEAM_GP'
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                          : match.category === 'TOURNAMENT'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                            : 'bg-blue-500/20 text-blue-300 border-blue-500/50'
                )}
              >
                {match.category === 'TEAM_CLASSIC' ? 'TEAM CLASSIC' : match.category === 'TEAM_GP' ? 'TEAM GP' : match.category === 'GP' ? 'GP' : match.category}
              </span>
              <span className="text-gray-300 text-sm whitespace-nowrap">
                S{match.seasonNumber} #{match.matchNumber}
              </span>
              {match.startedAt && (
                <span className="hidden sm:inline text-gray-500 text-xs whitespace-nowrap">
                  {new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(match.startedAt))}
                </span>
              )}
            </div>

            {/* Right: Winner */}
            <div className="flex items-center gap-2">
              {match.winner && (
                <>
                  <span className="text-gray-200 text-sm font-bold truncate max-w-[160px] sm:max-w-none">
                    🏆️{match.winner.displayName || `User#${match.winner.id}`}
                  </span>
                  {match.winner.totalScore !== null && (
                    <span className="text-gray-500 text-xs whitespace-nowrap">
                      {match.winner.totalScore}pts
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
