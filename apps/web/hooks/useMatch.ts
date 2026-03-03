import { useState, useCallback } from 'react';
import { matchesApi } from '@/lib/api';

interface Match {
  id: number;
  category: string;
  inGameMode: string;
  leagueType: string | null;
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

// Minutes after match start to stop showing on hero and move to next match
const MATCH_DISPLAY_DURATION: Record<string, number> = {
  classic: 10,
  team_classic: 12,
  gp: 15,
  team_gp: 17,
};

export function useMatch() {
  const [nextMatch, setNextMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ongoingGameInfo, setOngoingGameInfo] = useState<{
    category: string;
    season: number;
    match: number;
  } | null>(null);
  const [timeOffset, setTimeOffset] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      // First, check for any IN_PROGRESS matches (all categories)
      const inProgressResponse = await matchesApi.getAll(undefined, 'IN_PROGRESS');
      const inProgressMatches = inProgressResponse.data;

      // If there's an IN_PROGRESS match that hasn't exceeded display duration, show it
      if (inProgressMatches && inProgressMatches.length > 0) {
        const inProgressMatch = inProgressMatches[0];
        const category = inProgressMatch.category?.toLowerCase() ||
                         inProgressMatch.season?.event?.category?.toLowerCase() || 'gp';
        const durationMin = MATCH_DISPLAY_DURATION[category] ?? 15;
        const startedAt = new Date(inProgressMatch.scheduledStart).getTime();
        const elapsed = (Date.now() - startedAt) / 60000;

        if (elapsed < durationMin) {
          const season = inProgressMatch.season?.seasonNumber ?? 0;
          const match = inProgressMatch.matchNumber ?? 0;

          setOngoingGameInfo({ category, season, match });
          setNextMatch(inProgressMatch);
          setError(null);
          setLoading(false);
          return;
        }
      }

      // No IN_PROGRESS match, fetch next waiting match (all categories)
      setOngoingGameInfo(null);

      const response = await matchesApi.getNext();
      const match = response.data.match;

      // Calculate time offset between server and client
      if (response.data.serverTime) {
        const serverTime = new Date(response.data.serverTime).getTime();
        const clientTime = Date.now();
        setTimeOffset(serverTime - clientTime);
      }

      if (match) {
        setNextMatch(match);
        setError(null);
      } else {
        setNextMatch(null);
        setError('NO_UPCOMING_MATCH');
      }
    } catch {
      setError('FAILED_TO_LOAD');
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
    timeOffset,
  };
}
