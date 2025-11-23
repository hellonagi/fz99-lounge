import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ScreenshotsService } from './screenshots.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

describe('ScreenshotsService', () => {
  let service: ScreenshotsService;
  let prisma: PrismaService;
  let storage: StorageService;

  const mockPrismaService = {
    match: {
      findUnique: jest.fn(),
    },
    matchScreenshotSubmission: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    resultScreenshot: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockStorageService = {
    uploadTempScreenshot: jest.fn(),
    copyToPermanent: jest.fn(),
    deleteFile: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScreenshotsService,
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

    service = module.get<ScreenshotsService>(ScreenshotsService);
    prisma = module.get<PrismaService>(PrismaService);
    storage = module.get<StorageService>(StorageService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('submitScreenshot', () => {
    it('should successfully submit a screenshot', async () => {
      // Arrange
      const matchId = 'match-123';
      const userId = 'user-456';
      const mockFile = {
        fieldname: 'file',
        originalname: 'screenshot.png',
        encoding: '7bit',
        mimetype: 'image/png',
        buffer: Buffer.from('fake-image-data'),
        size: 12345,
      } as Express.Multer.File;

      const mockMatch = {
        id: matchId,
        status: 'ONGOING',
      };

      const mockImageUrl = 'https://s3.amazonaws.com/screenshots/temp/match-123/screenshot.png';

      const mockSubmission = {
        id: 'submission-123',
        matchId,
        userId,
        imageUrl: mockImageUrl,
        uploadedAt: new Date(),
        user: {
          id: userId,
          displayName: 'Player1',
          username: 'player1',
        },
      };

      mockPrismaService.match.findUnique.mockResolvedValue(mockMatch);
      mockStorageService.uploadTempScreenshot.mockResolvedValue(mockImageUrl);
      mockPrismaService.matchScreenshotSubmission.create.mockResolvedValue(mockSubmission);

      // Act
      const result = await service.submitScreenshot(matchId, userId, mockFile);

      // Assert
      expect(prisma.match.findUnique).toHaveBeenCalledWith({
        where: { id: matchId },
      });
      expect(storage.uploadTempScreenshot).toHaveBeenCalledWith(matchId, mockFile);
      expect(prisma.matchScreenshotSubmission.create).toHaveBeenCalledWith({
        data: {
          matchId,
          userId,
          imageUrl: mockImageUrl,
        },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              username: true,
            },
          },
        },
      });
      expect(result).toEqual(mockSubmission);
    });

    it('should throw NotFoundException when match does not exist', async () => {
      // Arrange
      const matchId = 'non-existent-match';
      const userId = 'user-456';
      const mockFile = {} as Express.Multer.File;

      mockPrismaService.match.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.submitScreenshot(matchId, userId, mockFile),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.submitScreenshot(matchId, userId, mockFile),
      ).rejects.toThrow(`Match ${matchId} not found`);

      expect(storage.uploadTempScreenshot).not.toHaveBeenCalled();
      expect(prisma.matchScreenshotSubmission.create).not.toHaveBeenCalled();
    });
  });

  describe('selectScreenshot', () => {
    it('should successfully select a screenshot when no existing screenshot exists', async () => {
      // Arrange
      const submissionId = 'submission-123';
      const adminUserId = 'admin-789';
      const matchId = 'match-123';

      const mockSubmission = {
        id: submissionId,
        matchId,
        userId: 'user-456',
        imageUrl: 'https://s3.amazonaws.com/screenshots/temp/match-123/screenshot.png',
        uploadedAt: new Date(),
      };

      const permanentUrl = 'https://s3.amazonaws.com/screenshots/permanent/match-123.jpg';

      const mockResultScreenshot = {
        id: 'result-123',
        matchId,
        imageUrl: permanentUrl,
        userId: 'user-456',
        selectedBy: adminUserId,
        selectedAt: new Date(),
      };

      mockPrismaService.matchScreenshotSubmission.findUnique.mockResolvedValue(mockSubmission);
      mockPrismaService.resultScreenshot.findUnique.mockResolvedValue(null); // No existing screenshot
      mockStorageService.copyToPermanent.mockResolvedValue(permanentUrl);
      mockPrismaService.resultScreenshot.create.mockResolvedValue(mockResultScreenshot);
      mockPrismaService.matchScreenshotSubmission.update.mockResolvedValue({
        ...mockSubmission,
        isSelected: true,
      });

      // Act
      const result = await service.selectScreenshot(submissionId, adminUserId);

      // Assert
      expect(prisma.matchScreenshotSubmission.findUnique).toHaveBeenCalledWith({
        where: { id: submissionId },
      });

      expect(prisma.resultScreenshot.findUnique).toHaveBeenCalledWith({
        where: { matchId },
      });

      expect(storage.copyToPermanent).toHaveBeenCalledWith(
        mockSubmission.imageUrl,
        matchId,
      );

      expect(prisma.resultScreenshot.create).toHaveBeenCalledWith({
        data: {
          matchId,
          imageUrl: permanentUrl,
          userId: 'user-456',
          selectedBy: adminUserId,
        },
      });

      expect(prisma.matchScreenshotSubmission.update).toHaveBeenCalledWith({
        where: { id: submissionId },
        data: { isSelected: true },
      });

      // Should not delete any existing files
      expect(storage.deleteFile).not.toHaveBeenCalled();
      expect(prisma.resultScreenshot.delete).not.toHaveBeenCalled();

      expect(result).toEqual(mockResultScreenshot);
    });

    it('should replace existing screenshot when selecting a new one', async () => {
      // Arrange
      const submissionId = 'submission-456';
      const adminUserId = 'admin-789';
      const matchId = 'match-123';

      const mockSubmission = {
        id: submissionId,
        matchId,
        userId: 'user-999',
        imageUrl: 'https://s3.amazonaws.com/screenshots/temp/match-123/new-screenshot.png',
        uploadedAt: new Date(),
      };

      const existingScreenshot = {
        id: 'result-old',
        matchId,
        imageUrl: 'https://s3.amazonaws.com/screenshots/permanent/match-123-old.jpg',
        userId: 'user-456',
        selectedBy: 'admin-123',
        selectedAt: new Date(),
      };

      const permanentUrl = 'https://s3.amazonaws.com/screenshots/permanent/match-123.jpg';

      const mockResultScreenshot = {
        id: 'result-new',
        matchId,
        imageUrl: permanentUrl,
        userId: 'user-999',
        selectedBy: adminUserId,
        selectedAt: new Date(),
      };

      mockPrismaService.matchScreenshotSubmission.findUnique.mockResolvedValue(mockSubmission);
      mockPrismaService.resultScreenshot.findUnique.mockResolvedValue(existingScreenshot);
      mockStorageService.copyToPermanent.mockResolvedValue(permanentUrl);
      mockStorageService.deleteFile.mockResolvedValue(undefined);
      mockPrismaService.resultScreenshot.delete.mockResolvedValue(existingScreenshot);
      mockPrismaService.resultScreenshot.create.mockResolvedValue(mockResultScreenshot);
      mockPrismaService.matchScreenshotSubmission.update.mockResolvedValue({
        ...mockSubmission,
        isSelected: true,
      });

      // Act
      const result = await service.selectScreenshot(submissionId, adminUserId);

      // Assert
      expect(prisma.matchScreenshotSubmission.findUnique).toHaveBeenCalledWith({
        where: { id: submissionId },
      });

      expect(prisma.resultScreenshot.findUnique).toHaveBeenCalledWith({
        where: { matchId },
      });

      // Should delete old file from storage
      expect(storage.deleteFile).toHaveBeenCalledWith(existingScreenshot.imageUrl);

      // Should delete old screenshot record
      expect(prisma.resultScreenshot.delete).toHaveBeenCalledWith({
        where: { id: existingScreenshot.id },
      });

      // Should copy new file to permanent
      expect(storage.copyToPermanent).toHaveBeenCalledWith(
        mockSubmission.imageUrl,
        matchId,
      );

      // Should create new result screenshot
      expect(prisma.resultScreenshot.create).toHaveBeenCalledWith({
        data: {
          matchId,
          imageUrl: permanentUrl,
          userId: 'user-999',
          selectedBy: adminUserId,
        },
      });

      // Should mark submission as selected
      expect(prisma.matchScreenshotSubmission.update).toHaveBeenCalledWith({
        where: { id: submissionId },
        data: { isSelected: true },
      });

      expect(result).toEqual(mockResultScreenshot);
    });

    it('should throw NotFoundException when submission does not exist', async () => {
      // Arrange
      const submissionId = 'non-existent-submission';
      const adminUserId = 'admin-789';

      mockPrismaService.matchScreenshotSubmission.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.selectScreenshot(submissionId, adminUserId),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.selectScreenshot(submissionId, adminUserId),
      ).rejects.toThrow(`Screenshot submission ${submissionId} not found`);

      // Should not proceed to check existing screenshot or copy files
      expect(prisma.resultScreenshot.findUnique).not.toHaveBeenCalled();
      expect(storage.copyToPermanent).not.toHaveBeenCalled();
      expect(storage.deleteFile).not.toHaveBeenCalled();
      expect(prisma.resultScreenshot.create).not.toHaveBeenCalled();
      expect(prisma.matchScreenshotSubmission.update).not.toHaveBeenCalled();
    });
  });
});
