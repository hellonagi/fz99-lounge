import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  },
  namespace: '/matches',
})
export class MatchesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private matchRooms = new Map<string, Set<string>>();

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    // Remove client from all match rooms
    this.matchRooms.forEach((clients, matchId) => {
      clients.delete(client.id);
      if (clients.size === 0) {
        this.matchRooms.delete(matchId);
      }
    });
  }

  @SubscribeMessage('joinMatch')
  handleJoinMatch(client: Socket, matchId: string) {
    client.join(`match:${matchId}`);

    // Track which clients are in which match rooms
    if (!this.matchRooms.has(matchId)) {
      this.matchRooms.set(matchId, new Set());
    }
    this.matchRooms.get(matchId)?.add(client.id);

    console.log(`Client ${client.id} joined match room: ${matchId}`);
  }

  @SubscribeMessage('leaveMatch')
  handleLeaveMatch(client: Socket, matchId: string) {
    client.leave(`match:${matchId}`);
    this.matchRooms.get(matchId)?.delete(client.id);

    console.log(`Client ${client.id} left match room: ${matchId}`);
  }

  @OnEvent('match.scoreUpdated')
  handleScoreUpdated(payload: { matchId: string; participant: any }) {
    // Emit to all clients in the match room
    this.server.to(`match:${payload.matchId}`).emit('scoreUpdated', payload.participant);
    console.log(`Score update emitted to match room: ${payload.matchId}`);
  }

  @OnEvent('match.statusChanged')
  handleStatusChanged(payload: { matchId: string; status: string }) {
    // Emit status change to all clients in the match room
    this.server.to(`match:${payload.matchId}`).emit('statusChanged', payload.status);
    console.log(`Status change emitted to match room: ${payload.matchId}`);
  }
}