import { useState, useEffect, useCallback, useRef } from 'react';
import { matchesApi } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/authStore';

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

export function useUpcomingMatches(heroMatchId: number | null) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningMatchId, setJoiningMatchId] = useState<number | null>(null);
  const { isAuthenticated, user } = useAuthStore();
  const matchesRef = useRef<Match[]>([]);
  matchesRef.current = matches;

  const fetchMatches = useCallback(async () => {
    try {
      const response = await matchesApi.getAll(undefined, 'WAITING');
      const allWaiting: Match[] = response.data;
      setMatches(allWaiting);
    } catch (err) {
      console.error('Failed to fetch upcoming matches:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  // WebSocket listeners
  useEffect(() => {
    const socket = getSocket();

    const handleMatchUpdated = (data: Match) => {
      setMatches((prev) =>
        prev.map((m) => (m.id === data.id ? data : m))
      );
    };

    const handleMatchCancelled = (data: { matchId: number }) => {
      setMatches((prev) => prev.filter((m) => m.id !== data.matchId));
    };

    const handleMatchStarted = (data: { matchId: number }) => {
      setMatches((prev) => prev.filter((m) => m.id !== data.matchId));
    };

    socket.on('match-updated', handleMatchUpdated);
    socket.on('match-cancelled', handleMatchCancelled);
    socket.on('match-started', handleMatchStarted);

    return () => {
      socket.off('match-updated', handleMatchUpdated);
      socket.off('match-cancelled', handleMatchCancelled);
      socket.off('match-started', handleMatchStarted);
    };
  }, []);

  // Filter out hero match
  const upcomingMatches = heroMatchId
    ? matches.filter((m) => m.id !== heroMatchId)
    : matches;

  const handleJoinLeave = useCallback(
    async (matchId: number) => {
      if (!isAuthenticated || !user) return;

      const match = matchesRef.current.find((m) => m.id === matchId);
      if (!match) return;

      const isInMatch = match.participants.some((p) => p.userId === user.id);

      setJoiningMatchId(matchId);
      try {
        if (isInMatch) {
          await matchesApi.leave(matchId);
        } else {
          await matchesApi.join(matchId);
        }
        // Refetch to get updated data
        await fetchMatches();
      } catch (err: unknown) {
        const axiosError = err as { response?: { data?: { message?: string } } };
        alert(axiosError.response?.data?.message || 'Failed to join/leave match');
      } finally {
        setJoiningMatchId(null);
      }
    },
    [isAuthenticated, user, fetchMatches]
  );

  return {
    matches: upcomingMatches,
    loading,
    joiningMatchId,
    handleJoinLeave,
  };
}
