import { useState } from 'react';
import { matchesApi } from '@/lib/api';
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

export function useMatchActions(
  nextMatch: Match | null,
  setNextMatch: (match: Match | null) => void
) {
  const [isJoining, setIsJoining] = useState(false);
  const { isAuthenticated, user } = useAuthStore();

  // Check if current user is in match
  const isUserInMatch =
    nextMatch?.participants.some((p) => p.userId === user?.id) || false;

  const handleJoinClick = async () => {
    if (!isAuthenticated || !user) {
      alert('Please login to join a match');
      return;
    }

    if (!nextMatch) {
      alert('No match available');
      return;
    }

    setIsJoining(true);
    try {
      if (isUserInMatch) {
        // Leave match
        await matchesApi.leave(nextMatch.id);
      } else {
        // Join match
        await matchesApi.join(nextMatch.id);
      }

      // Refresh match data (all categories)
      const response = await matchesApi.getNext();
      setNextMatch(response.data.match);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      alert(axiosError.response?.data?.message || 'Failed to join/leave match');
    } finally {
      setIsJoining(false);
    }
  };

  return {
    isUserInMatch,
    isJoining,
    handleJoinClick,
  };
}
