import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    credentials: true,
  },
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Emit match started event to all clients
  emitMatchStarted(matchData: {
    matchId: string;
    lobbyId: string;
    passcode: string;
    leagueType: string;
    totalPlayers: number;
    startedAt: string;
    mode: string;
    season: number;
    game: number;
    url: string;
  }) {
    this.logger.log(`Emitting match-started event for match ${matchData.matchId}`);
    this.server.emit('match-started', matchData);
  }

  // Emit lobby updated event (e.g., player joined/left)
  emitLobbyUpdated(lobbyData: any) {
    this.logger.log(`Emitting lobby-updated event for lobby ${lobbyData.id}`);
    this.server.emit('lobby-updated', lobbyData);
  }

  // Emit lobby cancelled event
  emitLobbyCancelled(lobbyId: string) {
    this.logger.log(`Emitting lobby-cancelled event for lobby ${lobbyId}`);
    this.server.emit('lobby-cancelled', { lobbyId });
  }
}
