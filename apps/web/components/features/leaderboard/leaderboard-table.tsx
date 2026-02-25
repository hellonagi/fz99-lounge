'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { getRankInfo } from '@/lib/rank-utils';

interface LeaderboardEntry {
  id: number;
  userId: number;
  displayRating: number;
  seasonHighRating: number;
  totalMatches: number;
  totalPoints: number;
  totalPositions: number;
  firstPlaces: number;
  secondPlaces: number;
  thirdPlaces: number;
  survivedCount: number;
  assistUsedCount: number;
  bestPosition?: number | null;
  medianPosition: number | null;
  medianPoints: number | null;
  favoriteMachine: string | null;
  mvpCount?: number;
  user: {
    id: number;
    displayName: string | null;
    avatarHash: string | null;
    profile?: { country: string | null } | null;
  };
}

// Machine name abbreviations for mobile display
const machineAbbreviations: Record<string, string> = {
  'Blue Falcon': 'BF',
  'Golden Fox': 'GF',
  'Wild Goose': 'WG',
  'Fire Stingray': 'FS',
};

interface LeaderboardTableProps {
  data: LeaderboardEntry[];
  loading?: boolean;
  startRank?: number;
  category?: 'GP' | 'CLASSIC' | 'TEAM_CLASSIC';
}

export function LeaderboardTable({ data, loading, startRank = 1, category = 'CLASSIC' }: LeaderboardTableProps) {
  const isTeamClassic = category === 'TEAM_CLASSIC';
  const isGpMode = category === 'GP';
  if (loading) {
    return (
      <div className="text-center text-gray-400 py-8">
        Loading...
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No players found
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full text-sm", isGpMode ? "min-w-[700px] sm:min-w-[850px]" : "min-w-[850px] sm:min-w-[1000px]")}>
        <thead>
          <tr className="border-b border-gray-700 text-gray-400">
            <th className="text-left py-2 px-2 font-medium w-12">#</th>
            <th className="py-2 px-1 w-6"></th>
            <th className="text-left py-2 px-2 font-medium">Player</th>
            {!isGpMode && <th className="text-left py-2 px-1 font-medium">Rank</th>}
            {!isGpMode && <th className="text-right py-2 px-2 font-medium">Rating</th>}
            {!isGpMode && <th className="text-right py-2 px-2 font-medium">Peak</th>}
            <th className="text-right py-2 px-2 font-medium">Matches</th>
            {isGpMode && <th className="text-right py-2 px-2 font-medium">Best Pos</th>}
            {isTeamClassic ? (
              <>
                <th className="text-right py-2 px-2 font-medium w-12">Wins</th>
                <th className="text-right py-2 px-2 font-medium w-12">MVP</th>
              </>
            ) : (
              <>
                <th className="text-right py-2 px-2 font-medium w-12">1st</th>
                <th className="text-right py-2 px-2 font-medium w-12">2nd</th>
                <th className="text-right py-2 px-2 font-medium w-12">3rd</th>
              </>
            )}
            <th className="text-right py-2 px-2 font-medium">Med Pos</th>
            <th className="text-right py-2 px-2 font-medium">Med Pts</th>
            <th className="text-right py-2 px-2 font-medium">Finish%</th>
            <th className="text-right py-2 px-2 font-medium">Machine</th>
          </tr>
        </thead>
        <tbody>
          {data.map((entry, index) => {
            const rank = startRank + index;
            const rankInfo = getRankInfo(entry.displayRating);
            const medianPosition = entry.medianPosition !== null
              ? entry.medianPosition.toFixed(1)
              : '-';
            const medianPoints = entry.medianPoints !== null
              ? entry.medianPoints.toFixed(1)
              : '-';
            const finishRate = entry.totalMatches > 0
              ? Math.round((entry.survivedCount / entry.totalMatches) * 100)
              : 0;
            const machineAbbr = entry.favoriteMachine
              ? machineAbbreviations[entry.favoriteMachine] || entry.favoriteMachine
              : '-';

            return (
              <tr
                key={entry.id}
                className="border-b border-gray-700/50 hover:bg-gray-700/30"
              >
                {/* Rank */}
                <td className={cn(
                  'py-2 px-2 font-bold',
                  rank === 1 ? 'text-yellow-400' :
                  rank === 2 ? 'text-gray-300' :
                  rank === 3 ? 'text-orange-400' :
                  'text-gray-100'
                )}>
                  {rank}
                </td>

                {/* Country */}
                <td className="py-2 px-1 w-6">
                  <span
                    className={`fi fi-${entry.user.profile?.country?.toLowerCase() || 'un'}`}
                    title={entry.user.profile?.country || 'Unknown'}
                  />
                </td>

                {/* Player */}
                <td className="py-2 px-2">
                  <Link
                    href={`/profile/${entry.user.id}`}
                    prefetch={false}
                    className="text-white truncate max-w-[150px] hover:text-blue-400"
                  >
                    {entry.user.displayName || `User#${entry.user.id}`}
                  </Link>
                </td>

                {/* Rank Badge */}
                {!isGpMode && (
                  <td className="py-2 px-1 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <div className={cn('w-2.5 h-2.5 rounded-full', rankInfo.color)} />
                      <span className="text-gray-100">{rankInfo.name}</span>
                    </div>
                  </td>
                )}

                {/* Rating */}
                {!isGpMode && (
                  <td className="py-2 px-2 text-right font-bold text-white">
                    {entry.displayRating}
                  </td>
                )}

                {/* Peak (Season High) */}
                {!isGpMode && (
                  <td className="py-2 px-2 text-right text-gray-100">
                    {entry.seasonHighRating}
                  </td>
                )}

                {/* Matches */}
                <td className="py-2 px-2 text-right text-gray-100">
                  {entry.totalMatches}
                </td>

                {/* Best Position (GP only) */}
                {isGpMode && (
                  <td className="py-2 px-2 text-right font-bold text-white">
                    {entry.bestPosition ?? '-'}
                  </td>
                )}

                {isTeamClassic ? (
                  <>
                    {/* Wins (Team 1st Place) */}
                    <td className="py-2 px-2 text-right text-yellow-400">
                      {entry.firstPlaces}
                    </td>

                    {/* MVP */}
                    <td className="py-2 px-2 text-right text-amber-300">
                      {entry.mvpCount ?? 0}
                    </td>
                  </>
                ) : (
                  <>
                    {/* 1st Place */}
                    <td className="py-2 px-2 text-right text-yellow-400">
                      {entry.firstPlaces}
                    </td>

                    {/* 2nd Place */}
                    <td className="py-2 px-2 text-right text-gray-300">
                      {entry.secondPlaces}
                    </td>

                    {/* 3rd Place */}
                    <td className="py-2 px-2 text-right text-orange-400">
                      {entry.thirdPlaces}
                    </td>
                  </>
                )}

                {/* Median Position */}
                <td className="py-2 px-2 text-right text-gray-100">
                  {medianPosition}
                </td>

                {/* Median Points */}
                <td className="py-2 px-2 text-right text-gray-100">
                  {medianPoints}
                </td>

                {/* Finish Rate */}
                <td className="py-2 px-2 text-right text-gray-100">
                  {finishRate}%
                </td>

                {/* Machine */}
                <td className="py-2 px-2 text-right text-gray-100">
                  <span className="sm:hidden">{machineAbbr}</span>
                  <span className="hidden sm:inline">{entry.favoriteMachine || '-'}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
