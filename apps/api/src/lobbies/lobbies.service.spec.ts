import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { LobbiesService } from './lobbies.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { LobbyStatus, UserStatus, GameMode, League } from '@prisma/client';
import { Queue } from 'bull';

describe('LobbiesService', () => {
  let service: LobbiesService;
  let prisma: PrismaService;

  const mockPrismaService = {
    lobby: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    lobbyParticipant: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    event: {
      findFirst: jest.fn(),
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

  describe('leave', () => {
    const lobbyId = 'lobby-123';
    const userId = 'user-456';

    it('should allow user to leave lobby successfully', async () => {
      // Arrange - モックの設定
      const mockLobby = {
        id: lobbyId,
        status: LobbyStatus.WAITING,
        currentPlayers: 51,
        maxPlayers: 99,
        event: { season: {}, tournament: {} },
        participants: [{ user: { id: userId } }],
        matches: [],
      };

      const existingParticipant = {
        id: 'participant-789',
        lobbyId,
        userId,
      };

      const updatedLobby = {
        id: lobbyId,
        status: LobbyStatus.WAITING,
        currentPlayers: 50,
        maxPlayers: 99,
        event: { season: {}, tournament: {} },
        participants: [],
        matches: [],
      };

      // getById でロビー取得
      mockPrismaService.lobby.findUnique.mockResolvedValue(mockLobby);
      // ユーザーが参加している
      mockPrismaService.lobbyParticipant.findUnique.mockResolvedValue(existingParticipant);
      // 退出処理成功
      mockPrismaService.lobbyParticipant.delete.mockResolvedValue(existingParticipant);
      // lobby.update が updatedLobby を返す
      mockPrismaService.lobby.update.mockResolvedValue(updatedLobby);

      // Act - メソッド実行
      const result = await service.leave(lobbyId, userId);

      // Assert - 検証
      // 1. lobbyParticipant.delete が呼ばれた
      expect(mockPrismaService.lobbyParticipant.delete).toHaveBeenCalledWith({
        where: { id: existingParticipant.id },
      });

      // 2. lobby.update が includeオプション付きで呼ばれた
      expect(mockPrismaService.lobby.update).toHaveBeenCalledWith({
        where: { id: lobbyId },
        data: {
          currentPlayers: { decrement: 1 },
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

      // Act & Assert
      await expect(service.leave(lobbyId, userId)).rejects.toThrow(
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
      await expect(service.leave(lobbyId, userId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.leave(lobbyId, userId)).rejects.toThrow(
        'Cannot leave lobby at this time',
      );
    });

    it('should throw BadRequestException if user is not in lobby', async () => {
      // Arrange - ユーザーがロビーに参加していない
      const mockLobby = {
        id: lobbyId,
        status: LobbyStatus.WAITING,
        currentPlayers: 50,
        maxPlayers: 99,
      };

      mockPrismaService.lobby.findUnique.mockResolvedValue(mockLobby);
      mockPrismaService.lobbyParticipant.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.leave(lobbyId, userId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.leave(lobbyId, userId)).rejects.toThrow(
        'Not in lobby',
      );
    });
  });

  describe('cancel', () => {
    const lobbyId = 'lobby-123';

    it('should cancel lobby successfully when status is WAITING', async () => {
      // Arrange
      const mockLobby = {
        id: lobbyId,
        status: LobbyStatus.WAITING,
        currentPlayers: 50,
        maxPlayers: 99,
        event: { season: {}, tournament: {} },
        participants: [],
        matches: [],
      };

      const cancelledLobby = {
        ...mockLobby,
        status: LobbyStatus.CANCELLED,
      };

      mockPrismaService.lobby.findUnique.mockResolvedValue(mockLobby);
      mockPrismaService.lobby.update.mockResolvedValue(cancelledLobby);

      // Act
      const result = await service.cancel(lobbyId);

      // Assert
      expect(mockPrismaService.lobby.update).toHaveBeenCalledWith({
        where: { id: lobbyId },
        data: { status: LobbyStatus.CANCELLED },
        include: expect.objectContaining({
          event: expect.any(Object),
          participants: expect.any(Object),
          matches: true,
        }),
      });

      expect(mockEventsGateway.emitLobbyUpdated).toHaveBeenCalledWith(
        cancelledLobby,
      );

      expect(result).toEqual({
        message: 'Lobby cancelled successfully',
        lobby: cancelledLobby,
      });
    });

    it('should cancel lobby successfully when status is IN_PROGRESS', async () => {
      // Arrange
      const mockLobby = {
        id: lobbyId,
        status: LobbyStatus.IN_PROGRESS,
        currentPlayers: 99,
        maxPlayers: 99,
        event: { season: {}, tournament: {} },
        participants: [],
        matches: [],
      };

      const cancelledLobby = {
        ...mockLobby,
        status: LobbyStatus.CANCELLED,
      };

      mockPrismaService.lobby.findUnique.mockResolvedValue(mockLobby);
      mockPrismaService.lobby.update.mockResolvedValue(cancelledLobby);

      // Act
      const result = await service.cancel(lobbyId);

      // Assert
      expect(mockPrismaService.lobby.update).toHaveBeenCalledWith({
        where: { id: lobbyId },
        data: { status: LobbyStatus.CANCELLED },
        include: expect.objectContaining({
          event: expect.any(Object),
          participants: expect.any(Object),
          matches: true,
        }),
      });

      expect(result).toEqual({
        message: 'Lobby cancelled successfully',
        lobby: cancelledLobby,
      });
    });

    it('should throw NotFoundException if lobby not found', async () => {
      // Arrange
      mockPrismaService.lobby.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.cancel(lobbyId)).rejects.toThrow('Lobby not found');
    });

    it('should throw BadRequestException if lobby status is COMPLETED', async () => {
      // Arrange
      const mockLobby = {
        id: lobbyId,
        status: LobbyStatus.COMPLETED,
        currentPlayers: 99,
        maxPlayers: 99,
      };

      mockPrismaService.lobby.findUnique.mockResolvedValue(mockLobby);

      // Act & Assert
      await expect(service.cancel(lobbyId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.cancel(lobbyId)).rejects.toThrow(
        'Can only cancel lobbies in WAITING or IN_PROGRESS status',
      );
    });

    it('should throw BadRequestException if lobby status is already CANCELLED', async () => {
      // Arrange
      const mockLobby = {
        id: lobbyId,
        status: LobbyStatus.CANCELLED,
        currentPlayers: 50,
        maxPlayers: 99,
      };

      mockPrismaService.lobby.findUnique.mockResolvedValue(mockLobby);

      // Act & Assert
      await expect(service.cancel(lobbyId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.cancel(lobbyId)).rejects.toThrow(
        'Can only cancel lobbies in WAITING or IN_PROGRESS status',
      );
    });
  });

  describe('delete', () => {
    const lobbyId = 'lobby-123';

    it('should delete lobby successfully when status is WAITING', async () => {
      // Arrange
      const mockLobby = {
        id: lobbyId,
        status: LobbyStatus.WAITING,
        currentPlayers: 5,
        maxPlayers: 99,
        event: { season: {}, tournament: {} },
        participants: [],
        matches: [],
      };

      mockPrismaService.lobby.findUnique.mockResolvedValue(mockLobby);
      mockPrismaService.lobbyParticipant.deleteMany.mockResolvedValue({ count: 5 });
      mockPrismaService.lobby.delete.mockResolvedValue(mockLobby);

      // Act
      const result = await service.delete(lobbyId);

      // Assert
      // 1. lobbyParticipant.deleteMany が呼ばれた
      expect(mockPrismaService.lobbyParticipant.deleteMany).toHaveBeenCalledWith({
        where: { lobbyId },
      });

      // 2. lobby.delete が呼ばれた
      expect(mockPrismaService.lobby.delete).toHaveBeenCalledWith({
        where: { id: lobbyId },
      });

      // 3. 返り値が正しい
      expect(result).toEqual({
        message: 'Lobby deleted successfully',
      });
    });

    it('should throw NotFoundException if lobby not found', async () => {
      // Arrange
      mockPrismaService.lobby.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.delete(lobbyId)).rejects.toThrow('Lobby not found');
    });

    it('should throw BadRequestException if lobby status is not WAITING', async () => {
      // Arrange
      const mockLobby = {
        id: lobbyId,
        status: LobbyStatus.IN_PROGRESS,
        currentPlayers: 99,
        maxPlayers: 99,
      };

      mockPrismaService.lobby.findUnique.mockResolvedValue(mockLobby);

      // Act & Assert
      await expect(service.delete(lobbyId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.delete(lobbyId)).rejects.toThrow(
        'Cannot delete lobby that is not in WAITING status',
      );
    });
  });

  describe('getById', () => {
    const lobbyId = 'lobby-123';

    it('should return lobby when found', async () => {
      // Arrange
      const mockLobby = {
        id: lobbyId,
        status: LobbyStatus.WAITING,
        currentPlayers: 50,
        maxPlayers: 99,
        event: {
          season: { id: 'season-1', name: 'Season 1' },
          tournament: null,
        },
        participants: [
          { user: { id: 'user-1', displayName: 'Player1' } },
        ],
        matches: [],
      };

      mockPrismaService.lobby.findUnique.mockResolvedValue(mockLobby);

      // Act
      const result = await service.getById(lobbyId);

      // Assert
      expect(mockPrismaService.lobby.findUnique).toHaveBeenCalledWith({
        where: { id: lobbyId },
        include: expect.objectContaining({
          event: expect.any(Object),
          participants: expect.any(Object),
          matches: true,
        }),
      });

      expect(result).toEqual(mockLobby);
    });

    it('should throw NotFoundException if lobby not found', async () => {
      // Arrange
      mockPrismaService.lobby.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getById(lobbyId)).rejects.toThrow(
        'Lobby not found',
      );
    });
  });

  describe('getNext', () => {
    it('should return next scheduled lobby for GP game mode', async () => {
      // Arrange
      const futureDate = new Date('2099-12-31T10:00:00Z');
      const mockLobby = {
        id: 'lobby-next',
        gameMode: GameMode.GP,
        status: LobbyStatus.WAITING,
        scheduledStart: futureDate,
        currentPlayers: 30,
        maxPlayers: 99,
        event: {
          season: { id: 'season-1', name: 'Season 1' },
        },
        participants: [],
        matches: [],
      };

      mockPrismaService.lobby.findFirst.mockResolvedValue(mockLobby);

      // Act
      const result = await service.getNext(GameMode.GP);

      // Assert
      expect(mockPrismaService.lobby.findFirst).toHaveBeenCalledWith({
        where: {
          gameMode: GameMode.GP,
          status: LobbyStatus.WAITING,
          scheduledStart: { gte: expect.any(Date) },
        },
        orderBy: { scheduledStart: 'asc' },
        include: expect.objectContaining({
          event: expect.any(Object),
          participants: expect.any(Object),
          matches: true,
        }),
      });

      expect(result).toEqual(mockLobby);
    });

    it('should return null when no upcoming lobby found', async () => {
      // Arrange
      mockPrismaService.lobby.findFirst.mockResolvedValue(null);

      // Act
      const result = await service.getNext(GameMode.GP);

      // Assert
      expect(result).toBeNull();
    });

    it('should use GP as default game mode', async () => {
      // Arrange
      mockPrismaService.lobby.findFirst.mockResolvedValue(null);

      // Act
      await service.getNext();

      // Assert
      expect(mockPrismaService.lobby.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            gameMode: GameMode.GP,
          }),
        }),
      );
    });
  });

  describe('getAll', () => {
    it('should return all lobbies without filters', async () => {
      // Arrange
      const mockLobbies = [
        {
          id: 'lobby-1',
          gameMode: GameMode.GP,
          status: LobbyStatus.WAITING,
          scheduledStart: new Date('2099-12-31T10:00:00Z'),
          event: { season: {} },
          participants: [],
          matches: [],
        },
        {
          id: 'lobby-2',
          gameMode: GameMode.GP,
          status: LobbyStatus.IN_PROGRESS,
          scheduledStart: new Date('2099-12-31T11:00:00Z'),
          event: { season: {} },
          participants: [],
          matches: [],
        },
      ];

      mockPrismaService.lobby.findMany.mockResolvedValue(mockLobbies);

      // Act
      const result = await service.getAll();

      // Assert
      expect(mockPrismaService.lobby.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { scheduledStart: 'asc' },
        include: expect.objectContaining({
          event: expect.any(Object),
          participants: expect.any(Object),
          matches: true,
        }),
      });

      expect(result).toEqual(mockLobbies);
    });

    it('should return lobbies filtered by gameMode', async () => {
      // Arrange
      const mockLobbies = [
        {
          id: 'lobby-1',
          gameMode: GameMode.GP,
          status: LobbyStatus.WAITING,
        },
      ];

      mockPrismaService.lobby.findMany.mockResolvedValue(mockLobbies);

      // Act
      const result = await service.getAll(GameMode.GP);

      // Assert
      expect(mockPrismaService.lobby.findMany).toHaveBeenCalledWith({
        where: { gameMode: GameMode.GP },
        orderBy: { scheduledStart: 'asc' },
        include: expect.objectContaining({
          event: expect.any(Object),
          participants: expect.any(Object),
          matches: true,
        }),
      });

      expect(result).toEqual(mockLobbies);
    });

    it('should return lobbies filtered by status', async () => {
      // Arrange
      const mockLobbies = [
        {
          id: 'lobby-1',
          status: LobbyStatus.WAITING,
        },
      ];

      mockPrismaService.lobby.findMany.mockResolvedValue(mockLobbies);

      // Act
      const result = await service.getAll(undefined, LobbyStatus.WAITING);

      // Assert
      expect(mockPrismaService.lobby.findMany).toHaveBeenCalledWith({
        where: { status: LobbyStatus.WAITING },
        orderBy: { scheduledStart: 'asc' },
        include: expect.objectContaining({
          event: expect.any(Object),
          participants: expect.any(Object),
          matches: true,
        }),
      });

      expect(result).toEqual(mockLobbies);
    });

    it('should return lobbies filtered by both gameMode and status', async () => {
      // Arrange
      const mockLobbies = [
        {
          id: 'lobby-1',
          gameMode: GameMode.GP,
          status: LobbyStatus.WAITING,
        },
      ];

      mockPrismaService.lobby.findMany.mockResolvedValue(mockLobbies);

      // Act
      const result = await service.getAll(GameMode.GP, LobbyStatus.WAITING);

      // Assert
      expect(mockPrismaService.lobby.findMany).toHaveBeenCalledWith({
        where: {
          gameMode: GameMode.GP,
          status: LobbyStatus.WAITING,
        },
        orderBy: { scheduledStart: 'asc' },
        include: expect.objectContaining({
          event: expect.any(Object),
          participants: expect.any(Object),
          matches: true,
        }),
      });

      expect(result).toEqual(mockLobbies);
    });

    it('should return empty array when no lobbies found', async () => {
      // Arrange
      mockPrismaService.lobby.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getAll();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    const userId = 'user-admin';
    const createLobbyDto = {
      gameMode: GameMode.GP,
      leagueType: League.KNIGHT,
      scheduledStart: '2099-12-31T10:00:00Z',
      minPlayers: 40,
      maxPlayers: 99,
      notes: 'Test lobby',
    };

    it('should create lobby successfully with game number 1 when no previous lobbies', async () => {
      // Arrange
      const mockEvent = {
        id: 'event-1',
        type: 'SEASON',
        isActive: true,
        season: {
          id: 'season-1',
          gameMode: GameMode.GP,
        },
      };

      const createdLobby = {
        id: 'lobby-new',
        gameMode: GameMode.GP,
        leagueType: League.KNIGHT,
        eventId: 'event-1',
        gameNumber: 1,
        scheduledStart: new Date('2099-12-31T10:00:00Z'),
        status: LobbyStatus.WAITING,
        event: mockEvent,
        participants: [],
        matches: [],
      };

      mockPrismaService.event.findFirst.mockResolvedValue(mockEvent);
      // 最初のロビーなので、lastLobbyはnull
      mockPrismaService.lobby.findFirst.mockResolvedValue(null);
      mockPrismaService.lobby.create.mockResolvedValue(createdLobby);

      // Act
      const result = await service.create(createLobbyDto, userId);

      // Assert
      // 1. イベント取得が呼ばれた
      expect(mockPrismaService.event.findFirst).toHaveBeenCalledWith({
        where: {
          isActive: true,
          type: 'SEASON',
          season: {
            gameMode: GameMode.GP,
          },
        },
        include: {
          season: true,
        },
      });

      // 2. ロビー作成が呼ばれた
      expect(mockPrismaService.lobby.create).toHaveBeenCalledWith({
        data: {
          gameMode: GameMode.GP,
          leagueType: League.KNIGHT,
          eventId: 'event-1',
          gameNumber: 1,
          scheduledStart: new Date('2099-12-31T10:00:00Z'),
          minPlayers: 40,
          maxPlayers: 99,
          createdBy: userId,
          notes: 'Test lobby',
          status: LobbyStatus.WAITING,
        },
        include: expect.objectContaining({
          event: expect.any(Object),
          participants: expect.any(Object),
          matches: true,
        }),
      });

      // 3. BullMQジョブが追加された
      expect(mockMatchQueue.add).toHaveBeenCalledWith(
        'start-match',
        { lobbyId: 'lobby-new' },
        expect.objectContaining({
          delay: expect.any(Number),
          removeOnComplete: true,
          attempts: 3,
        }),
      );

      // 4. 返り値が正しい
      expect(result).toEqual(createdLobby);
    });

    it('should create lobby with incremented game number when previous lobbies exist', async () => {
      // Arrange
      const mockEvent = {
        id: 'event-1',
        type: 'SEASON',
        isActive: true,
        season: {
          id: 'season-1',
          gameMode: GameMode.GP,
        },
      };

      const lastLobby = {
        id: 'lobby-last',
        gameNumber: 5,
      };

      const createdLobby = {
        id: 'lobby-new',
        gameNumber: 6,
        event: mockEvent,
        participants: [],
        matches: [],
      };

      mockPrismaService.event.findFirst.mockResolvedValue(mockEvent);
      mockPrismaService.lobby.findFirst.mockResolvedValue(lastLobby);
      mockPrismaService.lobby.create.mockResolvedValue(createdLobby);

      // Act
      const result = await service.create(createLobbyDto, userId);

      // Assert
      expect(mockPrismaService.lobby.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            gameNumber: 6,
          }),
        }),
      );

      expect(result.gameNumber).toBe(6);
    });

    it('should throw BadRequestException when no active season found', async () => {
      // Arrange
      mockPrismaService.event.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.create(createLobbyDto, userId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(createLobbyDto, userId)).rejects.toThrow(
        `No active season found for ${GameMode.GP}`,
      );
    });

    it('should not schedule BullMQ job when scheduledStart is in the past', async () => {
      // Arrange
      const pastDto = {
        ...createLobbyDto,
        scheduledStart: '2020-01-01T10:00:00Z', // 過去の日付
      };

      const mockEvent = {
        id: 'event-1',
        type: 'SEASON',
        isActive: true,
        season: {
          id: 'season-1',
          gameMode: GameMode.GP,
        },
      };

      const createdLobby = {
        id: 'lobby-past',
        scheduledStart: new Date('2020-01-01T10:00:00Z'),
        event: mockEvent,
        participants: [],
        matches: [],
      };

      mockPrismaService.event.findFirst.mockResolvedValue(mockEvent);
      mockPrismaService.lobby.findFirst.mockResolvedValue(null);
      mockPrismaService.lobby.create.mockResolvedValue(createdLobby);

      // Act
      await service.create(pastDto, userId);

      // Assert
      // BullMQジョブは追加されない
      expect(mockMatchQueue.add).not.toHaveBeenCalled();
    });
  });
});
