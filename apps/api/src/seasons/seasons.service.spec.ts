import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SeasonsService } from './seasons.service';
import { PrismaService } from '../prisma/prisma.service';
import { GameMode } from '@prisma/client';

describe('SeasonsService', () => {
  let service: SeasonsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    season: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    event: {
      updateMany: jest.fn(),
    },
    lobby: {
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeasonsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<SeasonsService>(SeasonsService);
    prisma = module.get<PrismaService>(PrismaService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new season successfully', async () => {
      // Arrange
      const createSeasonDto = {
        gameMode: GameMode.GP,
        seasonNumber: 1,
        startDate: '2025-01-01',
        endDate: '2025-03-31',
        description: 'First GP Season',
      };

      const mockCreatedSeason = {
        id: 'season-1',
        gameMode: GameMode.GP,
        seasonNumber: 1,
        description: 'First GP Season',
        eventId: 'event-1',
        event: {
          id: 'event-1',
          type: 'SEASON',
          name: 'Season 1 - GP',
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-03-31'),
          isActive: true,
        },
      };

      mockPrismaService.season.findUnique.mockResolvedValue(null); // No existing season
      mockPrismaService.event.updateMany.mockResolvedValue({ count: 0 });
      mockPrismaService.season.create.mockResolvedValue(mockCreatedSeason);

      // Act
      const result = await service.create(createSeasonDto);

      // Assert
      expect(prisma.season.findUnique).toHaveBeenCalledWith({
        where: {
          gameMode_seasonNumber: {
            gameMode: GameMode.GP,
            seasonNumber: 1,
          },
        },
      });

      expect(prisma.event.updateMany).toHaveBeenCalledWith({
        where: {
          type: 'SEASON',
          season: {
            gameMode: GameMode.GP,
          },
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });

      expect(prisma.season.create).toHaveBeenCalledWith({
        data: {
          gameMode: GameMode.GP,
          seasonNumber: 1,
          description: 'First GP Season',
          event: {
            create: {
              type: 'SEASON',
              name: 'Season 1 - GP',
              startDate: new Date('2025-01-01'),
              endDate: new Date('2025-03-31'),
              isActive: true,
            },
          },
        },
        include: {
          event: true,
        },
      });

      expect(result).toEqual(mockCreatedSeason);
    });

    it('should throw BadRequestException when season number already exists', async () => {
      // Arrange
      const createSeasonDto = {
        gameMode: GameMode.GP,
        seasonNumber: 1,
        startDate: '2025-01-01',
        endDate: null,
        description: 'Duplicate Season',
      };

      const existingSeason = {
        id: 'season-existing',
        gameMode: GameMode.GP,
        seasonNumber: 1,
      };

      mockPrismaService.season.findUnique.mockResolvedValue(existingSeason);

      // Act & Assert
      await expect(service.create(createSeasonDto)).rejects.toThrow(BadRequestException);
      await expect(service.create(createSeasonDto)).rejects.toThrow(
        'Season 1 already exists for GP'
      );

      expect(prisma.season.create).not.toHaveBeenCalled();
    });
  });

  describe('getActive', () => {
    it('should return active season for given game mode', async () => {
      // Arrange
      const mockSeason = {
        id: 'season-1',
        gameMode: GameMode.GP,
        seasonNumber: 1,
        eventId: 'event-1',
        event: {
          id: 'event-1',
          type: 'SEASON',
          isActive: true,
        },
      };

      mockPrismaService.season.findFirst.mockResolvedValue(mockSeason);

      // Act
      const result = await service.getActive(GameMode.GP);

      // Assert
      expect(prisma.season.findFirst).toHaveBeenCalledWith({
        where: {
          gameMode: GameMode.GP,
          event: {
            isActive: true,
            type: 'SEASON',
          },
        },
        include: {
          event: true,
        },
      });
      expect(result).toEqual(mockSeason);
    });

    it('should throw NotFoundException when no active season found', async () => {
      // Arrange
      mockPrismaService.season.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getActive(GameMode.GP)).rejects.toThrow(NotFoundException);
      await expect(service.getActive(GameMode.GP)).rejects.toThrow(
        'No active season found for GP'
      );
    });
  });

  describe('getAll', () => {
    it('should return all seasons for specific game mode', async () => {
      // Arrange
      const mockSeasons = [
        {
          id: 'season-2',
          gameMode: GameMode.GP,
          seasonNumber: 2,
          event: { id: 'event-2' },
        },
        {
          id: 'season-1',
          gameMode: GameMode.GP,
          seasonNumber: 1,
          event: { id: 'event-1' },
        },
      ];

      mockPrismaService.season.findMany.mockResolvedValue(mockSeasons);

      // Act
      const result = await service.getAll(GameMode.GP);

      // Assert
      expect(prisma.season.findMany).toHaveBeenCalledWith({
        where: { gameMode: GameMode.GP },
        include: {
          event: true,
        },
        orderBy: {
          seasonNumber: 'desc',
        },
      });
      expect(result).toEqual(mockSeasons);
    });

    it('should return all seasons when no game mode specified', async () => {
      // Arrange
      const mockSeasons = [
        { id: 'season-1', gameMode: GameMode.GP },
        { id: 'season-2', gameMode: GameMode.CLASSIC },
      ];

      mockPrismaService.season.findMany.mockResolvedValue(mockSeasons);

      // Act
      const result = await service.getAll();

      // Assert
      expect(prisma.season.findMany).toHaveBeenCalledWith({
        where: undefined,
        include: {
          event: true,
        },
        orderBy: {
          seasonNumber: 'desc',
        },
      });
      expect(result).toEqual(mockSeasons);
    });
  });

  describe('getById', () => {
    it('should return season when found', async () => {
      // Arrange
      const seasonId = 'season-123';
      const mockSeason = {
        id: seasonId,
        gameMode: GameMode.GP,
        seasonNumber: 1,
        event: { id: 'event-1' },
      };

      mockPrismaService.season.findUnique.mockResolvedValue(mockSeason);

      // Act
      const result = await service.getById(seasonId);

      // Assert
      expect(prisma.season.findUnique).toHaveBeenCalledWith({
        where: { id: seasonId },
        include: {
          event: true,
        },
      });
      expect(result).toEqual(mockSeason);
    });

    it('should throw NotFoundException when season not found', async () => {
      // Arrange
      const seasonId = 'non-existent';
      mockPrismaService.season.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getById(seasonId)).rejects.toThrow(NotFoundException);
      await expect(service.getById(seasonId)).rejects.toThrow('Season not found');
    });
  });

  describe('delete', () => {
    it('should delete season successfully when no lobbies associated', async () => {
      // Arrange
      const seasonId = 'season-123';
      const mockSeason = {
        id: seasonId,
        gameMode: GameMode.GP,
        seasonNumber: 1,
        eventId: 'event-1',
        event: { id: 'event-1' },
      };

      mockPrismaService.season.findUnique.mockResolvedValue(mockSeason);
      mockPrismaService.lobby.count.mockResolvedValue(0); // No lobbies
      mockPrismaService.season.delete.mockResolvedValue(mockSeason);

      // Act
      const result = await service.delete(seasonId);

      // Assert
      expect(prisma.lobby.count).toHaveBeenCalledWith({
        where: {
          eventId: 'event-1',
        },
      });
      expect(prisma.season.delete).toHaveBeenCalledWith({
        where: { id: seasonId },
      });
      expect(result).toEqual({ message: 'Season deleted successfully' });
    });

    it('should throw BadRequestException when lobbies are associated', async () => {
      // Arrange
      const seasonId = 'season-123';
      const mockSeason = {
        id: seasonId,
        gameMode: GameMode.GP,
        seasonNumber: 1,
        eventId: 'event-1',
        event: { id: 'event-1' },
      };

      mockPrismaService.season.findUnique.mockResolvedValue(mockSeason);
      mockPrismaService.lobby.count.mockResolvedValue(5); // 5 lobbies exist

      // Act & Assert
      await expect(service.delete(seasonId)).rejects.toThrow(BadRequestException);
      await expect(service.delete(seasonId)).rejects.toThrow(
        'Cannot delete season with 5 associated lobbies'
      );

      expect(prisma.season.delete).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update season description and dates successfully', async () => {
      // Arrange
      const seasonId = 'season-123';
      const mockSeason = {
        id: seasonId,
        gameMode: GameMode.GP,
        seasonNumber: 1,
        description: 'Old description',
        eventId: 'event-1',
        event: {
          id: 'event-1',
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-03-31'),
        },
      };

      const updateData = {
        description: 'Updated description',
        startDate: '2025-02-01',
        endDate: '2025-04-30',
      };

      const mockUpdatedSeason = {
        ...mockSeason,
        description: updateData.description,
        event: {
          id: 'event-1',
          startDate: new Date(updateData.startDate),
          endDate: new Date(updateData.endDate),
        },
      };

      mockPrismaService.season.findUnique.mockResolvedValue(mockSeason);
      mockPrismaService.season.update.mockResolvedValue(mockUpdatedSeason);

      // Act
      const result = await service.update(seasonId, updateData);

      // Assert
      expect(prisma.season.update).toHaveBeenCalledWith({
        where: { id: seasonId },
        data: {
          description: updateData.description,
          event: {
            update: {
              startDate: new Date(updateData.startDate),
              endDate: new Date(updateData.endDate),
            },
          },
        },
        include: {
          event: true,
        },
      });
      expect(result).toEqual(mockUpdatedSeason);
    });

    it('should update season number and event name successfully', async () => {
      // Arrange
      const seasonId = 'season-123';
      const mockSeason = {
        id: seasonId,
        gameMode: GameMode.GP,
        seasonNumber: 1,
        description: 'Description',
        eventId: 'event-1',
        event: { id: 'event-1', name: 'Season 1 - GP' },
      };

      const updateData = {
        seasonNumber: 2,
      };

      const mockUpdatedSeason = {
        ...mockSeason,
        seasonNumber: 2,
        event: { id: 'event-1', name: 'Season 2 - GP' },
      };

      mockPrismaService.season.findUnique
        .mockResolvedValueOnce(mockSeason) // getById call
        .mockResolvedValueOnce(null); // duplicate check returns null
      mockPrismaService.season.update.mockResolvedValue(mockUpdatedSeason);

      // Act
      const result = await service.update(seasonId, updateData);

      // Assert
      expect(prisma.season.findUnique).toHaveBeenNthCalledWith(2, {
        where: {
          gameMode_seasonNumber: {
            gameMode: GameMode.GP,
            seasonNumber: 2,
          },
        },
      });

      expect(prisma.season.update).toHaveBeenCalledWith({
        where: { id: seasonId },
        data: {
          seasonNumber: 2,
          event: {
            update: {
              name: 'Season 2 - GP',
            },
          },
        },
        include: {
          event: true,
        },
      });
      expect(result).toEqual(mockUpdatedSeason);
    });

    it('should throw BadRequestException when new season number already exists', async () => {
      // Arrange
      const seasonId = 'season-123';
      const mockSeason = {
        id: seasonId,
        gameMode: GameMode.GP,
        seasonNumber: 1,
        description: 'Description',
        eventId: 'event-1',
        event: { id: 'event-1' },
      };

      const updateData = {
        seasonNumber: 2,
      };

      const existingSeason = {
        id: 'season-456',
        gameMode: GameMode.GP,
        seasonNumber: 2,
      };

      mockPrismaService.season.findUnique
        .mockResolvedValueOnce(mockSeason) // getById call
        .mockResolvedValueOnce(existingSeason); // duplicate check

      // Act & Assert
      await expect(service.update(seasonId, updateData)).rejects.toThrow(BadRequestException);
      await expect(service.update(seasonId, updateData)).rejects.toThrow(
        'Season 2 already exists for GP'
      );

      expect(prisma.season.update).not.toHaveBeenCalled();
    });
  });

  describe('toggleStatus', () => {
    it('should activate season and deactivate other seasons of same game mode', async () => {
      // Arrange
      const seasonId = 'season-123';
      const mockSeason = {
        id: seasonId,
        gameMode: GameMode.GP,
        seasonNumber: 2,
        eventId: 'event-2',
        event: {
          id: 'event-2',
          isActive: false,
        },
      };

      const mockUpdatedSeason = {
        ...mockSeason,
        event: {
          id: 'event-2',
          isActive: true,
        },
      };

      mockPrismaService.season.findUnique.mockResolvedValue(mockSeason);
      mockPrismaService.event.updateMany.mockResolvedValue({ count: 1 }); // 1 other season deactivated
      mockPrismaService.season.update.mockResolvedValue(mockUpdatedSeason);

      // Act
      const result = await service.toggleStatus(seasonId, true);

      // Assert
      // Should deactivate other active seasons of same game mode
      expect(prisma.event.updateMany).toHaveBeenCalledWith({
        where: {
          type: 'SEASON',
          season: {
            gameMode: GameMode.GP,
          },
          isActive: true,
          id: {
            not: 'event-2',
          },
        },
        data: {
          isActive: false,
        },
      });

      // Should activate the target season
      expect(prisma.season.update).toHaveBeenCalledWith({
        where: { id: seasonId },
        data: {
          event: {
            update: {
              isActive: true,
            },
          },
        },
        include: {
          event: true,
        },
      });

      expect(result).toEqual(mockUpdatedSeason);
    });

    it('should deactivate season without deactivating others', async () => {
      // Arrange
      const seasonId = 'season-123';
      const mockSeason = {
        id: seasonId,
        gameMode: GameMode.GP,
        seasonNumber: 1,
        eventId: 'event-1',
        event: {
          id: 'event-1',
          isActive: true,
        },
      };

      const mockUpdatedSeason = {
        ...mockSeason,
        event: {
          id: 'event-1',
          isActive: false,
        },
      };

      mockPrismaService.season.findUnique.mockResolvedValue(mockSeason);
      mockPrismaService.season.update.mockResolvedValue(mockUpdatedSeason);

      // Act
      const result = await service.toggleStatus(seasonId, false);

      // Assert
      // Should NOT deactivate other seasons when setting to false
      expect(prisma.event.updateMany).not.toHaveBeenCalled();

      // Should deactivate the target season
      expect(prisma.season.update).toHaveBeenCalledWith({
        where: { id: seasonId },
        data: {
          event: {
            update: {
              isActive: false,
            },
          },
        },
        include: {
          event: true,
        },
      });

      expect(result).toEqual(mockUpdatedSeason);
    });

    it('should throw NotFoundException when season not found', async () => {
      // Arrange
      const seasonId = 'non-existent';
      mockPrismaService.season.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.toggleStatus(seasonId, true)).rejects.toThrow(NotFoundException);
      await expect(service.toggleStatus(seasonId, true)).rejects.toThrow('Season not found');
    });
  });
});
