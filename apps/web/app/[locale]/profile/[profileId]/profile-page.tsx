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

type ProfileCategory = 'GP' | 'CLASSIC' | 'TEAM_CLASSIC' | 'TEAM_GP';

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

  // GP independent state
  const [gpSeasons, setGpSeasons] = useState<UserSeason[]>([]);
  const [gpSelectedSeason, setGpSelectedSeason] = useState<number | undefined>(undefined);
  const [gpUser, setGpUser] = useState<UserProfileResponse | null>(null);

  // TEAM_GP independent state
  const [teamGpSeasons, setTeamGpSeasons] = useState<UserSeason[]>([]);
  const [teamGpSelectedSeason, setTeamGpSelectedSeason] = useState<number | undefined>(undefined);
  const [teamGpUser, setTeamGpUser] = useState<UserProfileResponse | null>(null);

  // Tab state (must be before any early returns)
  const [activeTab, setActiveTab] = useState<string>(
    (searchParams.get('mode') || '').toUpperCase().replace('-', '_')
  );

  // Get initial values from URL query parameters
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

        // Fetch all category seasons in parallel
        const [classicSeasonsRes, gpSeasonsRes, teamClassicSeasonsRes, teamGpSeasonsRes] = await Promise.all([
          usersApi.getUserSeasons(userData.id, 'CLASSIC'),
          usersApi.getUserSeasons(userData.id, 'GP'),
          usersApi.getUserSeasons(userData.id, 'TEAM_CLASSIC'),
          usersApi.getUserSeasons(userData.id, 'TEAM_GP'),
        ]);
        const userSeasons: UserSeason[] = classicSeasonsRes.data;
        const gpSeasonsData: UserSeason[] = gpSeasonsRes.data;
        const tcSeasons: UserSeason[] = teamClassicSeasonsRes.data;
        const tgpSeasons: UserSeason[] = teamGpSeasonsRes.data;
        setSeasons(userSeasons);
        setGpSeasons(gpSeasonsData);
        setTeamClassicSeasons(tcSeasons);
        setTeamGpSeasons(tgpSeasons);

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

        // Determine GP default season
        if (gpSeasonsData.length > 0) {
          const gpActiveSeason = gpSeasonsData.find(s => s.isActive);
          const gpDefaultSeason = gpActiveSeason?.seasonNumber ?? gpSeasonsData[0]?.seasonNumber;
          setGpSelectedSeason(gpDefaultSeason);

          if (gpDefaultSeason !== undefined) {
            const gpUserData = await fetchUserWithSeason(profileId, gpDefaultSeason, 'GP');
            setGpUser(gpUserData);
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

        // Determine TEAM_GP default season
        if (tgpSeasons.length > 0) {
          const tgpActiveSeason = tgpSeasons.find(s => s.isActive);
          const tgpDefaultSeason = tgpActiveSeason?.seasonNumber ?? tgpSeasons[0]?.seasonNumber;
          setTeamGpSelectedSeason(tgpDefaultSeason);

          // Fetch TEAM_GP user data
          if (tgpDefaultSeason !== undefined) {
            const tgpUserData = await fetchUserWithSeason(profileId, tgpDefaultSeason, 'TEAM_GP');
            setTeamGpUser(tgpUserData);
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

  const handleGpSeasonChange = async (newSeasonNumber: number) => {
    if (!user || newSeasonNumber === gpSelectedSeason) return;

    setGpSelectedSeason(newSeasonNumber);

    try {
      const profileId = parseInt(params.profileId as string, 10);
      const updatedUser = await fetchUserWithSeason(profileId, newSeasonNumber, 'GP');
      setGpUser(updatedUser);
    } catch (err) {
      console.error('Failed to fetch gp season data:', err);
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

  const handleTeamGpSeasonChange = async (newSeasonNumber: number) => {
    if (!user || newSeasonNumber === teamGpSelectedSeason) return;

    setTeamGpSelectedSeason(newSeasonNumber);

    try {
      const profileId = parseInt(params.profileId as string, 10);
      const updatedUser = await fetchUserWithSeason(profileId, newSeasonNumber, 'TEAM_GP');
      setTeamGpUser(updatedUser);
    } catch (err) {
      console.error('Failed to fetch team gp season data:', err);
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

  const getGpSeasonStats = (): UserSeasonStats | undefined => {
    return gpUser?.seasonStats?.find(
      (stats) => stats.season?.event?.category === 'GP'
    );
  };

  const getTeamClassicSeasonStats = (): UserSeasonStats | undefined => {
    return teamClassicUser?.seasonStats?.find(
      (stats) => stats.season?.event?.category === 'TEAM_CLASSIC'
    );
  };

  const getTeamGpSeasonStats = (): UserSeasonStats | undefined => {
    return teamGpUser?.seasonStats?.find(
      (stats) => stats.season?.event?.category === 'TEAM_GP'
    );
  };

  // Resolve active tab (set default if not yet determined)
  const validTabs: ProfileCategory[] = ['GP', 'TEAM_GP', 'CLASSIC', 'TEAM_CLASSIC'];
  const defaultTab = gpSeasons.length > 0 ? 'GP' : 'CLASSIC';
  const resolvedTab = (activeTab && validTabs.includes(activeTab as ProfileCategory))
    ? activeTab
    : defaultTab;

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set('mode', value.toLowerCase().replace('_', '-'));
    router.replace(`?${newParams.toString()}`, { scroll: false });
  };

  // For header, show stats for each category
  const headerStats = getSeasonStatsForCategory('CLASSIC');
  const headerTeamClassicStats = getTeamClassicSeasonStats();
  const headerGpStats = getGpSeasonStats();
  const headerTeamGpStats = getTeamGpSeasonStats();

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header with user info */}
      <ProfileHeader
        user={user}
        seasonStats={headerStats}
        teamClassicStats={headerTeamClassicStats}
        gpStats={headerGpStats}
        teamGpStats={headerTeamGpStats}
      />

      {/* Category Tabs */}
      <Card className="bg-gray-800/50 border-gray-700 mt-6">
        <Tabs value={resolvedTab} onValueChange={handleTabChange}>
          <div className="p-4 pb-0">
            <TabsList>
              {gpSeasons.length > 0 && (
                <TabsTrigger value="GP">GP</TabsTrigger>
              )}
              {teamGpSeasons.length > 0 && (
                <TabsTrigger value="TEAM_GP">TEAM GP</TabsTrigger>
              )}
              <TabsTrigger value="CLASSIC">CLASSIC</TabsTrigger>
              {teamClassicSeasons.length > 0 && (
                <TabsTrigger value="TEAM_CLASSIC">TEAM CLASSIC</TabsTrigger>
              )}
            </TabsList>
          </div>

          {gpSeasons.length > 0 && (
            <TabsContent value="GP" className="p-0">
              {gpSeasons.length > 0 && (
                <div className="flex justify-end mb-4">
                  <ProfileSeasonSelect
                    seasons={gpSeasons}
                    selectedSeasonNumber={gpSelectedSeason}
                    onSeasonChange={handleGpSeasonChange}
                  />
                </div>
              )}
              <CategoryContent
                userId={user.id}
                category="GP"
                stats={getGpSeasonStats()}
                seasonNumber={gpSelectedSeason}
              />
            </TabsContent>
          )}

          {teamGpSeasons.length > 0 && (
            <TabsContent value="TEAM_GP" className="p-0">
              {teamGpSeasons.length > 0 && (
                <div className="flex justify-end mb-4">
                  <ProfileSeasonSelect
                    seasons={teamGpSeasons}
                    selectedSeasonNumber={teamGpSelectedSeason}
                    onSeasonChange={handleTeamGpSeasonChange}
                  />
                </div>
              )}
              <CategoryContent
                userId={user.id}
                category="TEAM_GP"
                stats={getTeamGpSeasonStats()}
                seasonNumber={teamGpSelectedSeason}
              />
            </TabsContent>
          )}

          <TabsContent value="CLASSIC" className="p-0">
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
