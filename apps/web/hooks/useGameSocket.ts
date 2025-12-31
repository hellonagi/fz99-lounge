import { useEffect, useRef } from 'react';
import io, { Socket } from 'socket.io-client';

export interface SplitVoteUpdate {
  currentVotes: number;
  requiredVotes: number;
  votedBy: number;
}

export interface PasscodeRegeneratedUpdate {
  passcode: string;
  passcodeVersion: number;
  currentVotes: number;
  requiredVotes: number;
}

export interface ParticipantUpdate {
  id: number;
  userId: number;
  position: number | null;
  reportedPoints: number | null;
  finalPoints: number | null;
  machine: string;
  assistEnabled: boolean;
  totalScore: number | null;
  eliminatedAtRace: number | null;
  ratingAfter: number | null;
  ratingChange: number | null;
  raceResults?: Array<{
    raceNumber: number;
    position: number | null;
    points: number | null;
    isEliminated: boolean;
    isDisconnected: boolean;
  }>;
  user: {
    id: number;
    profileId: number;
    displayName: string | null;
    avatarHash: string | null;
  };
}

interface UseGameSocketProps {
  gameId: number;
  onScoreUpdated?: (participant: ParticipantUpdate) => void;
  onStatusChanged?: (status: string) => void;
  onSplitVoteUpdated?: (data: SplitVoteUpdate) => void;
  onPasscodeRegenerated?: (data: PasscodeRegeneratedUpdate) => void;
}

export function useGameSocket({
  gameId,
  onScoreUpdated,
  onStatusChanged,
  onSplitVoteUpdated,
  onPasscodeRegenerated,
}: UseGameSocketProps) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!gameId) return;

    // Connect to the games namespace
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
    const socket = io(`${baseUrl}/games`, {
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to game socket');
      // Join the specific game room
      socket.emit('joinGame', gameId);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from game socket');
    });

    socket.on('scoreUpdated', (participant) => {
      console.log('Score updated:', participant);
      if (onScoreUpdated) {
        onScoreUpdated(participant);
      }
    });

    socket.on('statusChanged', (status) => {
      console.log('Status changed:', status);
      if (onStatusChanged) {
        onStatusChanged(status);
      }
    });

    socket.on('splitVoteUpdated', (data: SplitVoteUpdate) => {
      console.log('Split vote updated:', data);
      if (onSplitVoteUpdated) {
        onSplitVoteUpdated(data);
      }
    });

    socket.on('passcodeRegenerated', (data: PasscodeRegeneratedUpdate) => {
      console.log('Passcode regenerated:', data);
      if (onPasscodeRegenerated) {
        onPasscodeRegenerated(data);
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leaveGame', gameId);
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [gameId, onScoreUpdated, onStatusChanged, onSplitVoteUpdated, onPasscodeRegenerated]);

  return socketRef.current;
}
