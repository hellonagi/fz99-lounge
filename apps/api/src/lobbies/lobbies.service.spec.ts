import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { LobbiesService } from './lobbies.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { LobbyStatus, UserStatus } from '@prisma/client';
import { Queue } from 'bull';

describe('LobbiesService', () => {
  let service: LobbiesService;
  let prisma: PrismaService;

  const mockPrismaService = {
    lobby: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    lobbyParticipant: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((callback) => {
      // トランザクション内でcallbackを実行
      return callback(mockPrismaService);
    }),
  };

  const mockEventsGateway = {
    emitToLobby: jest.fn(),
    emitLobbyUpdated: jest.fn(),
  };

  const mockMatchQueue = {
    add: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LobbiesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: EventsGateway,
          useValue: mockEventsGateway,
        },
        {
          provide: 'BullQueue_matches',
          useValue: mockMatchQueue,
        },
      ],
    }).compile();

    service = module.get<LobbiesService>(LobbiesService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('join', () => {
    const lobbyId = 'lobby-123';
    const userId = 'user-456';

    it('should allow user to join lobby successfully', async () => {
      // Arrange - モックの設定
      const mockLobby = {
        id: lobbyId,
        status: LobbyStatus.WAITING,
        currentPlayers: 50,
        maxPlayers: 99,
      };

      const mockUser = {
        id: userId,
        status: UserStatus.ACTIVE,
        suspension: null,
      };

      const updatedLobby = {
        id: lobbyId,
        status: LobbyStatus.WAITING,
        currentPlayers: 51,
        maxPlayers: 99,
        event: { season: {}, tournament: {} },
        participants: [{ user: { id: userId } }],
        matches: [],
      };

      // getById の代わりに findUnique を使う
      mockPrismaService.lobby.findUnique.mockResolvedValue(mockLobby);
      // ユーザーが既に参加していない
      mockPrismaService.lobbyParticipant.findUnique.mockResolvedValue(null);
      // ユーザー情報取得
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      // 参加処理成功
      mockPrismaService.lobbyParticipant.create.mockResolvedValue({
        lobbyId,
        userId,
      });
      // lobby.update がupdatedLobbyを返す
      mockPrismaService.lobby.update.mockResolvedValue(updatedLobby);

      // Act - メソッド実行
      const result = await service.join(lobbyId, userId);

      // Assert - 検証
      // 1. lobbyParticipant.create が呼ばれた
      expect(mockPrismaService.lobbyParticipant.create).toHaveBeenCalledWith({
        data: {
          lobbyId,
          userId,
        },
      });

      // 2. lobby.update が includeオプション付きで呼ばれた
      expect(mockPrismaService.lobby.update).toHaveBeenCalledWith({
        where: { id: lobbyId },
        data: {
          currentPlayers: { increment: 1 },
        },
        include: expect.objectContaining({
          event: expect.any(Object),
          participants: expect.any(Object),
          matches: true,
        }),
      });

      // 3. eventsGateway.emitLobbyUpdated が呼ばれた
      expect(mockEventsGateway.emitLobbyUpdated).toHaveBeenCalledWith(
        updatedLobby,
      );

      // 4. 返り値が正しい
      expect(result).toEqual(updatedLobby);
    });

    it('should throw NotFoundException if lobby not found', async () => {
      // Arrange - ロビーが見つからない
      mockPrismaService.lobby.findUnique.mockResolvedValue(null);

      // Act & Assert - メソッド実行してエラーを検証
      await expect(service.join(lobbyId, userId)).rejects.toThrow(
        'Lobby not found',
      );
    });

    it('should throw BadRequestException if lobby status is not WAITING', async () => {
      // Arrange - ロビーのステータスがIN_PROGRESS
      const mockLobby = {
        id: lobbyId,
        status: LobbyStatus.IN_PROGRESS,
        currentPlayers: 50,
        maxPlayers: 99,
      };

      mockPrismaService.lobby.findUnique.mockResolvedValue(mockLobby);

      // Act & Assert
      await expect(service.join(lobbyId, userId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.join(lobbyId, userId)).rejects.toThrow(
        'Lobby is not accepting players',
      );
    });

    it('should throw BadRequestException if lobby is full', async () => {
      // Arrange - ロビーが満員
      const mockLobby = {
        id: lobbyId,
        status: LobbyStatus.WAITING,
        currentPlayers: 99,
        maxPlayers: 99,
      };

      mockPrismaService.lobby.findUnique.mockResolvedValue(mockLobby);

      // Act & Assert
      await expect(service.join(lobbyId, userId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.join(lobbyId, userId)).rejects.toThrow(
        'Lobby is full',
      );
    });

    it('should throw BadRequestException if user already in lobby', async () => {
      // Arrange - ユーザーが既に参加している
      const mockLobby = {
        id: lobbyId,
        status: LobbyStatus.WAITING,
        currentPlayers: 50,
        maxPlayers: 99,
      };

      const existingParticipant = {
        lobbyId,
        userId,
      };

      mockPrismaService.lobby.findUnique.mockResolvedValue(mockLobby);
      mockPrismaService.lobbyParticipant.findUnique.mockResolvedValue(existingParticipant);

      // Act & Assert
      await expect(service.join(lobbyId, userId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.join(lobbyId, userId)).rejects.toThrow(
        'Already in lobby',
      );
    });

    it('should throw ForbiddenException if user is banned', async () => {
      // Arrange - ユーザーがBANNED
      const mockLobby = {
        id: lobbyId,
        status: LobbyStatus.WAITING,
        currentPlayers: 50,
        maxPlayers: 99,
      };

      const mockUser = {
        id: userId,
        status: UserStatus.BANNED,
        suspension: null,
      };

      mockPrismaService.lobby.findUnique.mockResolvedValue(mockLobby);
      mockPrismaService.lobbyParticipant.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(service.join(lobbyId, userId)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.join(lobbyId, userId)).rejects.toThrow(
        'You are permanently banned',
      );
    });

    it('should throw ForbiddenException if user is suspended', async () => {
      // Arrange - ユーザーがSUSPENDED（停止期限が未来）
      const mockLobby = {
        id: lobbyId,
        status: LobbyStatus.WAITING,
        currentPlayers: 50,
        maxPlayers: 99,
      };

      const futureDate = new Date('2099-12-31');
      const mockUser = {
        id: userId,
        status: UserStatus.SUSPENDED,
        suspension: {
          suspendedUntil: futureDate,
          reason: 'Test suspension',
        },
      };

      mockPrismaService.lobby.findUnique.mockResolvedValue(mockLobby);
      mockPrismaService.lobbyParticipant.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(service.join(lobbyId, userId)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.join(lobbyId, userId)).rejects.toThrow(
        'You are currently suspended',
      );
    });
  });
});
