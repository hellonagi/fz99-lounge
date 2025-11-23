import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

// Mock string utils
jest.mock('../common/utils/string.util', () => ({
  toHalfWidth: jest.fn((str) => str),
  validateDisplayName: jest.fn((str) => {
    if (str.length < 2) {
      return { valid: false, error: 'Display name must be at least 2 characters' };
    }
    if (str.length > 20) {
      return { valid: false, error: 'Display name must be at most 20 characters' };
    }
    return { valid: true };
  }),
}));

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    userStatsGP: {
      findMany: jest.fn(),
    },
    userStatsClassic: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      // Arrange
      const userId = 'user-123';
      const mockUser = {
        id: userId,
        profileId: 1,
        discordId: 'discord-123',
        username: 'testuser',
        displayName: 'Test User',
        avatarHash: 'avatar123',
        role: 'USER',
        status: 'ACTIVE',
        youtubeUrl: null,
        twitchUrl: null,
        createdAt: new Date(),
        lastLoginAt: new Date(),
        statsGP: {
          mmr: 1500,
          seasonHighMmr: 1600,
          totalMatches: 10,
          totalWins: 2,
          top3Finishes: 5,
          top10Finishes: 8,
          averagePosition: 15.5,
          totalKos: 3,
          bestPosition: 1,
          currentStreak: 2,
          favoriteMachine: 'BLUE_FALCON',
        },
        statsClassic: null,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      // Act
      const result = await service.findById(userId);

      // Assert
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: expect.objectContaining({
          id: true,
          profileId: true,
          username: true,
          statsGP: expect.any(Object),
          statsClassic: expect.any(Object),
        }),
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      // Arrange
      const userId = 'non-existent';
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findById(userId)).rejects.toThrow(NotFoundException);
      await expect(service.findById(userId)).rejects.toThrow('User not found');
    });
  });

  describe('findByDiscordId', () => {
    it('should return user when found', async () => {
      // Arrange
      const discordId = 'discord-123';
      const mockUser = {
        id: 'user-123',
        discordId,
        username: 'testuser',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      // Act
      const result = await service.findByDiscordId(discordId);

      // Assert
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { discordId },
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      // Arrange
      const discordId = 'non-existent';
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findByDiscordId(discordId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByProfileId', () => {
    it('should return user when found', async () => {
      // Arrange
      const profileId = 12345;
      const mockUser = {
        id: 'user-123',
        profileId,
        username: 'testuser',
        displayName: 'Test User',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      // Act
      const result = await service.findByProfileId(profileId);

      // Assert
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { profileId },
        select: expect.any(Object),
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      // Arrange
      const profileId = 99999;
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findByProfileId(profileId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateDisplayName', () => {
    it('should update display name successfully', async () => {
      // Arrange
      const userId = 'user-123';
      const newDisplayName = 'NewName';

      const mockUser = {
        id: userId,
        displayNameLastChangedAt: null, // Never changed before
      };

      const mockUpdatedUser = {
        id: userId,
        profileId: 1,
        discordId: 'discord-123',
        username: 'testuser',
        displayName: newDisplayName,
        avatarHash: 'avatar123',
        role: 'PLAYER',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue(mockUpdatedUser);

      // Act
      const result = await service.updateDisplayName(userId, newDisplayName);

      // Assert
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: { id: true, displayNameLastChangedAt: true },
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          displayName: newDisplayName,
          displayNameLastChangedAt: expect.any(Date),
        },
        select: expect.any(Object),
      });

      expect(result).toEqual(mockUpdatedUser);
    });

    it('should throw BadRequestException for invalid display name (too short)', async () => {
      // Arrange
      const userId = 'user-123';
      const invalidName = 'A'; // Too short

      // Act & Assert
      await expect(service.updateDisplayName(userId, invalidName)).rejects.toThrow(
        BadRequestException
      );
      await expect(service.updateDisplayName(userId, invalidName)).rejects.toThrow(
        'Display name must be at least 2 characters'
      );

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when user not found', async () => {
      // Arrange
      const userId = 'non-existent';
      const newDisplayName = 'ValidName';

      mockPrismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.updateDisplayName(userId, newDisplayName)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw BadRequestException when trying to change within 60 days', async () => {
      // Arrange
      const userId = 'user-123';
      const newDisplayName = 'NewName';

      const now = new Date('2025-01-23T00:00:00Z');
      const lastChanged = new Date('2025-01-01T00:00:00Z'); // 22 days ago
      jest.spyOn(Date, 'now').mockReturnValue(now.getTime());

      const mockUser = {
        id: userId,
        displayNameLastChangedAt: lastChanged,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(service.updateDisplayName(userId, newDisplayName)).rejects.toThrow(
        BadRequestException
      );
      await expect(service.updateDisplayName(userId, newDisplayName)).rejects.toThrow(
        /38 days remaining/
      );

      expect(prisma.user.update).not.toHaveBeenCalled();

      // Restore Date.now
      jest.spyOn(Date, 'now').mockRestore();
    });

    it('should allow update after 60 days have passed', async () => {
      // Arrange
      const userId = 'user-123';
      const newDisplayName = 'NewName';

      const now = new Date('2025-03-02T00:00:00Z');
      const lastChanged = new Date('2025-01-01T00:00:00Z'); // 60 days ago
      jest.spyOn(Date, 'now').mockReturnValue(now.getTime());

      const mockUser = {
        id: userId,
        displayNameLastChangedAt: lastChanged,
      };

      const mockUpdatedUser = {
        id: userId,
        displayName: newDisplayName,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue(mockUpdatedUser);

      // Act
      const result = await service.updateDisplayName(userId, newDisplayName);

      // Assert
      expect(prisma.user.update).toHaveBeenCalled();
      expect(result).toEqual(mockUpdatedUser);

      // Restore Date.now
      jest.spyOn(Date, 'now').mockRestore();
    });
  });

  describe('updateProfile', () => {
    it('should update youtube and twitch URLs', async () => {
      // Arrange
      const userId = 'user-123';
      const profileData = {
        youtubeUrl: 'https://youtube.com/@speedster',
        twitchUrl: 'https://twitch.tv/speedster',
      };

      const mockUpdatedUser = {
        id: userId,
        profileId: 1,
        discordId: 'discord-123',
        username: 'testuser',
        displayName: 'Test User',
        avatarHash: 'avatar123',
        role: 'PLAYER',
        youtubeUrl: profileData.youtubeUrl,
        twitchUrl: profileData.twitchUrl,
      };

      mockPrismaService.user.update.mockResolvedValue(mockUpdatedUser);

      // Act
      const result = await service.updateProfile(userId, profileData);

      // Assert
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          youtubeUrl: profileData.youtubeUrl,
          twitchUrl: profileData.twitchUrl,
        },
        select: expect.any(Object),
      });
      expect(result).toEqual(mockUpdatedUser);
    });

    it('should set URL to null when empty string is provided', async () => {
      // Arrange
      const userId = 'user-123';
      const profileData = {
        youtubeUrl: '',
        twitchUrl: '',
      };

      const mockUpdatedUser = {
        id: userId,
        youtubeUrl: null,
        twitchUrl: null,
      };

      mockPrismaService.user.update.mockResolvedValue(mockUpdatedUser);

      // Act
      const result = await service.updateProfile(userId, profileData);

      // Assert
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          youtubeUrl: null,
          twitchUrl: null,
        },
        select: expect.any(Object),
      });
      expect(result).toEqual(mockUpdatedUser);
    });
  });

  describe('getLeaderboard', () => {
    it('should return GP leaderboard sorted by MMR descending', async () => {
      // Arrange
      const mockLeaderboard = [
        {
          id: 'stats-1',
          userId: 'user-1',
          mmr: 2500,
          totalMatches: 150,
          totalWins: 30,
          user: {
            id: 'user-1',
            profileId: 1,
            displayName: 'Player1',
            avatarHash: 'avatar1',
          },
        },
        {
          id: 'stats-2',
          userId: 'user-2',
          mmr: 2400,
          totalMatches: 120,
          totalWins: 25,
          user: {
            id: 'user-2',
            profileId: 2,
            displayName: 'Player2',
            avatarHash: 'avatar2',
          },
        },
      ];

      mockPrismaService.userStatsGP.findMany.mockResolvedValue(mockLeaderboard);

      // Act
      const result = await service.getLeaderboard('GP', 100);

      // Assert
      expect(prisma.userStatsGP.findMany).toHaveBeenCalledWith({
        take: 100,
        orderBy: { mmr: 'desc' },
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
      });
      expect(result).toEqual(mockLeaderboard);
    });

    it('should return CLASSIC leaderboard sorted by MMR descending', async () => {
      // Arrange
      const mockLeaderboard = [
        {
          id: 'stats-1',
          userId: 'user-1',
          mmr: 1800,
          totalMatches: 80,
          totalWins: 15,
          user: {
            id: 'user-1',
            profileId: 1,
            displayName: 'ClassicPlayer1',
            avatarHash: 'avatar1',
          },
        },
      ];

      mockPrismaService.userStatsClassic.findMany.mockResolvedValue(mockLeaderboard);

      // Act
      const result = await service.getLeaderboard('CLASSIC', 50);

      // Assert
      expect(prisma.userStatsClassic.findMany).toHaveBeenCalledWith({
        take: 50,
        orderBy: { mmr: 'desc' },
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
      });
      expect(result).toEqual(mockLeaderboard);
    });
  });
});
