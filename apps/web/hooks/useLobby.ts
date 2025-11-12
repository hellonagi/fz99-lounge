import { useState, useCallback } from 'react';
import { lobbiesApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

interface Lobby {
  id: string;
  gameMode: string;
  leagueType: string;
  gameNumber: number;
  scheduledStart: string;
  currentPlayers: number;
  maxPlayers: number;
  minPlayers: number;
  season: {
    id: string;
    seasonNumber: number;
    gameMode: string;
  };
  participants: Array<{
    userId: string;
    user: {
      id: string;
      displayName: string;
      avatarHash: string | null;
    };
  }>;
}

export function useLobby() {
  const [nextLobby, setNextLobby] = useState<Lobby | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ongoingMatchInfo, setOngoingMatchInfo] = useState<{
    mode: string;
    season: number;
    game: number;
  } | null>(null);
  const { isAuthenticated, user } = useAuthStore();

  const fetchData = useCallback(async () => {
    try {
      // Check for ongoing match first
      if (isAuthenticated && user) {
        const inProgressResponse = await lobbiesApi.getAll('GP', 'IN_PROGRESS');
        const inProgressLobbies = inProgressResponse.data;

        // Find lobby where current user is a participant
        const myLobby = inProgressLobbies.find((lobby: any) =>
          lobby.participants.some((qp: any) => qp.userId === user.id)
        );

        if (myLobby) {
          // User is in an ongoing match - redirect to match page
          const mode = myLobby.gameMode === 'GP' ? 'gp' : 'classic';
          const season = myLobby.season?.seasonNumber ?? 0;
          const game = myLobby.gameNumber ?? 0;

          setOngoingMatchInfo({ mode, season, game });
          setNextLobby(null);
          setError(null);
          setLoading(false);
          return;
        }
      }

      // No ongoing match, fetch next lobby
      setOngoingMatchInfo(null);

      const response = await lobbiesApi.getNext('GP');
      const lobby = response.data.lobby;

      if (lobby) {
        setNextLobby(lobby);
        setError(null);
      } else {
        setNextLobby(null);
        setError('No Upcoming Lobby Found');
      }
    } catch (err: any) {
      setError('Failed to Load Lobby');
      setNextLobby(null);
      setOngoingMatchInfo(null);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user]);

  return {
    nextLobby,
    setNextLobby,
    loading,
    error,
    setError,
    ongoingMatchInfo,
    fetchData,
  };
}
