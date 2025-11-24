import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { MatchesProcessor } from './matches.processor';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { GameMode, League, LobbyStatus } from '@prisma/client';

describe('MatchesProcessor', () => {
  let processor: MatchesProcessor;
  let prisma: PrismaService;
  let eventsGateway: EventsGateway;
  let pushNotifications: PushNotificationsService;

  const mockPrismaService = {
    lobby: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    match: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockEventsGateway = {
    emitLobbyCancelled: jest.fn(),
    emitMatchStarted: jest.fn(),
  };

  const mockPushNotificationsService = {
    notifyMatchStart: jest.fn(),
  };

  beforeEach(async () => {
    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchesProcessor,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: EventsGateway,
          useValue: mockEventsGateway,
        },
        {
          provide: PushNotificationsService,
          useValue: mockPushNotificationsService,
        },
      ],
    }).compile();

    processor = module.get<MatchesProcessor>(MatchesProcessor);
    prisma = module.get<PrismaService>(PrismaService);
    eventsGateway = module.get<EventsGateway>(EventsGateway);
    pushNotifications = module.get<PushNotificationsService>(
      PushNotificationsService,
    );

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('handleStartMatch', () => {
    it('should successfully create a match when lobby has enough players', async () => {
      // Arrange
      const lobbyId = 'lobby-123';
      const mockLobby = {
        id: lobbyId,
        status: LobbyStatus.WAITING,
        gameMode: GameMode.GP,
        leagueType: League.KNIGHT,
        currentPlayers: 50,
        minPlayers: 2,
        gameNumber: 5,
        participants: [
          { userId: 'user-1', isActive: true },
          { userId: 'user-2', isActive: true },
        ],
        event: {
          id: 'event-1',
          season: {
            id: 'season-1',
            seasonNumber: 1,
          },
        },
      };

      const mockLastMatch = {
        id: 'match-old',
        sequenceNumber: 3,
      };

      const mockCreatedMatch = {
        id: 'match-new',
        lobbyId,
        gameMode: GameMode.GP,
        leagueType: League.KNIGHT,
        sequenceNumber: 4,
        passcode: '0042',
        totalPlayers: 50,
        startedAt: new Date('2025-01-15T10:00:00Z'),
      };

      mockPrismaService.lobby.findUnique.mockResolvedValue(mockLobby);
      mockPrismaService.match.findFirst.mockResolvedValue(mockLastMatch);
      mockPrismaService.match.create.mockResolvedValue(mockCreatedMatch);
      mockPrismaService.lobby.update.mockResolvedValue({
        ...mockLobby,
        status: LobbyStatus.IN_PROGRESS,
      });
      mockPushNotificationsService.notifyMatchStart.mockResolvedValue(
        undefined,
      );

      // Mock Math.random to return a specific passcode
      jest.spyOn(Math, 'random').mockReturnValue(0.0042); // Will generate "0042"

      // Act
      const job = {
        data: { lobbyId },
      } as any;

      const result = await processor.handleStartMatch(job);

      // Assert
      expect(prisma.lobby.findUnique).toHaveBeenCalledWith({
        where: { id: lobbyId },
        include: {
          participants: true,
          event: {
            include: {
              season: true,
            },
          },
        },
      });

      expect(prisma.match.findFirst).toHaveBeenCalledWith({
        where: { lobbyId },
        orderBy: { sequenceNumber: 'desc' },
      });

      expect(prisma.match.create).toHaveBeenCalledWith({
        data: {
          lobbyId,
          gameMode: GameMode.GP,
          leagueType: League.KNIGHT,
          sequenceNumber: 4, // Previous was 3, so this should be 4
          passcode: '0042',
          totalPlayers: 50,
          startedAt: expect.any(Date),
          },
      });

      expect(prisma.lobby.update).toHaveBeenCalledWith({
        where: { id: lobbyId },
        data: {
          status: LobbyStatus.IN_PROGRESS,
        },
      });

      expect(eventsGateway.emitMatchStarted).toHaveBeenCalledWith({
        matchId: 'match-new',
        lobbyId,
        passcode: '0042',
        leagueType: League.KNIGHT,
        totalPlayers: 50,
        startedAt: '2025-01-15T10:00:00.000Z',
        mode: 'gp',
        season: 1,
        game: 5,
        url: '/matches/gp/1/5',
      });

      expect(pushNotifications.notifyMatchStart).toHaveBeenCalledWith({
        id: 'match-new',
        passcode: '0042',
        leagueType: League.KNIGHT,
        totalPlayers: 50,
        lobby: {
          participants: [
            { userId: 'user-1' },
            { userId: 'user-2' },
          ],
        },
      });

      expect(result).toEqual(mockCreatedMatch);

      // Restore Math.random
      jest.spyOn(Math, 'random').mockRestore();
    });

    it('should return early when lobby is not found', async () => {
      // Arrange
      const lobbyId = 'non-existent-lobby';
      mockPrismaService.lobby.findUnique.mockResolvedValue(null);

      // Act
      const job = {
        data: { lobbyId },
      } as any;

      const result = await processor.handleStartMatch(job);

      // Assert
      expect(prisma.lobby.findUnique).toHaveBeenCalledWith({
        where: { id: lobbyId },
        include: {
          participants: true,
          event: {
            include: {
              season: true,
            },
          },
        },
      });

      // Should not proceed to create match or update lobby
      expect(prisma.match.findFirst).not.toHaveBeenCalled();
      expect(prisma.match.create).not.toHaveBeenCalled();
      expect(prisma.lobby.update).not.toHaveBeenCalled();
      expect(eventsGateway.emitMatchStarted).not.toHaveBeenCalled();
      expect(pushNotifications.notifyMatchStart).not.toHaveBeenCalled();

      // Should return undefined
      expect(result).toBeUndefined();
    });

    it('should return early when lobby is not in WAITING status', async () => {
      // Arrange
      const lobbyId = 'lobby-123';
      const mockLobby = {
        id: lobbyId,
        status: LobbyStatus.IN_PROGRESS, // Already in progress
        gameMode: GameMode.GP,
        leagueType: League.KNIGHT,
        currentPlayers: 50,
        minPlayers: 2,
        participants: [],
        event: {
          id: 'event-1',
          season: { id: 'season-1', seasonNumber: 1 },
        },
      };

      mockPrismaService.lobby.findUnique.mockResolvedValue(mockLobby);

      // Act
      const job = {
        data: { lobbyId },
      } as any;

      const result = await processor.handleStartMatch(job);

      // Assert
      expect(prisma.lobby.findUnique).toHaveBeenCalledWith({
        where: { id: lobbyId },
        include: {
          participants: true,
          event: {
            include: {
              season: true,
            },
          },
        },
      });

      // Should not proceed to create match
      expect(prisma.match.findFirst).not.toHaveBeenCalled();
      expect(prisma.match.create).not.toHaveBeenCalled();
      expect(prisma.lobby.update).not.toHaveBeenCalled();
      expect(eventsGateway.emitMatchStarted).not.toHaveBeenCalled();
      expect(pushNotifications.notifyMatchStart).not.toHaveBeenCalled();

      // Should return undefined
      expect(result).toBeUndefined();
    });

    it('should cancel lobby when there are insufficient players', async () => {
      // Arrange
      const lobbyId = 'lobby-123';
      const mockLobby = {
        id: lobbyId,
        status: LobbyStatus.WAITING,
        gameMode: GameMode.GP,
        leagueType: League.KNIGHT,
        currentPlayers: 1, // Only 1 player
        minPlayers: 2, // Requires minimum 2 players
        participants: [{ userId: 'user-1', isActive: true }],
        event: {
          id: 'event-1',
          season: { id: 'season-1', seasonNumber: 1 },
        },
      };

      const mockUpdatedLobby = {
        ...mockLobby,
        status: LobbyStatus.CANCELLED,
      };

      mockPrismaService.lobby.findUnique.mockResolvedValue(mockLobby);
      mockPrismaService.lobby.update.mockResolvedValue(mockUpdatedLobby);

      // Act
      const job = {
        data: { lobbyId },
      } as any;

      const result = await processor.handleStartMatch(job);

      // Assert
      expect(prisma.lobby.findUnique).toHaveBeenCalledWith({
        where: { id: lobbyId },
        include: {
          participants: true,
          event: {
            include: {
              season: true,
            },
          },
        },
      });

      // Should update lobby to CANCELLED
      expect(prisma.lobby.update).toHaveBeenCalledWith({
        where: { id: lobbyId },
        data: {
          status: LobbyStatus.CANCELLED,
        },
      });

      // Should emit lobby cancelled event
      expect(eventsGateway.emitLobbyCancelled).toHaveBeenCalledWith(lobbyId);

      // Should not create match or emit match started event
      expect(prisma.match.findFirst).not.toHaveBeenCalled();
      expect(prisma.match.create).not.toHaveBeenCalled();
      expect(eventsGateway.emitMatchStarted).not.toHaveBeenCalled();
      expect(pushNotifications.notifyMatchStart).not.toHaveBeenCalled();

      // Should return undefined
      expect(result).toBeUndefined();
    });

    it('should return early when leagueType is null', async () => {
      // Arrange
      const lobbyId = 'lobby-123';
      const mockLobby = {
        id: lobbyId,
        status: LobbyStatus.WAITING,
        gameMode: GameMode.GP,
        leagueType: null, // No league type set
        currentPlayers: 50,
        minPlayers: 2,
        participants: [{ userId: 'user-1', isActive: true }],
        event: {
          id: 'event-1',
          season: { id: 'season-1', seasonNumber: 1 },
        },
      };

      mockPrismaService.lobby.findUnique.mockResolvedValue(mockLobby);

      // Act
      const job = {
        data: { lobbyId },
      } as any;

      const result = await processor.handleStartMatch(job);

      // Assert
      expect(prisma.lobby.findUnique).toHaveBeenCalledWith({
        where: { id: lobbyId },
        include: {
          participants: true,
          event: {
            include: {
              season: true,
            },
          },
        },
      });

      // Should not proceed to create match
      expect(prisma.match.findFirst).not.toHaveBeenCalled();
      expect(prisma.match.create).not.toHaveBeenCalled();
      expect(prisma.lobby.update).not.toHaveBeenCalled();
      expect(eventsGateway.emitMatchStarted).not.toHaveBeenCalled();
      expect(eventsGateway.emitLobbyCancelled).not.toHaveBeenCalled();
      expect(pushNotifications.notifyMatchStart).not.toHaveBeenCalled();

      // Should return undefined
      expect(result).toBeUndefined();
    });

    it('should create first match with sequenceNumber 1 when no previous matches exist', async () => {
      // Arrange
      const lobbyId = 'lobby-123';
      const mockLobby = {
        id: lobbyId,
        status: LobbyStatus.WAITING,
        gameMode: GameMode.CLASSIC,
        leagueType: League.CLASSIC_MINI,
        currentPlayers: 20,
        minPlayers: 2,
        gameNumber: 1,
        participants: [
          { userId: 'user-1', isActive: true },
          { userId: 'user-2', isActive: true },
        ],
        event: {
          id: 'event-1',
          season: {
            id: 'season-1',
            seasonNumber: 1,
          },
        },
      };

      const mockCreatedMatch = {
        id: 'match-first',
        lobbyId,
        gameMode: GameMode.CLASSIC,
        leagueType: League.CLASSIC_MINI,
        sequenceNumber: 1, // First match
        passcode: '0001',
        totalPlayers: 20,
        startedAt: new Date('2025-01-15T10:00:00Z'),
      };

      mockPrismaService.lobby.findUnique.mockResolvedValue(mockLobby);
      mockPrismaService.match.findFirst.mockResolvedValue(null); // No previous matches
      mockPrismaService.match.create.mockResolvedValue(mockCreatedMatch);
      mockPrismaService.lobby.update.mockResolvedValue({
        ...mockLobby,
        status: LobbyStatus.IN_PROGRESS,
      });
      mockPushNotificationsService.notifyMatchStart.mockResolvedValue(
        undefined,
      );

      // Mock Math.random to return a specific passcode
      jest.spyOn(Math, 'random').mockReturnValue(0.0001); // Will generate "0001"

      // Act
      const job = {
        data: { lobbyId },
      } as any;

      const result = await processor.handleStartMatch(job);

      // Assert
      expect(prisma.match.findFirst).toHaveBeenCalledWith({
        where: { lobbyId },
        orderBy: { sequenceNumber: 'desc' },
      });

      expect(prisma.match.create).toHaveBeenCalledWith({
        data: {
          lobbyId,
          gameMode: GameMode.CLASSIC,
          leagueType: League.CLASSIC_MINI,
          sequenceNumber: 1, // Should be 1 for first match
          passcode: '0001',
          totalPlayers: 20,
          startedAt: expect.any(Date),
          },
      });

      expect(eventsGateway.emitMatchStarted).toHaveBeenCalledWith({
        matchId: 'match-first',
        lobbyId,
        passcode: '0001',
        leagueType: League.CLASSIC_MINI,
        totalPlayers: 20,
        startedAt: '2025-01-15T10:00:00.000Z',
        mode: 'classic',
        season: 1,
        game: 1,
        url: '/matches/classic/1/1',
      });

      expect(result).toEqual(mockCreatedMatch);

      // Restore Math.random
      jest.spyOn(Math, 'random').mockRestore();
    });

    it('should successfully create match even when push notification fails', async () => {
      // Arrange
      const lobbyId = 'lobby-123';
      const mockLobby = {
        id: lobbyId,
        status: LobbyStatus.WAITING,
        gameMode: GameMode.GP,
        leagueType: League.KNIGHT,
        currentPlayers: 50,
        minPlayers: 2,
        gameNumber: 5,
        participants: [
          { userId: 'user-1', isActive: true },
          { userId: 'user-2', isActive: true },
        ],
        event: {
          id: 'event-1',
          season: {
            id: 'season-1',
            seasonNumber: 1,
          },
        },
      };

      const mockCreatedMatch = {
        id: 'match-new',
        lobbyId,
        gameMode: GameMode.GP,
        leagueType: League.KNIGHT,
        sequenceNumber: 1,
        passcode: '1234',
        totalPlayers: 50,
        startedAt: new Date('2025-01-15T10:00:00Z'),
      };

      mockPrismaService.lobby.findUnique.mockResolvedValue(mockLobby);
      mockPrismaService.match.findFirst.mockResolvedValue(null);
      mockPrismaService.match.create.mockResolvedValue(mockCreatedMatch);
      mockPrismaService.lobby.update.mockResolvedValue({
        ...mockLobby,
        status: LobbyStatus.IN_PROGRESS,
      });

      // Push notification service throws an error
      mockPushNotificationsService.notifyMatchStart.mockRejectedValue(
        new Error('Push notification service unavailable'),
      );

      // Mock Math.random to return a specific passcode
      jest.spyOn(Math, 'random').mockReturnValue(0.1234); // Will generate "1234"

      // Act
      const job = {
        data: { lobbyId },
      } as any;

      const result = await processor.handleStartMatch(job);

      // Assert
      // Match should still be created successfully
      expect(prisma.match.create).toHaveBeenCalledWith({
        data: {
          lobbyId,
          gameMode: GameMode.GP,
          leagueType: League.KNIGHT,
          sequenceNumber: 1,
          passcode: '1234',
          totalPlayers: 50,
          startedAt: expect.any(Date),
          },
      });

      // Lobby should be updated to IN_PROGRESS
      expect(prisma.lobby.update).toHaveBeenCalledWith({
        where: { id: lobbyId },
        data: {
          status: LobbyStatus.IN_PROGRESS,
        },
      });

      // WebSocket event should still be emitted
      expect(eventsGateway.emitMatchStarted).toHaveBeenCalledWith({
        matchId: 'match-new',
        lobbyId,
        passcode: '1234',
        leagueType: League.KNIGHT,
        totalPlayers: 50,
        startedAt: '2025-01-15T10:00:00.000Z',
        mode: 'gp',
        season: 1,
        game: 5,
        url: '/matches/gp/1/5',
      });

      // Push notification was attempted
      expect(pushNotifications.notifyMatchStart).toHaveBeenCalled();

      // Result should still be the created match
      expect(result).toEqual(mockCreatedMatch);

      // Restore Math.random
      jest.spyOn(Math, 'random').mockRestore();
    });
  });
});
