import { useEffect, useRef } from 'react';
import io, { Socket } from 'socket.io-client';

export interface SplitVoteUpdate {
  currentVotes: number;
  requiredVotes: number;
  votedBy: number;
}

export interface PasscodeCountdownStartedUpdate {
  passcodeRevealTime: string;
}

export interface PasscodeRegeneratedUpdate {
  passcode: string;
  passcodeVersion: number;
  currentVotes: number;
  requiredVotes: number;
}

export interface ScreenshotUpdate {
  id: number;
  userId: number;
  imageUrl: string | null;
  type: 'INDIVIDUAL' | 'FINAL_SCORE';
  isVerified: boolean;
  isRejected: boolean;
  isDeleted?: boolean;
  uploadedAt: string;
  user: {
    id: number;
    displayName: string | null;
    username: string;
  };
}

export interface TeamAssignedUpdate {
  matchId: number;
  gameId: number;
  teamConfig: string;
  teams: Array<{
    teamIndex: number;
    teamNumber: number;
    color: string;
    colorHex: string;
    userIds: number[];
  }>;
  excludedUserIds: number[];
  passcodeRevealTime: string;
}

export interface PasscodeRevealedUpdate {
  matchId: number;
  gameId: number;
  passcode: string;
}

export interface ParticipantUpdate {
  gameId?: number;
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
  status?: string;
  screenshotRequested?: boolean;
  raceResults?: Array<{
    raceNumber: number;
    position: number | null;
    points: number | null;
    isEliminated: boolean;
    isDisconnected: boolean;
  }>;
  user: {
    id: number;
    profileNumber: number;
    displayName: string | null;
    avatarHash: string | null;
  };
}

interface UseGameSocketProps {
  gameId: number | number[];
  onScoreUpdated?: (participant: ParticipantUpdate) => void;
  onStatusChanged?: (status: string) => void;
  onSplitVoteUpdated?: (data: SplitVoteUpdate) => void;
  onPasscodeRegenerated?: (data: PasscodeRegeneratedUpdate) => void;
  onScreenshotUpdated?: (data: ScreenshotUpdate) => void;
  onTeamAssigned?: (data: TeamAssignedUpdate) => void;
  onPasscodeRevealed?: (data: PasscodeRevealedUpdate) => void;
  onParticipantVerified?: (participant: ParticipantUpdate) => void;
  onParticipantRejected?: (participant: ParticipantUpdate) => void;
  onScreenshotRequested?: (participant: ParticipantUpdate) => void;
  onParticipantNoShow?: (participant: ParticipantUpdate) => void;
  onPasscodeCountdownStarted?: (data: PasscodeCountdownStartedUpdate) => void;
  onPasscodeHidden?: () => void;
  onSplitVoteThresholdReached?: (data: { currentVotes: number; requiredVotes: number }) => void;
}

export function useGameSocket({
  gameId,
  onScoreUpdated,
  onStatusChanged,
  onSplitVoteUpdated,
  onPasscodeRegenerated,
  onScreenshotUpdated,
  onTeamAssigned,
  onPasscodeRevealed,
  onParticipantVerified,
  onParticipantRejected,
  onScreenshotRequested,
  onParticipantNoShow,
  onPasscodeCountdownStarted,
  onPasscodeHidden,
  onSplitVoteThresholdReached,
}: UseGameSocketProps) {
  const socketRef = useRef<Socket | null>(null);

  // Store callbacks in refs so socket doesn't reconnect when they change
  const callbacksRef = useRef({
    onScoreUpdated,
    onStatusChanged,
    onSplitVoteUpdated,
    onPasscodeRegenerated,
    onScreenshotUpdated,
    onTeamAssigned,
    onPasscodeRevealed,
    onParticipantVerified,
    onParticipantRejected,
    onScreenshotRequested,
    onParticipantNoShow,
    onPasscodeCountdownStarted,
    onPasscodeHidden,
    onSplitVoteThresholdReached,
  });
  callbacksRef.current = {
    onScoreUpdated,
    onStatusChanged,
    onSplitVoteUpdated,
    onPasscodeRegenerated,
    onScreenshotUpdated,
    onTeamAssigned,
    onPasscodeRevealed,
    onParticipantVerified,
    onParticipantRejected,
    onScreenshotRequested,
    onParticipantNoShow,
    onPasscodeCountdownStarted,
    onPasscodeHidden,
    onSplitVoteThresholdReached,
  };

  // Normalize to array and create stable key for deps
  const gameIds = (Array.isArray(gameId) ? gameId : [gameId]).filter(Boolean);
  const gameIdsKey = gameIds.join(',');

  useEffect(() => {
    if (gameIds.length === 0) return;

    // Connect to the games namespace
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
    const socket = io(`${baseUrl}/games`, {
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to game socket');
      // Join all game rooms
      for (const id of gameIds) {
        socket.emit('joinGame', id);
      }
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from game socket');
    });

    socket.on('scoreUpdated', (participant) => {
      callbacksRef.current.onScoreUpdated?.(participant);
    });

    socket.on('statusChanged', (status) => {
      callbacksRef.current.onStatusChanged?.(status);
    });

    socket.on('splitVoteUpdated', (data: SplitVoteUpdate) => {
      callbacksRef.current.onSplitVoteUpdated?.(data);
    });

    socket.on('passcodeRegenerated', (data: PasscodeRegeneratedUpdate) => {
      callbacksRef.current.onPasscodeRegenerated?.(data);
    });

    socket.on('screenshotUpdated', (data: ScreenshotUpdate) => {
      callbacksRef.current.onScreenshotUpdated?.(data);
    });

    socket.on('teamAssigned', (data: TeamAssignedUpdate) => {
      callbacksRef.current.onTeamAssigned?.(data);
    });

    socket.on('passcodeRevealed', (data: PasscodeRevealedUpdate) => {
      callbacksRef.current.onPasscodeRevealed?.(data);
    });

    socket.on('participantVerified', (participant: ParticipantUpdate) => {
      callbacksRef.current.onParticipantVerified?.(participant);
    });

    socket.on('participantRejected', (participant: ParticipantUpdate) => {
      callbacksRef.current.onParticipantRejected?.(participant);
    });

    socket.on('screenshotRequested', (participant: ParticipantUpdate) => {
      callbacksRef.current.onScreenshotRequested?.(participant);
    });

    socket.on('participantNoShow', (participant: ParticipantUpdate) => {
      callbacksRef.current.onParticipantNoShow?.(participant);
    });

    socket.on('passcodeCountdownStarted', (data: PasscodeCountdownStartedUpdate) => {
      callbacksRef.current.onPasscodeCountdownStarted?.(data);
    });

    socket.on('passcodeHidden', () => {
      callbacksRef.current.onPasscodeHidden?.();
    });

    socket.on('splitVoteThresholdReached', (data: { currentVotes: number; requiredVotes: number }) => {
      callbacksRef.current.onSplitVoteThresholdReached?.(data);
    });

    return () => {
      if (socketRef.current) {
        for (const id of gameIds) {
          socketRef.current.emit('leaveGame', id);
        }
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [gameIdsKey]);

  return socketRef.current;
}
