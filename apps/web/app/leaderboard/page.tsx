'use client';

import { useState, useEffect } from 'react';
import { usersApi, seasonsApi } from '@/lib/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SeasonSelect } from '@/components/features/leaderboard/season-select';
import { LeaderboardTable } from '@/components/features/leaderboard/leaderboard-table';

interface Season {
  id: number;
  seasonNumber: number;
  isActive: boolean;
}

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

export default function LeaderboardPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonNumber, setSelectedSeasonNumber] = useState<number | undefined>();
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch seasons on mount
  useEffect(() => {
    const fetchSeasons = async () => {
      try {
        const response = await seasonsApi.getAll('CLASSIC');
        const seasonList = response.data as Season[];
        setSeasons(seasonList);

        // Find active season and set as default
        const activeSeason = seasonList.find((s: Season) => s.isActive);
        if (activeSeason) {
          setSelectedSeasonNumber(activeSeason.seasonNumber);
        } else if (seasonList.length > 0) {
          // Fallback to latest season
          const latestSeason = seasonList.reduce((prev: Season, curr: Season) =>
            curr.seasonNumber > prev.seasonNumber ? curr : prev
          );
          setSelectedSeasonNumber(latestSeason.seasonNumber);
        }
      } catch (err) {
        setError('Failed to load seasons');
        setLoading(false);
      }
    };

    fetchSeasons();
  }, []);

  // Fetch leaderboard when season changes
  useEffect(() => {
    if (selectedSeasonNumber === undefined) return;

    const fetchLeaderboard = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await usersApi.getLeaderboard('CLASSIC', selectedSeasonNumber, 100);
        setLeaderboardData(response.data as LeaderboardEntry[]);
      } catch (err) {
        setError('Failed to load leaderboard');
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [selectedSeasonNumber]);

  const handleSeasonChange = (seasonNumber: number) => {
    setSelectedSeasonNumber(seasonNumber);
  };

  return (
    <main className="max-w-6xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
        {seasons.length > 0 && (
          <SeasonSelect
            seasons={seasons}
            selectedSeasonNumber={selectedSeasonNumber}
            onSeasonChange={handleSeasonChange}
          />
        )}
      </div>

      {/* Tabs */}
      <div className="bg-gray-800 rounded-lg">
        <Tabs defaultValue="classic">
          <TabsList>
            <TabsTrigger value="classic">Classic</TabsTrigger>
          </TabsList>

          <TabsContent value="classic">
            {error ? (
              <div className="text-center text-red-400 py-8">{error}</div>
            ) : (
              <LeaderboardTable data={leaderboardData} loading={loading} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
