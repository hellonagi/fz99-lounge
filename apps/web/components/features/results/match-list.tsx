'use client';

import Link from 'next/link';
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
  if (loading) {
    return (
      <div className="text-gray-400 text-sm py-8 text-center">Loading...</div>
    );
  }

  // Filter out matches with no winner or only 1 player
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
          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors">
            {/* Left: Category & Match Info */}
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'text-xs font-bold px-2 py-0.5 rounded',
                  match.category === 'CLASSIC'
                    ? 'bg-purple-600 text-white'
                    : match.category === 'TOURNAMENT'
                      ? 'bg-amber-600 text-white'
                      : 'bg-blue-600 text-white'
                )}
              >
                {match.category}
              </span>
              <span className="text-gray-300 text-sm">
                S{match.seasonNumber} #{match.matchNumber}
              </span>
              <span className="hidden sm:inline text-gray-500 text-sm">
                {match.playerCount} players
              </span>
            </div>

            {/* Right: Winner */}
            <div className="flex items-center gap-2">
              {match.winner ? (
                <>
                  <span className="text-white text-sm font-medium text-left truncate">
                    🏆{match.winner.displayName || `User#${match.winner.id}`}
                  </span>
                  {match.winner.totalScore !== null && (
                    <span className="text-gray-400 text-xs">
                      {match.winner.totalScore}pts
                    </span>
                  )}
                </>
              ) : (
                <span className="text-gray-500 text-sm text-left">
                  {match.status === 'IN_PROGRESS' ? 'In Progress' : 'No winner'}
                </span>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
