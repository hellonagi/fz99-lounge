'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { CreateSeasonForm, SeasonsList, SeasonCard } from '@/components/features/seasons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Trophy, Calendar } from 'lucide-react';
import { seasonsApi } from '@/lib/api';

export default function SeasonsManagementPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
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
    // Check authentication after mount
    if (mounted) {
      if (!isAuthenticated || !user) {
        router.push('/login');
      } else if (user.role !== 'ADMIN' && user.role !== 'MODERATOR') {
        router.push('/');
      } else {
        fetchActiveSeasons();
      }
    }
  }, [mounted, user, isAuthenticated, router]);

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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <span className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // If not authorized, don't render anything (redirect will happen)
  if (!user || (user.role !== 'ADMIN' && user.role !== 'MODERATOR')) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push('/admin')}
            className="mb-4 text-gray-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            管理ダッシュボードに戻る
          </Button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Trophy className="h-8 w-8 text-yellow-500" />
                シーズン管理
              </h1>
              <p className="mt-2 text-gray-400">
                F-Zero 99のシーズンを作成・管理します
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-gray-300">
                {user.displayName || user.username}
              </Badge>
              <Badge variant="success">
                {user.role}
              </Badge>
            </div>
          </div>
        </div>

        {/* Active Seasons Overview */}
        {!loadingActive && activeSeasons.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              現在のアクティブシーズン
            </h2>
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
          <h3 className="text-white font-semibold mb-3">シーズン管理について</h3>
          <ul className="space-y-2 text-gray-400 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-blue-400 mt-0.5">•</span>
              <span>各ゲームモード（GP/CLASSIC）で同時にアクティブにできるシーズンは1つだけです</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 mt-0.5">•</span>
              <span>シーズンを削除すると、関連するロビーとマッチデータも削除される可能性があります</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 mt-0.5">•</span>
              <span>終了日を設定しない場合、シーズンは無期限で継続されます</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 mt-0.5">•</span>
              <span>シーズン番号は各ゲームモードごとに一意である必要があります</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}