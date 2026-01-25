import { useEffect, useRef } from 'react';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';

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

interface UseMatchWebSocketProps {
  nextMatch: Match | null;
  setNextMatch: (match: Match | null) => void;
  setError: (error: string | null) => void;
  fetchData: () => Promise<void>;
  wsConnected: boolean;
  setWsConnected: (connected: boolean) => void;
}

export function useMatchWebSocket({
  nextMatch,
  setNextMatch,
  setError,
  fetchData,
  wsConnected,
  setWsConnected,
}: UseMatchWebSocketProps) {
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();
  const nextMatchRef = useRef<Match | null>(null);
  nextMatchRef.current = nextMatch;

  useEffect(() => {
    const socket = getSocket();

    // WebSocket connection handlers
    const handleConnect = () => {
      console.log('WebSocket connected');
      setWsConnected(true);
    };

    const handleDisconnect = () => {
      console.log('WebSocket disconnected');
      setWsConnected(false);
    };

    // Handle match started event (when match transitions to IN_PROGRESS)
    const handleMatchStarted = (data: { matchId: number; category: string; season: number; match: number }) => {
      console.log('Match started event received:', data);

      // Check if current user is in this match
      if (isAuthenticated && user && nextMatchRef.current?.id === data.matchId) {
        // Redirect to match page
        const matchUrl = `/matches/${data.category}/${data.season}/${data.match}`;
        console.log('Redirecting to match page:', matchUrl);
        router.push(matchUrl);
      }
    };

    // Handle match updated event (player joined/left)
    const handleMatchUpdated = (data: Match) => {
      console.log('Match updated event received:', data);

      // Update match if it's the one we're showing
      if (nextMatchRef.current?.id === data.id) {
        setNextMatch(data);
      }
    };

    // Handle match cancelled event
    const handleMatchCancelled = (data: { matchId: number }) => {
      console.log('Match cancelled event received:', data);

      // Check if it's the match we're showing
      if (nextMatchRef.current?.id === data.matchId) {
        setError('マッチがキャンセルされました（最小人数に達しませんでした）');
        setNextMatch(null);
      }
    };

    // Register event listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('match-started', handleMatchStarted);
    socket.on('match-updated', handleMatchUpdated);
    socket.on('match-cancelled', handleMatchCancelled);

    // Initial fetch
    fetchData();

    // Setup fallback polling (30s) when WebSocket disconnected
    const pollInterval = setInterval(() => {
      if (!wsConnected) {
        console.log('WebSocket disconnected, using fallback polling');
        fetchData();
      }
    }, 30000);

    // Cleanup
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('match-started', handleMatchStarted);
      socket.off('match-updated', handleMatchUpdated);
      socket.off('match-cancelled', handleMatchCancelled);
      clearInterval(pollInterval);
    };
  }, [fetchData, isAuthenticated, user, wsConnected, setWsConnected, setNextMatch, setError, router]);
}
