import { useState, useCallback } from 'react';
import { matchesApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

interface Match {
  id: number;
  category: string;
  inGameMode: string;
  leagueType: string;
  matchNumber: number;
  scheduledStart: string;
  currentPlayers: number;
  maxPlayers: number;
  minPlayers: number;
  season: {
    id: number;
    seasonNumber: number;
    event: {
      id: number;
      category: string;
    };
  };
  participants: Array<{
    userId: number;
    user: {
      id: number;
      displayName: string;
      avatarHash: string | null;
    };
  }>;
}

export function useMatch() {
  const [nextMatch, setNextMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ongoingGameInfo, setOngoingGameInfo] = useState<{
    category: string;
    season: number;
    match: number;
  } | null>(null);
  const { isAuthenticated, user } = useAuthStore();

  const fetchData = useCallback(async () => {
    try {
      // First, check for any IN_PROGRESS matches (all categories)
      const inProgressResponse = await matchesApi.getAll(undefined, 'IN_PROGRESS');
      const inProgressMatches = inProgressResponse.data;

      // If there's an IN_PROGRESS match, show it with game page link
      if (inProgressMatches && inProgressMatches.length > 0) {
        const inProgressMatch = inProgressMatches[0]; // Get the first one
        const category = inProgressMatch.category?.toLowerCase() ||
                         inProgressMatch.season?.event?.category?.toLowerCase() || 'gp';
        const season = inProgressMatch.season?.seasonNumber ?? 0;
        const match = inProgressMatch.matchNumber ?? 0;

        setOngoingGameInfo({ category, season, match });
        setNextMatch(inProgressMatch);
        setError(null);
        setLoading(false);
        return;
      }

      // No IN_PROGRESS match, fetch next waiting match (all categories)
      setOngoingGameInfo(null);

      const response = await matchesApi.getNext();
      const match = response.data.match;

      if (match) {
        setNextMatch(match);
        setError(null);
      } else {
        setNextMatch(null);
        setError('No Upcoming Match Found');
      }
    } catch (err: any) {
      setError('Failed to Load Match');
      setNextMatch(null);
      setOngoingGameInfo(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    nextMatch,
    setNextMatch,
    loading,
    error,
    setError,
    ongoingGameInfo,
    fetchData,
  };
}
