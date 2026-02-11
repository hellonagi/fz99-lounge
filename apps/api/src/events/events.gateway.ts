import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
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

  // Emit match started event to all clients (when match transitions to IN_PROGRESS)
  emitMatchStarted(matchData: {
    matchId: number;
    gameId: number;
    passcode: string;
    leagueType: string | null;
    totalPlayers: number;
    startedAt: string;
    category: string;
    season: number;
    match: number;
    url: string;
  }) {
    this.logger.log(`Emitting match-started event for match ${matchData.matchId}`);
    this.server.emit('match-started', matchData);
  }

  // Emit match updated event (e.g., player joined/left)
  emitMatchUpdated(matchData: any) {
    this.logger.log(`Emitting match-updated event for match ${matchData.id}`);
    this.server.emit('match-updated', matchData);
  }

  // Emit match cancelled event
  emitMatchCancelled(matchId: number) {
    this.logger.log(`Emitting match-cancelled event for match ${matchId}`);
    this.server.emit('match-cancelled', { matchId });
  }

  // Emit match completed event (deadline reached, ratings calculated)
  emitMatchCompleted(matchId: number) {
    this.logger.log(`Emitting match-completed event for match ${matchId}`);
    this.server.emit('match-completed', { matchId });
  }

  // Emit team assigned event (TEAM_CLASSIC mode)
  emitTeamAssigned(data: {
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
  }) {
    this.logger.log(`Emitting team-assigned event for match ${data.matchId}`);
    this.server.emit('team-assigned', data);
  }

  // Emit passcode revealed event (TEAM_CLASSIC mode - after 3 min delay)
  emitPasscodeRevealed(data: {
    matchId: number;
    gameId: number;
    passcode: string;
  }) {
    this.logger.log(`Emitting passcode-revealed event for match ${data.matchId}`);
    this.server.emit('passcode-revealed', data);
  }

  // Handle match:update from clients (e.g., simulators) and broadcast to all
  @SubscribeMessage('match:update')
  handleMatchUpdate(@MessageBody() matchData: any) {
    this.logger.log(`Received match:update from client, broadcasting...`);
    this.emitMatchUpdated(matchData);
  }

  // Legacy support: handle lobby:update and map to match:update
  @SubscribeMessage('lobby:update')
  handleLobbyUpdate(@MessageBody() lobbyData: any) {
    this.logger.log(`Received legacy lobby:update from client, broadcasting as match...`);
    this.emitMatchUpdated(lobbyData);
  }
}
