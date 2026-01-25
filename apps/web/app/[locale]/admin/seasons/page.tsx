'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { CreateSeasonForm, SeasonsList, SeasonCard } from '@/components/features/seasons';
import { Trophy, Calendar } from 'lucide-react';
import { seasonsApi } from '@/lib/api';

export default function SeasonsManagementPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeSeasons, setActiveSeasons] = useState<Array<{
    id: number;
    seasonNumber: number;
    description: string | null;
    startDate: string;
    endDate: string | null;
    isActive: boolean;
    event: { category: 'GP' | 'CLASSIC' | 'TOURNAMENT'; name: string };
  }>>([]);
  const [loadingActive, setLoadingActive] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Seasons page is ADMIN only
    if (user && user.role !== 'ADMIN') {
      router.push('/admin/matches');
    }
  }, [user, router]);

  useEffect(() => {
    // Auth check is handled by the layout
    if (mounted && user && user.role === 'ADMIN') {
      fetchActiveSeasons();
    }
  }, [mounted, user]);

  const fetchActiveSeasons = async () => {
    try {
      setLoadingActive(true);
      const [gpResponse, classicResponse] = await Promise.all([
        seasonsApi.getActive('GP').catch(() => null),
        seasonsApi.getActive('CLASSIC').catch(() => null),
      ]);

      const seasons = [];
      if (gpResponse?.data) seasons.push(gpResponse.data);
      if (classicResponse?.data) seasons.push(classicResponse.data);
      setActiveSeasons(seasons);
    } catch (err) {
      console.error('Error fetching active seasons:', err);
    } finally {
      setLoadingActive(false);
    }
  };

  const handleSeasonCreated = () => {
    setRefreshTrigger(prev => prev + 1);
    fetchActiveSeasons();
  };

  // Show loading while checking auth
  if (!mounted) {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Only ADMIN can access seasons
  if (!user || user.role !== 'ADMIN') {
    return null;
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <Trophy className="h-7 w-7 text-yellow-500" />
          Season Management
        </h2>
        <p className="mt-2 text-gray-400">
          Create and manage F-Zero 99 seasons
        </p>
      </div>

      {/* Active Seasons Overview */}
      {!loadingActive && activeSeasons.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Active Seasons
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeSeasons.map(season => (
              <SeasonCard
                key={season.id}
                season={season}
              />
            ))}
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Create Season Form - 1 column */}
        <div className="lg:col-span-1">
          <CreateSeasonForm onSuccess={handleSeasonCreated} />
        </div>

        {/* Seasons List - 2 columns */}
        <div className="lg:col-span-2">
          <SeasonsList refreshTrigger={refreshTrigger} />
        </div>
      </div>

      {/* Help Section */}
      <div className="mt-12 p-6 bg-gray-800 border border-gray-700 rounded-lg">
        <h3 className="text-white font-semibold mb-3">About Season Management</h3>
        <ul className="space-y-2 text-gray-400 text-sm">
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">•</span>
            <span>Only one season per game mode (GP/CLASSIC) can be active at a time</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">•</span>
            <span>Deleting a season may also delete related lobbies and match data</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">•</span>
            <span>If no end date is set, the season will continue indefinitely</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">•</span>
            <span>Season numbers must be unique per game mode</span>
          </li>
        </ul>
      </div>
    </div>
  );
}