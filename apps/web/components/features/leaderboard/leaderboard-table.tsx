'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

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

// Rank thresholds from rules page
// Bronze/Silver: 200 per tier, others: 100 per tier
const tiers = ['V', 'IV', 'III', 'II', 'I'] as const;

function getRankInfo(rating: number): { name: string; color: string } {
  // Grandmaster: 4000+ (100 per tier)
  if (rating >= 4000) {
    const tierIndex = Math.min(Math.floor((rating - 4000) / 100), 4);
    return { name: `GM ${tiers[tierIndex]}`, color: 'bg-rose-500' };
  }
  // Master: 3500-3999 (100 per tier)
  if (rating >= 3500) {
    const tierIndex = Math.floor((rating - 3500) / 100);
    return { name: `Master ${tiers[tierIndex]}`, color: 'bg-emerald-500' };
  }
  // Diamond: 3000-3499 (100 per tier)
  if (rating >= 3000) {
    const tierIndex = Math.floor((rating - 3000) / 100);
    return { name: `Diamond ${tiers[tierIndex]}`, color: 'bg-violet-500' };
  }
  // Platinum: 2500-2999 (100 per tier)
  if (rating >= 2500) {
    const tierIndex = Math.floor((rating - 2500) / 100);
    return { name: `Plat ${tiers[tierIndex]}`, color: 'bg-cyan-400' };
  }
  // Gold: 2000-2499 (100 per tier)
  if (rating >= 2000) {
    const tierIndex = Math.floor((rating - 2000) / 100);
    return { name: `Gold ${tiers[tierIndex]}`, color: 'bg-yellow-500' };
  }
  // Silver: 1000-1999 (200 per tier)
  if (rating >= 1000) {
    const tierIndex = Math.floor((rating - 1000) / 200);
    return { name: `Silver ${tiers[tierIndex]}`, color: 'bg-slate-400' };
  }
  // Bronze: 0-999 (200 per tier)
  const tierIndex = Math.floor(rating / 200);
  return { name: `Bronze ${tiers[tierIndex]}`, color: 'bg-amber-700' };
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
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700 text-gray-400">
            <th className="text-left py-2 px-2 font-medium w-12">#</th>
            <th className="py-2 px-1 w-6"></th>
            <th className="text-left py-2 px-2 font-medium">Player</th>
            <th className="text-left py-2 px-1 font-medium">Rank</th>
            <th className="text-right py-2 px-2 font-medium">Rating</th>
            <th className="text-right py-2 px-2 font-medium hidden sm:table-cell">Peak</th>
            <th className="text-right py-2 px-2 font-medium hidden sm:table-cell">Matches</th>
            <th className="text-right py-2 px-2 font-medium hidden md:table-cell w-12">1st</th>
            <th className="text-right py-2 px-2 font-medium hidden md:table-cell w-12">2nd</th>
            <th className="text-right py-2 px-2 font-medium hidden md:table-cell w-12">3rd</th>
            <th className="text-right py-2 px-2 font-medium hidden lg:table-cell">Avg Pos</th>
            <th className="text-right py-2 px-2 font-medium hidden lg:table-cell">Avg Pts</th>
            <th className="text-right py-2 px-2 font-medium hidden lg:table-cell">Finish%</th>
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
                <td className="py-2 px-2 text-right text-gray-100 hidden sm:table-cell">
                  {entry.seasonHighRating}
                </td>

                {/* Matches */}
                <td className="py-2 px-2 text-right text-gray-100 hidden sm:table-cell">
                  {entry.totalMatches}
                </td>

                {/* 1st Place */}
                <td className="py-2 px-2 text-right text-yellow-400 hidden md:table-cell">
                  {entry.firstPlaces}
                </td>

                {/* 2nd Place */}
                <td className="py-2 px-2 text-right text-gray-300 hidden md:table-cell">
                  {entry.secondPlaces}
                </td>

                {/* 3rd Place */}
                <td className="py-2 px-2 text-right text-orange-400 hidden md:table-cell">
                  {entry.thirdPlaces}
                </td>

                {/* Avg Position */}
                <td className="py-2 px-2 text-right text-gray-100 hidden lg:table-cell">
                  {avgPosition}
                </td>

                {/* Avg Points */}
                <td className="py-2 px-2 text-right text-gray-100 hidden lg:table-cell">
                  {avgPoints}
                </td>

                {/* Finish Rate */}
                <td className="py-2 px-2 text-right text-gray-100 hidden lg:table-cell">
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
