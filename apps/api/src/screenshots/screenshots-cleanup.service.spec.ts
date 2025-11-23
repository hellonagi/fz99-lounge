import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ScreenshotsCleanupService } from './screenshots-cleanup.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

describe('ScreenshotsCleanupService', () => {
  let service: ScreenshotsCleanupService;
  let prisma: PrismaService;
  let storage: StorageService;

  const mockPrismaService = {
    matchScreenshotSubmission: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockStorageService = {
    deleteFile: jest.fn(),
  };

  beforeEach(async () => {
    // Suppress logger output
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScreenshotsCleanupService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
      ],
    }).compile();

    service = module.get<ScreenshotsCleanupService>(ScreenshotsCleanupService);
    prisma = module.get<PrismaService>(PrismaService);
    storage = module.get<StorageService>(StorageService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('cleanupUnselectedScreenshots', () => {
    it('should delete unselected screenshots older than 7 days', async () => {
      // Arrange
      const now = new Date('2025-01-23T03:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => now as any);

      const cutoffDate = new Date('2025-01-16T03:00:00Z'); // 7 days ago

      const mockScreenshots = [
        {
          id: 'screenshot-1',
          matchId: 'match-1',
          userId: 'user-1',
          imageUrl: 'http://localhost:9000/screenshots/temp/match-1/old1.png',
          isSelected: false,
          deletedAt: null,
          uploadedAt: new Date('2025-01-10T00:00:00Z'), // 13 days ago
        },
        {
          id: 'screenshot-2',
          matchId: 'match-2',
          userId: 'user-2',
          imageUrl: 'http://localhost:9000/screenshots/temp/match-2/old2.png',
          isSelected: false,
          deletedAt: null,
          uploadedAt: new Date('2025-01-15T00:00:00Z'), // 8 days ago
        },
      ];

      (prisma as any).matchScreenshotSubmission.findMany.mockResolvedValue(mockScreenshots);
      mockStorageService.deleteFile.mockResolvedValue(undefined);
      (prisma as any).matchScreenshotSubmission.update.mockResolvedValue({});

      // Act
      await service.cleanupUnselectedScreenshots();

      // Assert
      expect(prisma.matchScreenshotSubmission.findMany).toHaveBeenCalledWith({
        where: {
          isSelected: false,
          deletedAt: null,
          uploadedAt: {
            lt: cutoffDate,
          },
        },
      });

      // Should delete both screenshots from storage
      expect(storage.deleteFile).toHaveBeenCalledTimes(2);
      expect(storage.deleteFile).toHaveBeenCalledWith(mockScreenshots[0].imageUrl);
      expect(storage.deleteFile).toHaveBeenCalledWith(mockScreenshots[1].imageUrl);

      // Should soft-delete both records in DB
      expect(prisma.matchScreenshotSubmission.update).toHaveBeenCalledTimes(2);
      expect(prisma.matchScreenshotSubmission.update).toHaveBeenNthCalledWith(1, {
        where: { id: 'screenshot-1' },
        data: { deletedAt: expect.any(Object) },
      });
      expect(prisma.matchScreenshotSubmission.update).toHaveBeenNthCalledWith(2, {
        where: { id: 'screenshot-2' },
        data: { deletedAt: expect.any(Object) },
      });

      // Restore Date
      jest.spyOn(global, 'Date').mockRestore();
    });

    it('should handle case when no screenshots need cleanup', async () => {
      // Arrange
      (prisma as any).matchScreenshotSubmission.findMany.mockResolvedValue([]);

      // Act
      await service.cleanupUnselectedScreenshots();

      // Assert
      expect(prisma.matchScreenshotSubmission.findMany).toHaveBeenCalled();
      expect(storage.deleteFile).not.toHaveBeenCalled();
      expect(prisma.matchScreenshotSubmission.update).not.toHaveBeenCalled();
    });

    it('should continue cleanup even when some deletions fail', async () => {
      // Arrange
      const mockScreenshots = [
        {
          id: 'screenshot-1',
          imageUrl: 'http://localhost:9000/screenshots/temp/fail.png',
          isSelected: false,
          deletedAt: null,
        },
        {
          id: 'screenshot-2',
          imageUrl: 'http://localhost:9000/screenshots/temp/success.png',
          isSelected: false,
          deletedAt: null,
        },
      ];

      (prisma as any).matchScreenshotSubmission.findMany.mockResolvedValue(mockScreenshots);

      // First deletion fails, second succeeds
      mockStorageService.deleteFile
        .mockRejectedValueOnce(new Error('S3 connection error'))
        .mockResolvedValueOnce(undefined);

      (prisma as any).matchScreenshotSubmission.update.mockResolvedValue({});

      // Act
      await service.cleanupUnselectedScreenshots();

      // Assert
      expect(storage.deleteFile).toHaveBeenCalledTimes(2);

      // First screenshot should fail, so no DB update
      expect(prisma.matchScreenshotSubmission.update).toHaveBeenCalledTimes(1);
      expect(prisma.matchScreenshotSubmission.update).toHaveBeenCalledWith({
        where: { id: 'screenshot-2' },
        data: { deletedAt: expect.any(Object) },
      });
    });
  });
});
