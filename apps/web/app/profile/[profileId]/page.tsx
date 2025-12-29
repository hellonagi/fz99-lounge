'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usersApi } from '@/lib/api';
import { ProfileHeader } from '@/components/features/profile/profile-header';
import { RecentMatches } from '@/components/features/profile/recent-matches';
import { SeasonStats } from '@/components/features/profile/season-stats';
import { RatingChart } from '@/components/features/profile/rating-chart';
import { TrackStats } from '@/components/features/profile/track-stats';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import type { UserProfileResponse, UserSeasonStats } from '@/types';

type ProfileCategory = 'GP' | 'CLASSIC';

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const [user, setUser] = useState<UserProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profileId = parseInt(params.profileId as string, 10);
        if (isNaN(profileId)) {
          setError('Invalid profile ID');
          setLoading(false);
          return;
        }

        const response = await usersApi.getUserByProfileId(profileId);
        setUser(response.data);
      } catch (err: unknown) {
        console.error('Failed to fetch profile:', err);
        const axiosError = err as { response?: { status?: number } };
        if (axiosError.response?.status === 404) {
          setError('User not found');
        } else {
          setError('Failed to load profile');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [params.profileId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2">{error || 'User not found'}</h2>
          <button
            onClick={() => router.push('/')}
            className="text-blue-400 hover:text-blue-300"
          >
            Go back to home
          </button>
        </div>
      </div>
    );
  }

  // Get season stats for each category
  const getSeasonStatsForCategory = (category: ProfileCategory): UserSeasonStats | undefined => {
    return user.seasonStats?.find(
      (stats) => stats.season?.event?.category === category
    );
  };

  // For header, show CLASSIC stats
  const headerStats = getSeasonStatsForCategory('CLASSIC');

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header with user info */}
      <ProfileHeader user={user} seasonStats={headerStats} />

      {/* Category Tabs */}
      <Card className="bg-gray-800/50 border-gray-700 mt-6">
        <Tabs defaultValue="CLASSIC">
          <TabsList>
            <TabsTrigger value="CLASSIC">CLASSIC</TabsTrigger>
          </TabsList>

          <TabsContent value="CLASSIC" className="p-0">
            <CategoryContent
              userId={user.id}
              category="CLASSIC"
              stats={getSeasonStatsForCategory('CLASSIC')}
            />
          </TabsContent>
        </Tabs>
      </Card>
    </main>
  );
}

interface CategoryContentProps {
  userId: number;
  category: ProfileCategory;
  stats?: UserSeasonStats;
}

function CategoryContent({ userId, category, stats }: CategoryContentProps) {
  return (
    <div className="space-y-6">
      {/* Two Column Layout: Recent Matches & Season Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentMatches userId={userId} category={category} />
        </div>
        <div>
          <SeasonStats stats={stats} />
        </div>
      </div>

      {/* Rating Chart */}
      <RatingChart userId={userId} category={category} />

      {/* Track Stats */}
      <TrackStats userId={userId} category={category} />
    </div>
  );
}
