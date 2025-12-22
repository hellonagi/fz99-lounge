'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface RecentMatch {
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

interface RecentMatchesProps {
  matches: RecentMatch[];
  loading?: boolean;
}

export function RecentMatches({ matches, loading }: RecentMatchesProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Matches</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-gray-400 text-sm">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (!matches || matches.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Matches</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-gray-400 text-sm">No recent matches</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Recent Matches</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {matches.map((match) => (
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
                      : 'bg-blue-600 text-white'
                  )}
                >
                  {match.category}
                </span>
                <span className="text-gray-300 text-sm">
                  S{match.seasonNumber} #{match.matchNumber}
                </span>
                <span className="text-gray-500 text-sm">
                  {match.playerCount} players
                </span>
              </div>

              {/* Right: Winner */}
              <div className="flex items-center gap-2">
                {match.winner ? (
                  <>
                    <span className="text-yellow-400">👑</span>
                    <span className="text-white text-sm font-medium">
                      {match.winner.displayName || `User#${match.winner.id}`}
                    </span>
                    {match.winner.totalScore !== null && (
                      <span className="text-gray-400 text-xs">
                        {match.winner.totalScore}pts
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-gray-500 text-sm">In Progress</span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
