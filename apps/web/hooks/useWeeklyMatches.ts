import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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

const JST_OFFSET = 9 * 60 * 60 * 1000;

/** Get 7-day range starting from today based on JST */
function getCurrentWeekRangeJST(): { from: string; to: string; weekStartLocal: Date } {
  const nowJst = new Date(Date.now() + JST_OFFSET);

  // Today 00:00 JST
  const todayJst = new Date(Date.UTC(
    nowJst.getUTCFullYear(),
    nowJst.getUTCMonth(),
    nowJst.getUTCDate(),
    0, 0, 0,
  ));
  // Convert to UTC for API query
  const fromUtc = new Date(todayJst.getTime() - JST_OFFSET);
  const toUtc = new Date(fromUtc.getTime() + 7 * 24 * 60 * 60 * 1000);

  return {
    from: fromUtc.toISOString(),
    to: toUtc.toISOString(),
    weekStartLocal: todayJst, // Today in JST (stored as UTC-like Date for day key generation)
  };
}

export function useWeeklyMatches() {
  const [matches, setMatches] = useState<WeeklyMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated, user } = useAuthStore();
  const matchesRef = useRef<WeeklyMatch[]>([]);
  matchesRef.current = matches;

  // Compute once on mount (current week doesn't change during session)
  const { from, to, weekStartLocal } = useMemo(() => getCurrentWeekRangeJST(), []);

  const fetchMatches = useCallback(async () => {
    try {
      const response = await matchesApi.getWeek(from, to);
      setMatches(response.data);
    } catch (err) {
      console.error('Failed to fetch weekly matches:', err);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  // WebSocket listeners
  useEffect(() => {
    const socket = getSocket();

    const handleMatchUpdated = (data: WeeklyMatch) => {
      setMatches((prev) =>
        prev.map((m) => (m.id === data.id ? { ...m, ...data } : m)),
      );
    };

    const handleMatchCancelled = (data: { matchId: number }) => {
      setMatches((prev) => prev.filter((m) => m.id !== data.matchId));
    };

    const handleMatchStarted = (data: { matchId: number }) => {
      setMatches((prev) =>
        prev.map((m) =>
          m.id === data.matchId ? { ...m, status: 'IN_PROGRESS' } : m,
        ),
      );
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
        await fetchMatches();
      } catch (err: unknown) {
        const axiosError = err as { response?: { data?: { message?: string } } };
        alert(axiosError.response?.data?.message || 'Failed to join/leave match');
      } finally {
        setJoiningMatchId(null);
      }
    },
    [isAuthenticated, user, fetchMatches],
  );

  return {
    matches,
    loading,
    weekStartLocal,
    joiningMatchId,
    handleJoinLeave,
  };
}
