'use client';

import { useEffect, useState } from 'react';
import { usersApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TrackStatsProps {
  userId: number;
  category: 'GP' | 'CLASSIC' | 'TEAM_CLASSIC' | 'TEAM_GP';
}

interface TrackStat {
  trackId: number;
  trackName: string;
  league: string;
  bannerPath: string | null;
  races: number;
  wins: number;
  podiums: number;
  avgPosition: number | null;
}

export function TrackStats({ userId, category }: TrackStatsProps) {
  const [stats, setStats] = useState<TrackStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const response = await usersApi.getTrackStats(userId, category);
        setStats(response.data);
        setError(null);
      } catch {
        setError('Failed to load track stats');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [userId, category]);

  if (loading) {
    return (
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-lg">Track Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-gray-400">
            Loading...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-lg">Track Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-red-400">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (stats.length === 0) {
    return (
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-lg">Track Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[100px] flex items-center justify-center text-gray-500">
            No track data yet
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-800/50 border-gray-700">
      <CardHeader>
        <CardTitle className="text-lg">Track Stats</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="text-left px-4 py-2">Track</th>
                <th className="text-center px-2 py-2">Races</th>
                <th className="text-center px-2 py-2">Wins</th>
                <th className="text-center px-2 py-2">Avg</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {stats.map((track) => (
                <tr key={track.trackId} className="hover:bg-gray-700/30">
                  <td className="px-4 py-2 text-white">
                    {track.trackName}
                  </td>
                  <td className="text-center px-2 py-2 text-gray-300">
                    {track.races}
                  </td>
                  <td className="text-center px-2 py-2">
                    <span className={track.wins > 0 ? 'text-yellow-400 font-bold' : 'text-gray-500'}>
                      {track.wins}
                    </span>
                  </td>
                  <td className="text-center px-2 py-2 text-gray-300">
                    {track.avgPosition ?? '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
