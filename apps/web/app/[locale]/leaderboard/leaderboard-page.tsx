'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { usersApi, seasonsApi } from '@/lib/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SeasonSelect } from '@/components/features/leaderboard/season-select';
import { LeaderboardTable } from '@/components/features/leaderboard/leaderboard-table';
import { LeaderboardPagination } from '@/components/features/leaderboard/leaderboard-pagination';

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
  bestPosition?: number | null;
  user: {
    id: number;
    displayName: string | null;
    avatarHash: string | null;
    profile?: { country: string | null } | null;
  };
}

type Category = 'GP' | 'CLASSIC' | 'TEAM_CLASSIC' | 'TEAM_GP';

const TAB_TO_CATEGORY: Record<string, Category> = {
  gp: 'GP',
  team_gp: 'TEAM_GP',
  classic: 'CLASSIC',
  team_classic: 'TEAM_CLASSIC',
};

function getCategoryFromTab(tab: string | null): Category {
  if (tab && TAB_TO_CATEGORY[tab]) {
    return TAB_TO_CATEGORY[tab];
  }
  return 'GP';
}

export default function LeaderboardPage() {
  const t = useTranslations('leaderboard');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category>(() =>
    getCategoryFromTab(searchParams.get('tab'))
  );
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonNumber, setSelectedSeasonNumber] = useState<number | undefined>();
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch seasons when category changes
  useEffect(() => {
    const fetchSeasons = async () => {
      try {
        const response = await seasonsApi.getAll(activeCategory);
        const seasonList = response.data as Season[];
        setSeasons(seasonList);
        setSelectedSeasonNumber(undefined); // Reset season selection
        setPage(1); // Reset page
      } catch {
        setError(t('failedToLoadSeasons'));
        setLoading(false);
      }
    };

    fetchSeasons();
  }, [activeCategory, t]);

  // Fetch leaderboard when category, season or page changes
  useEffect(() => {
    // 初回はseasons取得を待つ
    if (seasons.length === 0) return;

    const fetchLeaderboard = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await usersApi.getLeaderboard(activeCategory, selectedSeasonNumber, page);
        const result = response.data as { data: LeaderboardEntry[]; meta: { totalPages: number; seasonNumber?: number } };
        setLeaderboardData(result.data);
        setTotalPages(result.meta.totalPages);

        // バックエンドから返されたシーズン番号で選択を同期
        if (result.meta.seasonNumber !== undefined && result.meta.seasonNumber !== selectedSeasonNumber) {
          setSelectedSeasonNumber(result.meta.seasonNumber);
        }
      } catch {
        setError(t('failedToLoadLeaderboard'));
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [activeCategory, seasons, selectedSeasonNumber, page, t]);

  const handleSeasonChange = (seasonNumber: number) => {
    setSelectedSeasonNumber(seasonNumber);
    setPage(1);
  };

  const handleCategoryChange = useCallback(
    (value: string) => {
      const category = value.toUpperCase() as Category;
      setActiveCategory(category);
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', value);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  return (
    <main className="max-w-6xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
        {seasons.length > 0 && selectedSeasonNumber !== undefined && (
          <SeasonSelect
            seasons={seasons}
            selectedSeasonNumber={selectedSeasonNumber}
            onSeasonChange={handleSeasonChange}
          />
        )}
      </div>

      {/* Tabs */}
      <div className="bg-gray-800 rounded-lg">
        {mounted ? (
          <Tabs
            value={activeCategory.toLowerCase()}
            onValueChange={handleCategoryChange}
          >
            <TabsList>
              <TabsTrigger value="gp">{t('gp')}</TabsTrigger>
              <TabsTrigger value="team_gp">{t('teamGp')}</TabsTrigger>
              <TabsTrigger value="classic">{t('classic')}</TabsTrigger>
              <TabsTrigger value="team_classic">{t('teamClassic')}</TabsTrigger>
            </TabsList>

            <TabsContent value="gp">
              {error ? (
                <div className="text-center text-red-400 py-8">{error}</div>
              ) : (
                <>
                  <LeaderboardTable data={leaderboardData} loading={loading} startRank={(page - 1) * 20 + 1} category="GP" />
                  <LeaderboardPagination
                    currentPage={page}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                  />
                </>
              )}
            </TabsContent>

            <TabsContent value="team_gp">
              {error ? (
                <div className="text-center text-red-400 py-8">{error}</div>
              ) : (
                <>
                  <LeaderboardTable data={leaderboardData} loading={loading} startRank={(page - 1) * 20 + 1} category="TEAM_GP" />
                  <LeaderboardPagination
                    currentPage={page}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                  />
                </>
              )}
            </TabsContent>

            <TabsContent value="classic">
              {error ? (
                <div className="text-center text-red-400 py-8">{error}</div>
              ) : (
                <>
                  <LeaderboardTable data={leaderboardData} loading={loading} startRank={(page - 1) * 20 + 1} category="CLASSIC" />
                  <LeaderboardPagination
                    currentPage={page}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                  />
                </>
              )}
            </TabsContent>

            <TabsContent value="team_classic">
              {error ? (
                <div className="text-center text-red-400 py-8">{error}</div>
              ) : (
                <>
                  <LeaderboardTable data={leaderboardData} loading={loading} startRank={(page - 1) * 20 + 1} category="TEAM_CLASSIC" />
                  <LeaderboardPagination
                    currentPage={page}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                  />
                </>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="p-6">
            <div className="h-10 bg-gray-700/50 rounded animate-pulse w-32 mb-4" />
            <div className="h-64 bg-gray-700/30 rounded animate-pulse" />
          </div>
        )}
      </div>
    </main>
  );
}
