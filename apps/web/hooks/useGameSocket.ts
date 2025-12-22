import { useEffect, useRef } from 'react';
import io, { Socket } from 'socket.io-client';

interface UseGameSocketProps {
  gameId: number;
  onScoreUpdated?: (participant: any) => void;
  onStatusChanged?: (status: string) => void;
}

export function useGameSocket({ gameId, onScoreUpdated, onStatusChanged }: UseGameSocketProps) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!gameId) return;

    // Connect to the games namespace
    const socket = io('http://localhost:3000/games', {
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

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leaveGame', gameId);
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [gameId, onScoreUpdated, onStatusChanged]);

  return socketRef.current;
}
