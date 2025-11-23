import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { PushNotificationsService } from './push-notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import * as webpush from 'web-push';

// Mock web-push
jest.mock('web-push');

describe('PushNotificationsService', () => {
  let service: PushNotificationsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    pushSubscription: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        VAPID_PUBLIC_KEY: 'test-public-key',
        VAPID_PRIVATE_KEY: 'test-private-key',
        VAPID_SUBJECT: 'mailto:test@example.com',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    // Suppress logger output
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    // Reset mocks
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushNotificationsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<PushNotificationsService>(PushNotificationsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('subscribe', () => {
    it('should save push subscription to database', async () => {
      // Arrange
      const userId = 'user-123';
      const subscription = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
        keys: {
          p256dh: 'test-p256dh-key',
          auth: 'test-auth-key',
        },
      };

      mockPrismaService.pushSubscription.upsert.mockResolvedValue({
        id: 'sub-1',
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      });

      // Act
      await service.subscribe(userId, subscription);

      // Assert
      expect(prisma.pushSubscription.upsert).toHaveBeenCalledWith({
        where: {
          userId_endpoint: {
            userId,
            endpoint: subscription.endpoint,
          },
        },
        create: {
          userId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
        update: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      });
    });

    it('should throw error for invalid subscription', async () => {
      // Arrange
      const userId = 'user-123';
      const invalidSubscription = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
        keys: {
          p256dh: '',
          auth: '',
        },
      };

      // Act & Assert
      await expect(
        service.subscribe(userId, invalidSubscription as any),
      ).rejects.toThrow('Invalid subscription object');

      expect(prisma.pushSubscription.upsert).not.toHaveBeenCalled();
    });
  });

  describe('unsubscribe', () => {
    it('should remove push subscription from database', async () => {
      // Arrange
      const userId = 'user-123';
      const endpoint = 'https://fcm.googleapis.com/fcm/send/abc123';

      mockPrismaService.pushSubscription.deleteMany.mockResolvedValue({ count: 1 });

      // Act
      await service.unsubscribe(userId, endpoint);

      // Assert
      expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
        where: {
          userId,
          endpoint,
        },
      });
    });
  });

  describe('sendNotification', () => {
    it('should send notification to all user subscriptions', async () => {
      // Arrange
      const userId = 'user-123';
      const payload = {
        title: 'Test Notification',
        body: 'This is a test',
        icon: '/icon.png',
      };

      const mockSubscriptions = [
        {
          id: 'sub-1',
          userId,
          endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
          p256dh: 'test-p256dh-1',
          auth: 'test-auth-1',
        },
        {
          id: 'sub-2',
          userId,
          endpoint: 'https://fcm.googleapis.com/fcm/send/xyz789',
          p256dh: 'test-p256dh-2',
          auth: 'test-auth-2',
        },
      ];

      mockPrismaService.pushSubscription.findMany.mockResolvedValue(mockSubscriptions);
      (webpush.sendNotification as jest.Mock).mockResolvedValue({});

      // Act
      await service.sendNotification(userId, payload);

      // Assert
      expect(prisma.pushSubscription.findMany).toHaveBeenCalledWith({
        where: { userId },
      });

      expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
      expect(webpush.sendNotification).toHaveBeenCalledWith(
        {
          endpoint: mockSubscriptions[0].endpoint,
          keys: {
            p256dh: mockSubscriptions[0].p256dh,
            auth: mockSubscriptions[0].auth,
          },
        },
        JSON.stringify(payload),
      );
    });

    it('should return early when no subscriptions found', async () => {
      // Arrange
      const userId = 'user-123';
      const payload = {
        title: 'Test Notification',
        body: 'This is a test',
      };

      mockPrismaService.pushSubscription.findMany.mockResolvedValue([]);

      // Act
      await service.sendNotification(userId, payload);

      // Assert
      expect(prisma.pushSubscription.findMany).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(webpush.sendNotification).not.toHaveBeenCalled();
    });

    it('should remove invalid subscriptions (410 error)', async () => {
      // Arrange
      const userId = 'user-123';
      const payload = {
        title: 'Test Notification',
        body: 'This is a test',
      };

      const mockSubscription = {
        id: 'sub-1',
        userId,
        endpoint: 'https://fcm.googleapis.com/fcm/send/invalid',
        p256dh: 'test-p256dh',
        auth: 'test-auth',
      };

      mockPrismaService.pushSubscription.findMany.mockResolvedValue([mockSubscription]);

      const error410 = new Error('Gone');
      (error410 as any).statusCode = 410;
      (webpush.sendNotification as jest.Mock).mockRejectedValue(error410);

      mockPrismaService.pushSubscription.delete.mockResolvedValue(mockSubscription);

      // Act
      await service.sendNotification(userId, payload);

      // Assert
      expect(prisma.pushSubscription.delete).toHaveBeenCalledWith({
        where: { id: mockSubscription.id },
      });
    });
  });

  describe('notifyMatchStart', () => {
    it('should send match start notification to all participants', async () => {
      // Arrange
      const match = {
        id: 'match-123',
        passcode: '1234',
        leagueType: 'KNIGHT',
        totalPlayers: 50,
        lobby: {
          participants: [
            { userId: 'user-1' },
            { userId: 'user-2' },
            { userId: 'user-3' },
          ],
        },
      };

      mockPrismaService.pushSubscription.findMany.mockResolvedValue([
        {
          id: 'sub-1',
          userId: 'user-1',
          endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
          p256dh: 'test-p256dh',
          auth: 'test-auth',
        },
      ]);

      (webpush.sendNotification as jest.Mock).mockResolvedValue({});

      // Act
      await service.notifyMatchStart(match);

      // Assert
      expect(prisma.pushSubscription.findMany).toHaveBeenCalledTimes(3);

      // Verify notification payload
      const expectedPayload = {
        title: '🎮 マッチが開始されました！',
        body: 'パスコード: 1234',
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        data: {
          matchId: 'match-123',
          passcode: '1234',
          url: '/matches/match-123',
        },
        actions: [
          {
            action: 'open-match',
            title: 'マッチページを開く',
          },
        ],
      };

      expect(webpush.sendNotification).toHaveBeenCalledWith(
        expect.any(Object),
        JSON.stringify(expectedPayload),
      );
    });
  });
});
