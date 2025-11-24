import { useEffect, useRef } from 'react';
import io, { Socket } from 'socket.io-client';

interface UseMatchSocketProps {
  matchId: string;
  onScoreUpdated?: (participant: any) => void;
  onStatusChanged?: (status: string) => void;
}

export function useMatchSocket({ matchId, onScoreUpdated, onStatusChanged }: UseMatchSocketProps) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!matchId) return;

    // Connect to the matches namespace
    const socket = io('http://localhost:3000/matches', {
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to match socket');
      // Join the specific match room
      socket.emit('joinMatch', matchId);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from match socket');
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
        socketRef.current.emit('leaveMatch', matchId);
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [matchId, onScoreUpdated, onStatusChanged]);

  return socketRef.current;
}