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
  namespace: '/games',
  pingTimeout: 60000,
  pingInterval: 25000,
})
export class GamesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private gameRooms = new Map<number, Set<string>>();

  handleConnection(client: Socket) {
    console.log(`Client connected to games namespace: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected from games namespace: ${client.id}`);
    // Remove client from all game rooms
    this.gameRooms.forEach((clients, gameId) => {
      clients.delete(client.id);
      if (clients.size === 0) {
        this.gameRooms.delete(gameId);
      }
    });
  }

  @SubscribeMessage('joinGame')
  handleJoinGame(client: Socket, gameId: number) {
    client.join(`game:${gameId}`);

    // Track which clients are in which game rooms
    if (!this.gameRooms.has(gameId)) {
      this.gameRooms.set(gameId, new Set());
    }
    this.gameRooms.get(gameId)?.add(client.id);

    console.log(`Client ${client.id} joined game room: ${gameId}`);
  }

  @SubscribeMessage('leaveGame')
  handleLeaveGame(client: Socket, gameId: number) {
    client.leave(`game:${gameId}`);
    this.gameRooms.get(gameId)?.delete(client.id);

    console.log(`Client ${client.id} left game room: ${gameId}`);
  }

  @OnEvent('game.scoreUpdated')
  handleScoreUpdated(payload: { gameId: number; participant: any }) {
    // Emit to all clients in the game room
    this.server.to(`game:${payload.gameId}`).emit('scoreUpdated', payload.participant);
    console.log(`Score update emitted to game room: ${payload.gameId}`);
  }

  @OnEvent('game.statusChanged')
  handleStatusChanged(payload: { gameId: number; status: string }) {
    // Emit status change to all clients in the game room
    this.server.to(`game:${payload.gameId}`).emit('statusChanged', payload.status);
    console.log(`Status change emitted to game room: ${payload.gameId}`);
  }

  @OnEvent('game.splitVoteUpdated')
  handleSplitVoteUpdated(payload: {
    gameId: number;
    currentVotes: number;
    requiredVotes: number;
    votedBy: number;
  }) {
    // Emit split vote update to all clients in the game room
    this.server.to(`game:${payload.gameId}`).emit('splitVoteUpdated', {
      currentVotes: payload.currentVotes,
      requiredVotes: payload.requiredVotes,
      votedBy: payload.votedBy,
    });
    console.log(`Split vote update emitted to game room: ${payload.gameId}`);
  }

  @OnEvent('game.passcodeRegenerated')
  handlePasscodeRegenerated(payload: {
    gameId: number;
    passcode: string;
    passcodeVersion: number;
    requiredVotes: number;
  }) {
    // Emit passcode regenerated to all clients in the game room
    this.server.to(`game:${payload.gameId}`).emit('passcodeRegenerated', {
      passcode: payload.passcode,
      passcodeVersion: payload.passcodeVersion,
      currentVotes: 0,
      requiredVotes: payload.requiredVotes,
    });
    console.log(`Passcode regenerated event emitted to game room: ${payload.gameId}`);
  }

  @OnEvent('game.screenshotUpdated')
  handleScreenshotUpdated(payload: {
    gameId: number;
    screenshot: {
      id: number;
      userId: number;
      imageUrl: string | null;
      type: string;
      isVerified: boolean;
      isRejected: boolean;
      isDeleted?: boolean;
      uploadedAt: Date;
      user: {
        id: number;
        displayName: string | null;
        username: string;
      };
    };
  }) {
    // Emit screenshot update to all clients in the game room
    this.server.to(`game:${payload.gameId}`).emit('screenshotUpdated', payload.screenshot);
    console.log(`Screenshot update emitted to game room: ${payload.gameId}`);
  }
}
