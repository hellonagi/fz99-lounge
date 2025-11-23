import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { StorageService } from './storage.service';
import { S3Client } from '@aws-sdk/client-s3';

// Mock S3Client send method
const mockSend = jest.fn();
jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation(() => ({
      send: mockSend,
    })),
    PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
    CopyObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
    DeleteObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
    GetObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  };
});

describe('StorageService', () => {
  let service: StorageService;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config: Record<string, any> = {
        S3_BUCKET_NAME: 'test-bucket',
        AWS_REGION: 'ap-northeast-1',
        S3_ENDPOINT: 'http://localhost:9000',
        S3_ACCESS_KEY_ID: 'minioadmin',
        S3_SECRET_ACCESS_KEY: 'minioadmin',
      };
      return config[key] !== undefined ? config[key] : defaultValue;
    }),
  };

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    // Suppress logger output
    jest.spyOn(Logger.prototype, 'log').mockImplementation();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('uploadTempScreenshot', () => {
    it('should upload file to temp folder and return URL', async () => {
      // Arrange
      const matchId = 'match-123';
      const mockFile = {
        fieldname: 'file',
        originalname: 'screenshot.png',
        encoding: '7bit',
        mimetype: 'image/png',
        buffer: Buffer.from('fake-image-data'),
        size: 12345,
      } as Express.Multer.File;

      mockSend.mockResolvedValue({} as any);

      // Mock Date.now() for consistent key generation
      const mockTimestamp = 1234567890;
      jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

      // Act
      const result = await service.uploadTempScreenshot(matchId, mockFile);

      // Assert
      expect(mockSend).toHaveBeenCalledTimes(1);

      const sentCommand = mockSend.mock.calls[0][0];
      expect(sentCommand.input).toMatchObject({
        Bucket: 'test-bucket',
        Key: `screenshots/temp/${matchId}/${mockTimestamp}-screenshot.png`,
        ContentType: 'image/png',
      });
      // Body is a Buffer, just check it exists
      expect(sentCommand.input.Body).toBeDefined();

      expect(result).toBe(
        `http://localhost:9000/screenshots/temp/${matchId}/${mockTimestamp}-screenshot.png`
      );

      // Restore Date.now()
      jest.spyOn(Date, 'now').mockRestore();
    });
  });

  describe('copyToPermanent', () => {
    it('should copy file from temp to permanent folder', async () => {
      // Arrange
      const matchId = 'match-123';
      const tempUrl = 'http://localhost:9000/screenshots/temp/match-123/1234567890-screenshot.png';

      mockSend.mockResolvedValue({} as any);

      // Act
      const result = await service.copyToPermanent(tempUrl, matchId);

      // Assert
      expect(mockSend).toHaveBeenCalledTimes(1);

      const sentCommand = mockSend.mock.calls[0][0];
      expect(sentCommand.input).toEqual({
        Bucket: 'test-bucket',
        CopySource: 'test-bucket/screenshots/temp/match-123/1234567890-screenshot.png',
        Key: `screenshots/permanent/${matchId}.jpg`,
      });

      expect(result).toBe(`http://localhost:9000/screenshots/permanent/${matchId}.jpg`);
    });
  });

  describe('deleteFile', () => {
    it('should delete file from storage', async () => {
      // Arrange
      const fileUrl = 'http://localhost:9000/screenshots/temp/match-123/screenshot.png';

      mockSend.mockResolvedValue({} as any);

      // Act
      await service.deleteFile(fileUrl);

      // Assert
      expect(mockSend).toHaveBeenCalledTimes(1);

      const sentCommand = mockSend.mock.calls[0][0];
      expect(sentCommand.input).toEqual({
        Bucket: 'test-bucket',
        Key: 'screenshots/temp/match-123/screenshot.png',
      });
    });
  });
});
