'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usersApi } from '@/lib/api';
import { UserMatchHistoryEntry } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface RecentMatchesProps {
  userId: number;
  category: 'GP' | 'CLASSIC' | 'TEAM_CLASSIC' | 'TEAM_GP';
  initialLimit?: number;
  seasonNumber?: number;
}

export function RecentMatches({ userId, category, initialLimit = 10, seasonNumber }: RecentMatchesProps) {
  const [matches, setMatches] = useState<UserMatchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const fetchMatches = useCallback(async (currentOffset: number, append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const response = await usersApi.getMatchHistory(userId, initialLimit, currentOffset, category, seasonNumber);
      const newMatches: UserMatchHistoryEntry[] = response.data;

      if (append) {
        setMatches((prev) => [...prev, ...newMatches]);
      } else {
        setMatches(newMatches);
      }

      setHasMore(newMatches.length === initialLimit);
      setError(null);
    } catch {
      setError('Failed to load match history');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [userId, initialLimit, category, seasonNumber]);

  useEffect(() => {
    setOffset(0);
    setMatches([]);
    fetchMatches(0);
  }, [fetchMatches]);

  const loadMore = () => {
    const newOffset = offset + initialLimit;
    setOffset(newOffset);
    fetchMatches(newOffset, true);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPositionStyle = (position: number) => {
    switch (position) {
      case 1:
        return 'text-yellow-400 font-bold';
      case 2:
        return 'text-gray-300 font-bold';
      case 3:
        return 'text-orange-400 font-bold';
      default:
        return 'text-gray-400';
    }
  };

  const getRatingChangeStyle = (change: number) => {
    if (change > 0) return 'text-green-400';
    if (change < 0) return 'text-red-400';
    return 'text-gray-500';
  };

  if (loading) {
    return (
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-lg">Recent Matches</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-700/50 rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-lg">Recent Matches</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-red-400 py-8">{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (matches.length === 0) {
    return (
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-lg">Recent Matches</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">No match history yet</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-800/50 border-gray-700">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          Recent Matches
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-gray-700/50">
          {matches.map((match) => (
            <Link
              key={`${match.matchId}-${match.completedAt}`}
              href={`/matches/${match.category.toLowerCase()}/${match.seasonNumber}/${match.matchNumber}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-700/30 transition-colors"
            >
              {/* Position */}
              <div className="flex items-center gap-1 w-16">
                <span className={cn('text-lg', getPositionStyle(match.position))}>
                  #{match.position}
                </span>
                <span className="text-gray-600 text-xs">/{match.totalParticipants}</span>
              </div>

              {/* Match Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'text-xs px-1.5 py-0.5 rounded',
                      match.category === 'TEAM_CLASSIC'
                        ? 'bg-rose-300/20 text-rose-300'
                        : match.category === 'CLASSIC'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-blue-500/20 text-blue-400'
                    )}
                  >
                    {match.category === 'TEAM_CLASSIC' ? 'TEAM CLASSIC' : match.category}
                  </span>
                  <span className="text-gray-300 text-sm">
                    S{match.seasonNumber} #{match.matchNumber}
                  </span>
                </div>
                <div className="text-gray-500 text-xs mt-0.5">
                  {formatDate(match.completedAt)}
                </div>
              </div>

              {/* Score */}
              {match.totalScore !== null && (
                <div className="text-right hidden sm:block">
                  <div className="text-gray-400 text-xs">Score</div>
                  <div className="text-white font-medium">{match.totalScore}</div>
                </div>
              )}

              {/* Rating Change */}
              <div className="text-right w-20">
                <div className="text-gray-400 text-xs">Rating</div>
                <div className={cn('font-medium', getRatingChangeStyle(match.ratingChange))}>
                  {match.ratingChange > 0 ? '+' : ''}
                  {match.ratingChange}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {hasMore && (
          <div className="p-4 border-t border-gray-700/50">
            <Button
              variant="ghost"
              className="w-full text-gray-400 hover:text-white"
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? 'Loading...' : 'Load More'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
