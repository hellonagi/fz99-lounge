import { useEffect, useRef } from 'react';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';

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

interface UseLobbyWebSocketProps {
  nextLobby: Lobby | null;
  setNextLobby: (lobby: Lobby | null) => void;
  setError: (error: string | null) => void;
  fetchData: () => Promise<void>;
  wsConnected: boolean;
  setWsConnected: (connected: boolean) => void;
}

export function useLobbyWebSocket({
  nextLobby,
  setNextLobby,
  setError,
  fetchData,
  wsConnected,
  setWsConnected,
}: UseLobbyWebSocketProps) {
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();
  const nextLobbyRef = useRef<Lobby | null>(null);
  nextLobbyRef.current = nextLobby;

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

    // Handle match started event
    const handleMatchStarted = (data: any) => {
      console.log('Match started event received:', data);

      // Check if current user is in this match
      if (isAuthenticated && user && nextLobbyRef.current?.id === data.lobbyId) {
        // Redirect to match page using new URL format
        const matchUrl = `/matches/${data.mode}/${data.season}/${data.game}`;
        console.log('Redirecting to match page:', matchUrl);
        router.push(matchUrl);
      }
    };

    // Handle lobby updated event (player joined/left)
    const handleLobbyUpdated = (data: any) => {
      console.log('Lobby updated event received:', data);

      // Update lobby if it's the one we're showing
      if (nextLobbyRef.current?.id === data.id) {
        setNextLobby(data);
      }
    };

    // Handle lobby cancelled event
    const handleLobbyCancelled = (data: { lobbyId: string }) => {
      console.log('Lobby cancelled event received:', data);

      // Check if it's the lobby we're showing
      if (nextLobbyRef.current?.id === data.lobbyId) {
        setError('ロビーがキャンセルされました（最小人数に達しませんでした）');
        setNextLobby(null);
      }
    };

    // Register event listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('match-started', handleMatchStarted);
    socket.on('lobby-updated', handleLobbyUpdated);
    socket.on('lobby-cancelled', handleLobbyCancelled);

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
      socket.off('lobby-updated', handleLobbyUpdated);
      socket.off('lobby-cancelled', handleLobbyCancelled);
      clearInterval(pollInterval);
    };
  }, [fetchData, isAuthenticated, user, wsConnected, setWsConnected, setNextLobby, setError, router]);
}
