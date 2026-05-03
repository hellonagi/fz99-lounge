import { useState, useEffect, useCallback, useRef, useMemo, startTransition } from 'react';
import { matchesApi } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/authStore';

interface WeeklyMatch {
  id: number;
  matchNumber: number | null;
  status: string;
  scheduledStart: string;
  minPlayers: number;
  maxPlayers: number;
  currentPlayers?: number;
  notes: string | null;
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
      discordId: string;
      displayName: string | null;
      avatarHash: string | null;
    };
  }>;
  games: Array<{
    id: number;
    inGameMode: string;
    leagueType: string | null;
  }>;
}

/** Get 7-day range starting from today in local timezone */
function getCurrentWeekRangeLocal(): { from: string; to: string; weekStartLocal: Date } {
  const now = new Date();
  const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endLocal = new Date(todayLocal.getTime() + 7 * 24 * 60 * 60 * 1000);

  return {
    from: todayLocal.toISOString(),
    to: endLocal.toISOString(),
    weekStartLocal: todayLocal,
  };
}

export function useWeeklyMatches() {
  const [matches, setMatches] = useState<WeeklyMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated, user } = useAuthStore();
  const matchesRef = useRef<WeeklyMatch[]>([]);
  matchesRef.current = matches;

  // Compute once on mount (current week doesn't change during session)
  const { from, to, weekStartLocal } = useMemo(() => getCurrentWeekRangeLocal(), []);

  const fetchMatches = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const response = await matchesApi.getWeek(from, to);
      if (showLoading) {
        setMatches(response.data);
      } else {
        startTransition(() => setMatches(response.data));
      }
    } catch (err) {
      console.error('Failed to fetch weekly matches:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  // WebSocket listeners
  useEffect(() => {
    const socket = getSocket();

    const handleMatchUpdated = (data: WeeklyMatch) => {
      startTransition(() => {
        setMatches((prev) =>
          prev.map((m) => (m.id === data.id ? { ...m, ...data } : m)),
        );
      });
    };

    const handleMatchCancelled = (data: { matchId: number }) => {
      startTransition(() => {
        setMatches((prev) => prev.filter((m) => m.id !== data.matchId));
      });
    };

    const handleMatchStarted = (data: { matchId: number }) => {
      startTransition(() => {
        setMatches((prev) =>
          prev.map((m) =>
            m.id === data.matchId ? { ...m, status: 'IN_PROGRESS' } : m,
          ),
        );
      });
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

  const [joiningMatchId, setJoiningMatchId] = useState<number | null>(null);

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
      } catch (err: unknown) {
        const axiosError = err as { response?: { data?: { message?: string } } };
        alert(axiosError.response?.data?.message || 'Failed to join/leave match');
      } finally {
        setJoiningMatchId(null);
      }
    },
    [isAuthenticated, user],
  );

  return {
    matches,
    loading,
    weekStartLocal,
    joiningMatchId,
    handleJoinLeave,
  };
}
