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
  winningTeam: {
    score: number;
    members: { id: number; displayName: string | null }[];
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

  // Filter out matches with no winner/winningTeam or only 1 player
  const filteredMatches = matches?.filter(
    (match) => (match.winner || match.winningTeam) && match.playerCount > 1
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
          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-600/50 hover:bg-gray-600 transition-colors">
            {/* Left: Category & Match Info */}
            <div className="flex items-center gap-3 shrink-0">
              <span
                className={cn(
                  'inline-flex items-center px-2 py-1 rounded text-xs font-medium border',
                  match.category === 'CLASSIC'
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/50'
                    : match.category === 'TEAM_CLASSIC'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                      : match.category === 'TOURNAMENT'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                        : 'bg-blue-500/20 text-blue-300 border-blue-500/50'
                )}
              >
                {match.category === 'TEAM_CLASSIC' ? 'TEAM CLASSIC' : match.category}
              </span>
              <span className="text-gray-300 text-sm whitespace-nowrap">
                S{match.seasonNumber} #{match.matchNumber}
              </span>
              <span className="hidden sm:inline text-gray-500 text-sm whitespace-nowrap">
                {match.playerCount} players
              </span>
            </div>

            {/* Right: Winner */}
            <div className="flex items-center gap-2">
              {match.winningTeam ? (
                <>
                  <span className="text-white text-sm font-medium text-right truncate max-w-[200px] sm:max-w-none">
                    🏆{match.winningTeam.members
                      .map((m) => m.displayName || `User#${m.id}`)
                      .join(', ')}
                  </span>
                  <span className="text-gray-400 text-xs">
                    {match.winningTeam.score}pts
                  </span>
                </>
              ) : match.winner ? (
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
