'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { usersApi } from '@/lib/api';
import { ProfileHeader } from '@/components/features/profile/profile-header';
import { RecentMatches } from '@/components/features/profile/recent-matches';
import { SeasonStats } from '@/components/features/profile/season-stats';
import { RatingChart } from '@/components/features/profile/rating-chart';
import { TrackStats } from '@/components/features/profile/track-stats';
import { ProfileSeasonSelect } from '@/components/features/profile/profile-season-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import type { UserProfileResponse, UserSeasonStats, Season } from '@/types';

type ProfileCategory = 'GP' | 'CLASSIC' | 'TEAM_CLASSIC';

interface UserSeason extends Season {
  event?: { category: string };
}

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<UserProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seasons, setSeasons] = useState<UserSeason[]>([]);
  const [selectedSeasonNumber, setSelectedSeasonNumber] = useState<number | undefined>(undefined);

  // TEAM_CLASSIC independent state
  const [teamClassicSeasons, setTeamClassicSeasons] = useState<UserSeason[]>([]);
  const [teamClassicSelectedSeason, setTeamClassicSelectedSeason] = useState<number | undefined>(undefined);
  const [teamClassicUser, setTeamClassicUser] = useState<UserProfileResponse | null>(null);

  // Get initial season from URL query parameter
  const initialSeasonFromUrl = searchParams.get('season');

  const fetchUserWithSeason = useCallback(async (profileId: number, seasonNumber?: number, category?: ProfileCategory) => {
    const response = await usersApi.getUserByProfileId(profileId, seasonNumber, category);
    return response.data;
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profileId = parseInt(params.profileId as string, 10);
        if (isNaN(profileId)) {
          setError('Invalid profile ID');
          setLoading(false);
          return;
        }

        // First, fetch user with default (active) season to get user ID
        const initialResponse = await usersApi.getUserByProfileId(profileId);
        const userData: UserProfileResponse = initialResponse.data;
        setUser(userData);

        // Fetch CLASSIC and TEAM_CLASSIC seasons in parallel
        const [classicSeasonsRes, teamClassicSeasonsRes] = await Promise.all([
          usersApi.getUserSeasons(userData.id, 'CLASSIC'),
          usersApi.getUserSeasons(userData.id, 'TEAM_CLASSIC'),
        ]);
        const userSeasons: UserSeason[] = classicSeasonsRes.data;
        const tcSeasons: UserSeason[] = teamClassicSeasonsRes.data;
        setSeasons(userSeasons);
        setTeamClassicSeasons(tcSeasons);

        // Determine which CLASSIC season to select
        let targetSeasonNumber: number | undefined;
        if (initialSeasonFromUrl) {
          const seasonFromUrl = parseInt(initialSeasonFromUrl, 10);
          if (!isNaN(seasonFromUrl) && userSeasons.some(s => s.seasonNumber === seasonFromUrl)) {
            targetSeasonNumber = seasonFromUrl;
          }
        }
        if (targetSeasonNumber === undefined) {
          const activeSeason = userSeasons.find(s => s.isActive);
          targetSeasonNumber = activeSeason?.seasonNumber ?? userSeasons[0]?.seasonNumber;
        }
        setSelectedSeasonNumber(targetSeasonNumber);

        // If we need a different season than active, refetch
        if (targetSeasonNumber !== undefined) {
          const activeSeasonNumber = userData.seasonStats?.[0]?.season?.seasonNumber;
          if (activeSeasonNumber !== targetSeasonNumber) {
            const seasonUserData = await fetchUserWithSeason(profileId, targetSeasonNumber, 'CLASSIC');
            setUser(seasonUserData);
          }
        }

        // Determine TEAM_CLASSIC default season
        if (tcSeasons.length > 0) {
          const tcActiveSeason = tcSeasons.find(s => s.isActive);
          const tcDefaultSeason = tcActiveSeason?.seasonNumber ?? tcSeasons[0]?.seasonNumber;
          setTeamClassicSelectedSeason(tcDefaultSeason);

          // Fetch TEAM_CLASSIC user data
          if (tcDefaultSeason !== undefined) {
            const tcUserData = await fetchUserWithSeason(profileId, tcDefaultSeason, 'TEAM_CLASSIC');
            setTeamClassicUser(tcUserData);
          }
        }
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
  }, [params.profileId, initialSeasonFromUrl, fetchUserWithSeason]);

  const handleSeasonChange = async (newSeasonNumber: number) => {
    if (!user || newSeasonNumber === selectedSeasonNumber) return;

    setSelectedSeasonNumber(newSeasonNumber);

    // Update URL with new season
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set('season', String(newSeasonNumber));
    router.replace(`?${newParams.toString()}`, { scroll: false });

    // Fetch user data for new season
    try {
      const profileId = parseInt(params.profileId as string, 10);
      const updatedUser = await fetchUserWithSeason(profileId, newSeasonNumber, 'CLASSIC');
      setUser(updatedUser);
    } catch (err) {
      console.error('Failed to fetch season data:', err);
    }
  };

  const handleTeamClassicSeasonChange = async (newSeasonNumber: number) => {
    if (!user || newSeasonNumber === teamClassicSelectedSeason) return;

    setTeamClassicSelectedSeason(newSeasonNumber);

    try {
      const profileId = parseInt(params.profileId as string, 10);
      const updatedUser = await fetchUserWithSeason(profileId, newSeasonNumber, 'TEAM_CLASSIC');
      setTeamClassicUser(updatedUser);
    } catch (err) {
      console.error('Failed to fetch team classic season data:', err);
    }
  };

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

  const getTeamClassicSeasonStats = (): UserSeasonStats | undefined => {
    return teamClassicUser?.seasonStats?.find(
      (stats) => stats.season?.event?.category === 'TEAM_CLASSIC'
    );
  };

  // For header, show CLASSIC stats
  const headerStats = getSeasonStatsForCategory('CLASSIC');
  const headerTeamClassicStats = getTeamClassicSeasonStats();

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header with user info */}
      <ProfileHeader user={user} seasonStats={headerStats} teamClassicStats={headerTeamClassicStats} />

      {/* Category Tabs */}
      <Card className="bg-gray-800/50 border-gray-700 mt-6">
        <Tabs defaultValue="CLASSIC">
          <div className="p-4 pb-0">
            <TabsList>
              <TabsTrigger value="CLASSIC">CLASSIC</TabsTrigger>
              {teamClassicSeasons.length > 0 && (
                <TabsTrigger value="TEAM_CLASSIC">TEAM CLASSIC</TabsTrigger>
              )}
            </TabsList>
          </div>

          <TabsContent value="CLASSIC" className="p-0">
            {/* Season Selector */}
            {seasons.length > 0 && (
              <div className="flex justify-end mb-4">
                <ProfileSeasonSelect
                  seasons={seasons}
                  selectedSeasonNumber={selectedSeasonNumber}
                  onSeasonChange={handleSeasonChange}
                />
              </div>
            )}
            <CategoryContent
              userId={user.id}
              category="CLASSIC"
              stats={getSeasonStatsForCategory('CLASSIC')}
              seasonNumber={selectedSeasonNumber}
            />
          </TabsContent>

          {teamClassicSeasons.length > 0 && (
            <TabsContent value="TEAM_CLASSIC" className="p-0">
              {/* Season Selector */}
              {teamClassicSeasons.length > 0 && (
                <div className="flex justify-end mb-4">
                  <ProfileSeasonSelect
                    seasons={teamClassicSeasons}
                    selectedSeasonNumber={teamClassicSelectedSeason}
                    onSeasonChange={handleTeamClassicSeasonChange}
                  />
                </div>
              )}
              <CategoryContent
                userId={user.id}
                category="TEAM_CLASSIC"
                stats={getTeamClassicSeasonStats()}
                seasonNumber={teamClassicSelectedSeason}
              />
            </TabsContent>
          )}
        </Tabs>
      </Card>
    </main>
  );
}

interface CategoryContentProps {
  userId: number;
  category: ProfileCategory;
  stats?: UserSeasonStats;
  seasonNumber?: number;
}

function CategoryContent({ userId, category, stats, seasonNumber }: CategoryContentProps) {
  return (
    <div className="space-y-6">
      {/* Two Column Layout: Recent Matches & Season Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentMatches userId={userId} category={category} seasonNumber={seasonNumber} />
        </div>
        <div>
          <SeasonStats stats={stats} category={category} />
        </div>
      </div>

      {/* Rating Chart */}
      <RatingChart userId={userId} category={category} seasonNumber={seasonNumber} />

      {/* Track Stats */}
      <TrackStats userId={userId} category={category} />
    </div>
  );
}
