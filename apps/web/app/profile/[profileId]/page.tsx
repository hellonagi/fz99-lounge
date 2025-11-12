'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usersApi } from '@/lib/api';
import { ProfileHeader } from '@/components/features/profile/profile-header';
import { StatsGrid } from '@/components/features/profile/stats-grid';
import { RecentMatches } from '@/components/features/profile/recent-matches';
import { SeasonStats } from '@/components/features/profile/season-stats';
import type { UserProfileResponse } from '@/types';

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
      } catch (err: any) {
        console.error('Failed to fetch profile:', err);
        if (err.response?.status === 404) {
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

  // Calculate win rate
  const winRate = user.stats99?.totalMatches
    ? (user.stats99.totalWins / user.stats99.totalMatches) * 100
    : 0;

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <ProfileHeader user={user} />
      <StatsGrid
        totalMatches={user.stats99?.totalMatches}
        wins={user.stats99?.totalWins}
        winRate={winRate}
        avgPosition={user.stats99?.averagePosition}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <RecentMatches />
        </div>
        <div className="space-y-6">
          <SeasonStats
            league={user.stats99 ? 'King League' : undefined}
            mmr={user.stats99?.mmr}
            rank={undefined}
          />
        </div>
      </div>
    </main>
  );
}
