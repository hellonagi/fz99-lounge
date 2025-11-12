import { useState } from 'react';
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

export function useLobbyActions(
  nextLobby: Lobby | null,
  setNextLobby: (lobby: Lobby | null) => void
) {
  const [isJoining, setIsJoining] = useState(false);
  const { isAuthenticated, user } = useAuthStore();

  // Check if current user is in lobby
  const isUserInLobby =
    nextLobby?.participants.some((qp) => qp.userId === user?.id) || false;

  const handleJoinClick = async () => {
    if (!isAuthenticated || !user) {
      alert('Please login to join a lobby');
      return;
    }

    if (!nextLobby) {
      alert('No lobby available');
      return;
    }

    setIsJoining(true);
    try {
      if (isUserInLobby) {
        // Leave lobby
        await lobbiesApi.leave(nextLobby.id);
      } else {
        // Join lobby
        await lobbiesApi.join(nextLobby.id);
      }

      // Refresh lobby data
      const response = await lobbiesApi.getNext('GP');
      setNextLobby(response.data.lobby);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to join/leave lobby');
    } finally {
      setIsJoining(false);
    }
  };

  return {
    isUserInLobby,
    isJoining,
    handleJoinClick,
  };
}
