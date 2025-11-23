import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { PrismaService } from '../prisma/prisma.service';
import { GameMode, League } from '@prisma/client';

describe('MatchesService', () => {
  let service: MatchesService;
  let prisma: PrismaService;

  const mockPrismaService = {
    match: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<MatchesService>(MatchesService);
    prisma = module.get<PrismaService>(PrismaService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getById', () => {
    it('should return match with passcode when user is a participant', async () => {
      // Arrange
      const matchId = 'match-123';
      const userId = 'user-456';
      const mockMatch = {
        id: matchId,
        passcode: '1234',
        gameMode: GameMode.GP,
        leagueType: League.KNIGHT,
        status: 'PENDING',
        totalPlayers: 50,
        lobby: {
          id: 'lobby-123',
          participants: [
            { userId: 'user-456', isActive: true },
            { userId: 'user-789', isActive: true },
          ],
          event: {
            id: 'event-123',
            season: { id: 'season-123', seasonNumber: 1 },
            tournament: null,
          },
        },
        participants: [
          {
            id: 'participant-1',
            userId: 'user-456',
            finalPoints: 100,
            user: {
              id: 'user-456',
              profileId: 1,
              displayName: 'Player1',
              avatarHash: 'avatar1',
            },
          },
        ],
      };

      mockPrismaService.match.findUnique.mockResolvedValue(mockMatch);

      // Act
      const result = await service.getById(matchId, userId);

      // Assert
      expect(prisma.match.findUnique).toHaveBeenCalledWith({
        where: { id: matchId },
        include: expect.objectContaining({
          lobby: expect.any(Object),
          participants: expect.any(Object),
        }),
      });
      expect(result).toEqual(mockMatch);
      expect((result as any).passcode).toBe('1234');
    });

    it('should return match without passcode when user is not a participant', async () => {
      // Arrange
      const matchId = 'match-123';
      const userId = 'user-999'; // Not in participants
      const mockMatch = {
        id: matchId,
        passcode: '1234',
        gameMode: GameMode.GP,
        leagueType: League.KNIGHT,
        status: 'PENDING',
        totalPlayers: 50,
        lobby: {
          id: 'lobby-123',
          participants: [
            { userId: 'user-456', isActive: true },
            { userId: 'user-789', isActive: true },
          ],
          event: {
            id: 'event-123',
            season: { id: 'season-123', seasonNumber: 1 },
            tournament: null,
          },
        },
        participants: [
          {
            id: 'participant-1',
            userId: 'user-456',
            finalPoints: 100,
            user: {
              id: 'user-456',
              profileId: 1,
              displayName: 'Player1',
              avatarHash: 'avatar1',
            },
          },
        ],
      };

      mockPrismaService.match.findUnique.mockResolvedValue(mockMatch);

      // Act
      const result = await service.getById(matchId, userId);

      // Assert
      expect(prisma.match.findUnique).toHaveBeenCalledWith({
        where: { id: matchId },
        include: expect.objectContaining({
          lobby: expect.any(Object),
          participants: expect.any(Object),
        }),
      });
      expect((result as any).passcode).toBeUndefined();
      expect(result).not.toHaveProperty('passcode');
      expect(result.id).toBe(matchId);
      expect(result.gameMode).toBe(GameMode.GP);
    });

    it('should throw NotFoundException when match is not found', async () => {
      // Arrange
      const matchId = 'non-existent-match';
      mockPrismaService.match.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getById(matchId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getById(matchId)).rejects.toThrow(
        'Match not found',
      );

      expect(prisma.match.findUnique).toHaveBeenCalledWith({
        where: { id: matchId },
        include: expect.objectContaining({
          lobby: expect.any(Object),
          participants: expect.any(Object),
        }),
      });
    });
  });

  describe('getByModeSeasonGame', () => {
    it('should return match with passcode when user is a participant', async () => {
      // Arrange
      const gameMode = GameMode.GP;
      const seasonNumber = 1;
      const gameNumber = 5;
      const userId = 'user-456';
      const mockMatch = {
        id: 'match-123',
        passcode: '0042',
        gameMode: GameMode.GP,
        leagueType: League.KNIGHT,
        status: 'PENDING',
        totalPlayers: 50,
        lobby: {
          id: 'lobby-123',
          gameNumber: 5,
          participants: [
            { userId: 'user-456', isActive: true },
            { userId: 'user-789', isActive: true },
          ],
          event: {
            id: 'event-123',
            season: { id: 'season-123', seasonNumber: 1 },
            tournament: null,
          },
        },
        participants: [
          {
            id: 'participant-1',
            userId: 'user-456',
            finalPoints: 100,
            user: {
              id: 'user-456',
              profileId: 1,
              displayName: 'Player1',
              avatarHash: 'avatar1',
            },
          },
        ],
      };

      mockPrismaService.match.findFirst.mockResolvedValue(mockMatch);

      // Act
      const result = await service.getByModeSeasonGame(
        gameMode,
        seasonNumber,
        gameNumber,
        userId,
      );

      // Assert
      expect(prisma.match.findFirst).toHaveBeenCalledWith({
        where: {
          gameMode,
          lobby: {
            gameNumber,
            event: {
              season: {
                seasonNumber,
              },
            },
          },
        },
        include: expect.objectContaining({
          lobby: expect.any(Object),
          participants: expect.any(Object),
        }),
      });
      expect(result).toEqual(mockMatch);
      expect((result as any).passcode).toBe('0042');
    });

    it('should return match without passcode when user is not a participant', async () => {
      // Arrange
      const gameMode = GameMode.CLASSIC;
      const seasonNumber = 2;
      const gameNumber = 10;
      const userId = 'user-999'; // Not in participants
      const mockMatch = {
        id: 'match-456',
        passcode: '9999',
        gameMode: GameMode.CLASSIC,
        leagueType: League.CLASSIC_MINI,
        status: 'ONGOING',
        totalPlayers: 20,
        lobby: {
          id: 'lobby-456',
          gameNumber: 10,
          participants: [
            { userId: 'user-111', isActive: true },
            { userId: 'user-222', isActive: true },
          ],
          event: {
            id: 'event-456',
            season: { id: 'season-456', seasonNumber: 2 },
            tournament: null,
          },
        },
        participants: [],
      };

      mockPrismaService.match.findFirst.mockResolvedValue(mockMatch);

      // Act
      const result = await service.getByModeSeasonGame(
        gameMode,
        seasonNumber,
        gameNumber,
        userId,
      );

      // Assert
      expect(prisma.match.findFirst).toHaveBeenCalledWith({
        where: {
          gameMode,
          lobby: {
            gameNumber,
            event: {
              season: {
                seasonNumber,
              },
            },
          },
        },
        include: expect.objectContaining({
          lobby: expect.any(Object),
          participants: expect.any(Object),
        }),
      });
      expect((result as any).passcode).toBeUndefined();
      expect(result).not.toHaveProperty('passcode');
      expect(result.id).toBe('match-456');
      expect(result.gameMode).toBe(GameMode.CLASSIC);
    });

    it('should throw NotFoundException when match is not found', async () => {
      // Arrange
      const gameMode = GameMode.GP;
      const seasonNumber = 99;
      const gameNumber = 999;
      mockPrismaService.match.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.getByModeSeasonGame(gameMode, seasonNumber, gameNumber),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getByModeSeasonGame(gameMode, seasonNumber, gameNumber),
      ).rejects.toThrow('Match not found');

      expect(prisma.match.findFirst).toHaveBeenCalledWith({
        where: {
          gameMode,
          lobby: {
            gameNumber,
            event: {
              season: {
                seasonNumber,
              },
            },
          },
        },
        include: expect.objectContaining({
          lobby: expect.any(Object),
          participants: expect.any(Object),
        }),
      });
    });
  });
});
