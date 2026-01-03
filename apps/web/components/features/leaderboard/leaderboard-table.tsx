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
  user: {
    id: number;
    displayName: string | null;
    avatarHash: string | null;
    profile?: { country: string | null } | null;
  };
}

interface LeaderboardTableProps {
  data: LeaderboardEntry[];
  loading?: boolean;
}

export function LeaderboardTable({ data, loading }: LeaderboardTableProps) {
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
      <table className="w-full text-sm min-w-[900px]">
        <thead>
          <tr className="border-b border-gray-700 text-gray-400">
            <th className="text-left py-2 px-2 font-medium w-12">#</th>
            <th className="py-2 px-1 w-6"></th>
            <th className="text-left py-2 px-2 font-medium">Player</th>
            <th className="text-left py-2 px-1 font-medium">Rank</th>
            <th className="text-right py-2 px-2 font-medium">Rating</th>
            <th className="text-right py-2 px-2 font-medium">Peak</th>
            <th className="text-right py-2 px-2 font-medium">Matches</th>
            <th className="text-right py-2 px-2 font-medium w-12">1st</th>
            <th className="text-right py-2 px-2 font-medium w-12">2nd</th>
            <th className="text-right py-2 px-2 font-medium w-12">3rd</th>
            <th className="text-right py-2 px-2 font-medium">Avg Pos</th>
            <th className="text-right py-2 px-2 font-medium">Avg Pts</th>
            <th className="text-right py-2 px-2 font-medium">Finish%</th>
          </tr>
        </thead>
        <tbody>
          {data.map((entry, index) => {
            const rank = index + 1;
            const rankInfo = getRankInfo(entry.displayRating);
            const avgPosition = entry.totalMatches > 0
              ? (entry.totalPositions / entry.totalMatches).toFixed(1)
              : '-';
            const avgPoints = entry.totalMatches > 0
              ? (entry.totalPoints / entry.totalMatches).toFixed(1)
              : '-';
            const finishRate = entry.totalMatches > 0
              ? Math.round((entry.survivedCount / entry.totalMatches) * 100)
              : 0;

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
                    className="text-white truncate max-w-[150px] hover:text-blue-400"
                  >
                    {entry.user.displayName || `User#${entry.user.id}`}
                  </Link>
                </td>

                {/* Rank Badge */}
                <td className="py-2 px-1">
                  <div className="flex items-center gap-1.5">
                    <div className={cn('w-2.5 h-2.5 rounded-full', rankInfo.color)} />
                    <span className="text-gray-100">{rankInfo.name}</span>
                  </div>
                </td>

                {/* Rating */}
                <td className="py-2 px-2 text-right font-bold text-white">
                  {entry.displayRating}
                </td>

                {/* Peak (Season High) */}
                <td className="py-2 px-2 text-right text-gray-100">
                  {entry.seasonHighRating}
                </td>

                {/* Matches */}
                <td className="py-2 px-2 text-right text-gray-100">
                  {entry.totalMatches}
                </td>

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

                {/* Avg Position */}
                <td className="py-2 px-2 text-right text-gray-100">
                  {avgPosition}
                </td>

                {/* Avg Points */}
                <td className="py-2 px-2 text-right text-gray-100">
                  {avgPoints}
                </td>

                {/* Finish Rate */}
                <td className="py-2 px-2 text-right text-gray-100">
                  {finishRate}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
