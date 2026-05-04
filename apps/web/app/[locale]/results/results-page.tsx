'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { matchesApi, seasonsApi, tournamentsApi } from '@/lib/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SeasonSelect } from '@/components/features/leaderboard/season-select';
import { MatchList } from '@/components/features/results/match-list';
import { TournamentResultList } from '@/components/features/results/tournament-result-list';
import { ResultsPagination } from '@/components/features/results/results-pagination';
import { RecentTournament } from '@/types';

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

type TabMode = 'gp' | 'team_gp' | 'classic' | 'team_classic' | 'tournament';
type Category = 'GP' | 'CLASSIC' | 'TEAM_CLASSIC' | 'TEAM_GP';

const MODE_TO_CATEGORY: Record<string, Category> = {
  gp: 'GP',
  'team-gp': 'TEAM_GP',
  classic: 'CLASSIC',
  'team-classic': 'TEAM_CLASSIC',
};

const CATEGORY_TO_MODE: Record<Category, string> = {
  GP: 'gp',
  TEAM_GP: 'team-gp',
  CLASSIC: 'classic',
  TEAM_CLASSIC: 'team-classic',
};

function getInitialTab(mode: string | null): TabMode {
  if (mode === 'tournament') return 'tournament';
  if (mode && MODE_TO_CATEGORY[mode]) return mode as TabMode;
  return 'gp';
}

function getCategoryFromTab(tab: TabMode): Category | null {
  if (tab === 'tournament') return null;
  const key = tab.replace('_', '-');
  return MODE_TO_CATEGORY[key] ?? (tab.toUpperCase() as Category);
}

export default function ResultsPage() {
  const t = useTranslations('results');
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabMode>(() => getInitialTab(searchParams.get('mode')));
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonNumber, setSelectedSeasonNumber] = useState<number | undefined>();
  const [page, setPage] = useState(1);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tournament-specific state
  const [tournaments, setTournaments] = useState<RecentTournament[]>([]);
  const [tournamentsLoading, setTournamentsLoading] = useState(false);
  const [tournamentsError, setTournamentsError] = useState<string | null>(null);

  const isTournamentTab = activeTab === 'tournament';
  const activeCategory = getCategoryFromTab(activeTab);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch seasons when category changes (not for tournament tab)
  useEffect(() => {
    if (isTournamentTab) return;

    const fetchSeasons = async () => {
      try {
        const response = await seasonsApi.getAll(activeCategory!);
        const seasonList = response.data as Season[];
        setSeasons(seasonList);
        setSelectedSeasonNumber(undefined);
        setPage(1);

        // Auto-select active season (skip Unrated seasonNumber=0)
        const activeSeason = seasonList.find((s: Season) => s.isActive && s.seasonNumber !== -1);
        if (activeSeason) {
          setSelectedSeasonNumber(activeSeason.seasonNumber);
        } else {
          const regularSeasons = seasonList.filter((s: Season) => s.seasonNumber !== -1);
          if (regularSeasons.length > 0) {
            const latestSeason = regularSeasons.reduce((prev: Season, curr: Season) =>
              curr.seasonNumber > prev.seasonNumber ? curr : prev
            );
            setSelectedSeasonNumber(latestSeason.seasonNumber);
          } else if (seasonList.length > 0) {
            setSelectedSeasonNumber(seasonList[0].seasonNumber);
          }
        }
      } catch {
        setError(t('failedToLoadSeasons'));
        setLoading(false);
      }
    };

    fetchSeasons();
  }, [activeCategory, isTournamentTab, t]);

  // Fetch matches when season or page changes (not for tournament tab)
  useEffect(() => {
    if (isTournamentTab || selectedSeasonNumber === undefined || !activeCategory) return;

    const fetchResults = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await matchesApi.getResults({
          category: activeCategory,
          seasonNumber: selectedSeasonNumber,
          page,
          limit: 20,
        });
        setMatches(response.data.data);
        setMeta(response.data.meta);
      } catch {
        setError(t('failedToLoadResults'));
        setMatches([]);
        setMeta(null);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [activeCategory, selectedSeasonNumber, page, isTournamentTab, t]);

  // Fetch tournaments when tournament tab is active
  useEffect(() => {
    if (!isTournamentTab) return;

    const fetchTournaments = async () => {
      setTournamentsLoading(true);
      setTournamentsError(null);
      try {
        const response = await tournamentsApi.getRecent(100);
        setTournaments(response.data);
      } catch {
        setTournamentsError(t('failedToLoadTournaments'));
        setTournaments([]);
      } finally {
        setTournamentsLoading(false);
      }
    };

    fetchTournaments();
  }, [isTournamentTab, t]);

  const handleSeasonChange = (seasonNumber: number) => {
    setSelectedSeasonNumber(seasonNumber);
    setPage(1);
  };

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value as TabMode);
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'tournament') {
      params.set('mode', 'tournament');
    } else {
      const category = value.toUpperCase() as Category;
      params.set('mode', CATEGORY_TO_MODE[category] || value);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, router, pathname]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const renderMatchContent = () => (
    <>
      {error ? (
        <div className="text-center text-red-400 py-8">{error}</div>
      ) : (
        <>
          {meta && (
            <div className="text-[11px] font-bold tracking-[.12em] uppercase text-gray-500 mb-3 px-4 sm:px-0">
              {t('matchesFound', { count: meta.total })}
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
    </>
  );

  const renderTournamentContent = () => (
    <>
      {tournamentsError ? (
        <div className="text-center text-red-400 py-8">{tournamentsError}</div>
      ) : (
        <>
          {!tournamentsLoading && tournaments.length > 0 && (
            <div className="text-[11px] font-bold tracking-[.12em] uppercase text-gray-500 mb-3 px-4 sm:px-0">
              {t('tournamentsFound', { count: tournaments.length })}
            </div>
          )}
          <TournamentResultList
            tournaments={tournaments}
            loading={tournamentsLoading}
          />
        </>
      )}
    </>
  );

  return (
    <main className="max-w-6xl mx-auto sm:px-4 lg:px-8 py-4 sm:py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 px-4 sm:px-0">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
          {t('title')}
        </h1>
        {!isTournamentTab && seasons.length > 0 && selectedSeasonNumber !== undefined && (
          <SeasonSelect
            seasons={seasons}
            selectedSeasonNumber={selectedSeasonNumber}
            onSeasonChange={handleSeasonChange}
          />
        )}
      </div>

      {/* Tabs */}
      {mounted ? (
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="px-4 sm:px-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsTrigger value="gp">{t('gp')}</TabsTrigger>
            <TabsTrigger value="team_gp">{t('teamGp')}</TabsTrigger>
            <TabsTrigger value="classic">{t('classic')}</TabsTrigger>
            <TabsTrigger value="team_classic">{t('teamClassic')}</TabsTrigger>
            <TabsTrigger value="tournament">{t('tournament')}</TabsTrigger>
          </TabsList>

          <TabsContent value="gp" className="p-0 pt-4 sm:pt-6">
            {renderMatchContent()}
          </TabsContent>

          <TabsContent value="team_gp" className="p-0 pt-4 sm:pt-6">
            {renderMatchContent()}
          </TabsContent>

          <TabsContent value="classic" className="p-0 pt-4 sm:pt-6">
            {renderMatchContent()}
          </TabsContent>

          <TabsContent value="team_classic" className="p-0 pt-4 sm:pt-6">
            {renderMatchContent()}
          </TabsContent>

          <TabsContent value="tournament" className="p-0 pt-4 sm:pt-6">
            {renderTournamentContent()}
          </TabsContent>
        </Tabs>
      ) : (
        <div className="px-4 sm:px-0">
          <div className="h-10 bg-white/[.05] rounded animate-pulse w-32 mb-4" />
          <div className="h-64 bg-white/[.05] rounded animate-pulse" />
        </div>
      )}
    </main>
  );
}
