import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { CreateLobbyDto } from './dto/create-lobby.dto';
import { GameMode, LobbyStatus, UserStatus } from '@prisma/client';

@Injectable()
export class LobbiesService {
  // 詳細なロビー情報を取得するための共通includeオプション
  private readonly lobbyDetailInclude = {
    event: {
      include: {
        season: true,
        tournament: true,
      },
    },
    participants: {
      include: {
        user: {
          select: {
            id: true,
            profileId: true,
            displayName: true,
            avatarHash: true,
          },
        },
      },
    },
    matches: true,
  };

  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
    @InjectQueue('matches') private matchQueue: Queue,
  ) {}

  async create(createLobbyDto: CreateLobbyDto, createdBy: string) {
    const { gameMode, leagueType, scheduledStart, minPlayers, maxPlayers, notes } = createLobbyDto;

    // Get active event with season
    const event = await this.prisma.event.findFirst({
      where: {
        isActive: true,
        type: 'SEASON',
        season: {
          gameMode,
        },
      },
      include: {
        season: true,
      },
    });

    if (!event || !event.season) {
      throw new BadRequestException(`No active season found for ${gameMode}`);
    }

    // Get next game number
    const lastLobby = await this.prisma.lobby.findFirst({
      where: { eventId: event.id },
      orderBy: { gameNumber: 'desc' },
    });

    const gameNumber = lastLobby && lastLobby.gameNumber ? lastLobby.gameNumber + 1 : 1;

    const lobby = await this.prisma.lobby.create({
      data: {
        gameMode,
        leagueType,
        eventId: event.id,
        gameNumber,
        scheduledStart: new Date(scheduledStart),
        minPlayers: minPlayers || 40,
        maxPlayers: maxPlayers || 99,
        createdBy,
        notes,
        status: LobbyStatus.WAITING,
      },
      include: this.lobbyDetailInclude,
    });

    // Schedule BullMQ job to start match at scheduledStart time
    const now = new Date();
    const delay = new Date(scheduledStart).getTime() - now.getTime();

    if (delay > 0) {
      await this.matchQueue.add(
        'start-match',
        { lobbyId: lobby.id },
        {
          delay,
          removeOnComplete: true,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );
    }

    return lobby;
  }

  async getAll(gameMode?: GameMode, status?: LobbyStatus) {
    return this.prisma.lobby.findMany({
      where: {
        ...(gameMode && { gameMode }),
        ...(status && { status }),
      },
      orderBy: { scheduledStart: 'asc' },
      include: this.lobbyDetailInclude,
    });
  }

  async getNext(gameMode: GameMode = GameMode.GP) {
    const now = new Date();

    const lobby = await this.prisma.lobby.findFirst({
      where: {
        gameMode,
        status: LobbyStatus.WAITING,
        scheduledStart: { gte: now },
      },
      orderBy: { scheduledStart: 'asc' },
      include: this.lobbyDetailInclude,
    });

    return lobby;
  }

  async getById(lobbyId: string) {
    const lobby = await this.prisma.lobby.findUnique({
      where: { id: lobbyId },
      include: this.lobbyDetailInclude,
    });

    if (!lobby) {
      throw new NotFoundException('Lobby not found');
    }

    return lobby;
  }

  async join(lobbyId: string, userId: string) {
    const lobby = await this.getById(lobbyId);

    // Check if lobby is in WAITING status
    if (lobby.status !== LobbyStatus.WAITING) {
      throw new BadRequestException('Lobby is not accepting players');
    }

    // Check if lobby is full
    if (lobby.currentPlayers >= lobby.maxPlayers) {
      throw new BadRequestException('Lobby is full');
    }

    // Check if user is already a participant
    const existingParticipant = await this.prisma.lobbyParticipant.findUnique({
      where: {
        lobbyId_userId: {
          lobbyId,
          userId,
        },
      },
    });

    if (existingParticipant) {
      throw new BadRequestException('Already in lobby');
    }

    // Check if user is banned or suspended
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        suspension: true,
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.status === UserStatus.BANNED) {
      throw new ForbiddenException('You are permanently banned');
    }

    if (user.status === UserStatus.SUSPENDED) {
      if (user.suspension && user.suspension.suspendedUntil > new Date()) {
        throw new ForbiddenException('You are currently suspended');
      }
    }

    // Add user as participant and update player count in a transaction
    const updatedLobby = await this.prisma.$transaction(async (tx) => {
      await tx.lobbyParticipant.create({
        data: {
          lobbyId,
          userId,
        },
      });

      const updated = await tx.lobby.update({
        where: { id: lobbyId },
        data: {
          currentPlayers: { increment: 1 },
        },
        include: this.lobbyDetailInclude,
      });

      return updated;
    });

    // Emit WebSocket event to notify all clients
    this.eventsGateway.emitLobbyUpdated(updatedLobby);

    return updatedLobby;
  }

  async leave(lobbyId: string, userId: string) {
    const lobby = await this.getById(lobbyId);

    // Check if lobby is in WAITING status
    if (lobby.status !== LobbyStatus.WAITING) {
      throw new BadRequestException('Cannot leave lobby at this time');
    }

    // Check if user is a participant
    const participant = await this.prisma.lobbyParticipant.findUnique({
      where: {
        lobbyId_userId: {
          lobbyId,
          userId,
        },
      },
    });

    if (!participant) {
      throw new BadRequestException('Not in lobby');
    }

    // Remove user from participants and update player count in a transaction
    const updatedLobby = await this.prisma.$transaction(async (tx) => {
      await tx.lobbyParticipant.delete({
        where: { id: participant.id },
      });

      const updated = await tx.lobby.update({
        where: { id: lobbyId },
        data: {
          currentPlayers: { decrement: 1 },
        },
        include: this.lobbyDetailInclude,
      });

      return updated;
    });

    // Emit WebSocket event to notify all clients
    this.eventsGateway.emitLobbyUpdated(updatedLobby);

    return updatedLobby;
  }

  async cancel(lobbyId: string) {
    const lobby = await this.getById(lobbyId);

    // Only allow cancellation of WAITING or IN_PROGRESS lobbies
    if (lobby.status !== LobbyStatus.WAITING && lobby.status !== LobbyStatus.IN_PROGRESS) {
      throw new BadRequestException(
        'Can only cancel lobbies in WAITING or IN_PROGRESS status'
      );
    }

    // Update lobby status to CANCELLED
    const updatedLobby = await this.prisma.lobby.update({
      where: { id: lobbyId },
      data: { status: LobbyStatus.CANCELLED },
      include: this.lobbyDetailInclude,
    });

    // Emit WebSocket event to notify all clients
    this.eventsGateway.emitLobbyUpdated(updatedLobby);

    return { message: 'Lobby cancelled successfully', lobby: updatedLobby };
  }

  async delete(lobbyId: string) {
    const lobby = await this.getById(lobbyId);

    // Only allow deletion of WAITING lobbies
    if (lobby.status !== LobbyStatus.WAITING) {
      throw new BadRequestException(
        'Cannot delete lobby that is not in WAITING status'
      );
    }

    // First delete all related LobbyParticipant records
    await this.prisma.lobbyParticipant.deleteMany({
      where: { lobbyId },
    });

    // Then delete the lobby
    await this.prisma.lobby.delete({
      where: { id: lobbyId },
    });

    return { message: 'Lobby deleted successfully' };
  }
}
