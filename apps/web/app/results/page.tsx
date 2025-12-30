'use client';

import { useState, useEffect } from 'react';
import { matchesApi, seasonsApi } from '@/lib/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SeasonSelect } from '@/components/features/leaderboard/season-select';
import { MatchList } from '@/components/features/results/match-list';
import { ResultsPagination } from '@/components/features/results/results-pagination';

interface Season {
  id: number;
  seasonNumber: number;
  isActive: boolean;
}

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

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export default function ResultsPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonNumber, setSelectedSeasonNumber] = useState<number | undefined>();
  const [page, setPage] = useState(1);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
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

  // Fetch matches when season or page changes
  useEffect(() => {
    if (selectedSeasonNumber === undefined) return;

    const fetchResults = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await matchesApi.getResults({
          category: 'CLASSIC',
          seasonNumber: selectedSeasonNumber,
          page,
          limit: 20,
        });
        setMatches(response.data.data);
        setMeta(response.data.meta);
      } catch (err) {
        setError('Failed to load results');
        setMatches([]);
        setMeta(null);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [selectedSeasonNumber, page]);

  const handleSeasonChange = (seasonNumber: number) => {
    setSelectedSeasonNumber(seasonNumber);
    setPage(1); // Reset page when season changes
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  return (
    <main className="max-w-6xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-white">Match Results</h1>
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

          <TabsContent value="classic" className="p-4">
            {error ? (
              <div className="text-center text-red-400 py-8">{error}</div>
            ) : (
              <>
                {meta && (
                  <div className="text-sm text-gray-400 mb-4">
                    {meta.total} matches found
                  </div>
                )}
                <MatchList matches={matches} loading={loading} />

                {meta && meta.totalPages > 1 && (
                  <ResultsPagination
                    currentPage={page}
                    totalPages={meta.totalPages}
                    onPageChange={handlePageChange}
                  />
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
