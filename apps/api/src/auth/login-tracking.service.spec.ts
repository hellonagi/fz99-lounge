import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { LoginTrackingService } from './login-tracking.service';
import { PrismaService } from '../prisma/prisma.service';
import { Request } from 'express';

describe('LoginTrackingService', () => {
  let service: LoginTrackingService;
  let prisma: PrismaService;

  const mockPrismaService = {
    userLoginHistory: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    user: {
      update: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      if (key === 'MULTI_ACCOUNT_IP_THRESHOLD') {
        return defaultValue || 3;
      }
      return defaultValue;
    }),
  };

  beforeEach(async () => {
    // Suppress logger output
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    // Reset all mocks
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoginTrackingService,
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

    service = module.get<LoginTrackingService>(LoginTrackingService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('extractIpAddress', () => {
    it('should extract IP from X-Forwarded-For header', () => {
      // Arrange
      const mockReq = {
        headers: {
          'x-forwarded-for': '203.0.113.195, 198.51.100.178',
        },
        socket: { remoteAddress: '10.0.0.1' },
      } as any as Request;

      // Act
      const ip = service.extractIpAddress(mockReq);

      // Assert
      expect(ip).toBe('203.0.113.195');
    });

    it('should extract IP from X-Real-IP header', () => {
      // Arrange
      const mockReq = {
        headers: {
          'x-real-ip': '198.51.100.42',
        },
        socket: { remoteAddress: '10.0.0.1' },
      } as any as Request;

      // Act
      const ip = service.extractIpAddress(mockReq);

      // Assert
      expect(ip).toBe('198.51.100.42');
    });

    it('should fallback to socket.remoteAddress', () => {
      // Arrange
      const mockReq = {
        headers: {},
        socket: { remoteAddress: '192.168.1.100' },
      } as any as Request;

      // Act
      const ip = service.extractIpAddress(mockReq);

      // Assert
      expect(ip).toBe('192.168.1.100');
    });

    it('should return "unknown" when no IP available', () => {
      // Arrange
      const mockReq = {
        headers: {},
        socket: {},
      } as any as Request;

      // Act
      const ip = service.extractIpAddress(mockReq);

      // Assert
      expect(ip).toBe('unknown');
    });
  });

  describe('parseUserAgent', () => {
    it('should parse Chrome on Windows user agent', () => {
      // Arrange
      const userAgent =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

      // Act
      const result = service.parseUserAgent(userAgent);

      // Assert
      expect(result.browser).toBe('Chrome');
      expect(result.os).toBe('Windows');
      expect(result.deviceType).toBe('desktop');
    });

    it('should parse Safari on iPhone user agent', () => {
      // Arrange
      const userAgent =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

      // Act
      const result = service.parseUserAgent(userAgent);

      // Assert
      expect(result.browser).toBe('Mobile Safari');
      expect(result.os).toBe('iOS');
      expect(result.deviceType).toBe('mobile');
    });

    it('should return empty object for undefined user agent', () => {
      // Act
      const result = service.parseUserAgent(undefined);

      // Assert
      expect(result).toEqual({});
    });
  });

  describe('detectIpVersion', () => {
    it('should detect IPv4 address', () => {
      // Act
      const result = service.detectIpVersion('192.168.1.1');

      // Assert
      expect(result).toBe('IPv4');
    });

    it('should detect IPv6 address', () => {
      // Act
      const result = service.detectIpVersion('2001:0db8:85a3::8a2e:0370:7334');

      // Assert
      expect(result).toBe('IPv6');
    });
  });

  describe('detectProxyVpn', () => {
    it('should detect Tor exit node', async () => {
      // Arrange
      const torIp = '192.42.116.123';

      // Act
      const result = await service.detectProxyVpn(torIp);

      // Assert
      expect(result.isTor).toBe(true);
      expect(result.isVpn).toBe(false);
      expect(result.isProxy).toBe(false);
    });

    it('should return false for normal IP address', async () => {
      // Arrange
      const normalIp = '203.0.113.195';

      // Act
      const result = await service.detectProxyVpn(normalIp);

      // Assert
      expect(result.isTor).toBe(false);
      expect(result.isVpn).toBe(false);
      expect(result.isProxy).toBe(false);
    });
  });

  describe('recordLogin', () => {
    it('should record login successfully with all details', async () => {
      // Arrange
      const userId = 'user-123';
      const mockReq = {
        headers: {
          'x-forwarded-for': '203.0.113.195',
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        },
        socket: { remoteAddress: '10.0.0.1' },
      } as any as Request;

      mockPrismaService.userLoginHistory.create.mockResolvedValue({
        id: 'login-1',
        userId,
      });
      mockPrismaService.user.update.mockResolvedValue({
        id: userId,
        lastLoginAt: new Date(),
      });
      mockPrismaService.userLoginHistory.findMany.mockResolvedValue([
        { userId, ipAddress: '203.0.113.195' },
      ]);

      // Act
      await service.recordLogin(userId, mockReq, 'discord');

      // Assert
      expect(prisma.userLoginHistory.create).toHaveBeenCalledWith({
        data: {
          userId,
          ipAddress: '203.0.113.195',
          ipVersion: 'IPv4',
          userAgent: expect.any(String),
          browser: 'Chrome',
          os: 'Windows',
          deviceType: 'desktop',
          loginMethod: 'discord',
          isVpn: false,
          isProxy: false,
          isTor: false,
        },
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { lastLoginAt: expect.any(Date) },
      });
    });

    it('should handle missing user agent gracefully', async () => {
      // Arrange
      const userId = 'user-123';
      const mockReq = {
        headers: {
          'x-forwarded-for': '203.0.113.195',
        },
        socket: { remoteAddress: '10.0.0.1' },
      } as any as Request;

      mockPrismaService.userLoginHistory.create.mockResolvedValue({});
      mockPrismaService.user.update.mockResolvedValue({});
      mockPrismaService.userLoginHistory.findMany.mockResolvedValue([]);

      // Act
      await service.recordLogin(userId, mockReq);

      // Assert
      expect(prisma.userLoginHistory.create).toHaveBeenCalledWith({
        data: {
          userId,
          ipAddress: '203.0.113.195',
          ipVersion: 'IPv4',
          userAgent: null,
          browser: undefined,
          os: undefined,
          deviceType: undefined,
          loginMethod: 'discord',
          isVpn: false,
          isProxy: false,
          isTor: false,
        },
      });
    });

    it('should not throw error when login recording fails', async () => {
      // Arrange
      const userId = 'user-123';
      const mockReq = {
        headers: { 'x-forwarded-for': '203.0.113.195' },
        socket: { remoteAddress: '10.0.0.1' },
      } as any as Request;

      mockPrismaService.userLoginHistory.create.mockRejectedValue(
        new Error('Database error')
      );

      // Act & Assert
      await expect(service.recordLogin(userId, mockReq)).resolves.not.toThrow();
    });
  });

  describe('getAccountsFromIp', () => {
    it('should return accounts that logged in from specific IP', async () => {
      // Arrange
      const ipAddress = '203.0.113.195';
      const mockLogins = [
        {
          userId: 'user-1',
          loginAt: new Date('2025-01-20'),
          user: { username: 'player1' },
        },
        {
          userId: 'user-2',
          loginAt: new Date('2025-01-19'),
          user: { username: 'player2' },
        },
      ];

      mockPrismaService.userLoginHistory.findMany.mockResolvedValue(mockLogins);

      // Act
      const result = await service.getAccountsFromIp(ipAddress);

      // Assert
      expect(prisma.userLoginHistory.findMany).toHaveBeenCalledWith({
        where: {
          ipAddress,
          loginAt: { gte: expect.any(Date) },
        },
        select: {
          userId: true,
          loginAt: true,
          user: {
            select: {
              username: true,
            },
          },
        },
        distinct: ['userId'],
        orderBy: { loginAt: 'desc' },
      });

      expect(result).toEqual([
        {
          userId: 'user-1',
          username: 'player1',
          lastLogin: new Date('2025-01-20'),
        },
        {
          userId: 'user-2',
          username: 'player2',
          lastLogin: new Date('2025-01-19'),
        },
      ]);
    });

    it('should use custom daysBack parameter', async () => {
      // Arrange
      const ipAddress = '203.0.113.195';
      mockPrismaService.userLoginHistory.findMany.mockResolvedValue([]);

      // Act
      await service.getAccountsFromIp(ipAddress, 7);

      // Assert
      const callArgs = (prisma.userLoginHistory.findMany as jest.Mock).mock.calls[0][0];
      const sinceDate = callArgs.where.loginAt.gte;
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() - 7);

      // Check that the date is within 1 second of expected
      expect(Math.abs(sinceDate.getTime() - expectedDate.getTime())).toBeLessThan(1000);
    });
  });

  describe('getRecentLoginsForUser', () => {
    it('should return recent logins for user', async () => {
      // Arrange
      const userId = 'user-123';
      const mockLogins = [
        { ipAddress: '203.0.113.195', loginAt: new Date('2025-01-23T10:00:00Z') },
        { ipAddress: '198.51.100.42', loginAt: new Date('2025-01-23T08:00:00Z') },
      ];

      mockPrismaService.userLoginHistory.findMany.mockResolvedValue(mockLogins);

      // Act
      const result = await service.getRecentLoginsForUser(userId, 24);

      // Assert
      expect(prisma.userLoginHistory.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          loginAt: { gte: expect.any(Date) },
        },
        select: {
          ipAddress: true,
          loginAt: true,
        },
        orderBy: { loginAt: 'desc' },
      });

      expect(result).toEqual(mockLogins);
    });

    it('should use custom hoursBack parameter', async () => {
      // Arrange
      const userId = 'user-123';
      mockPrismaService.userLoginHistory.findMany.mockResolvedValue([]);

      // Act
      await service.getRecentLoginsForUser(userId, 48);

      // Assert
      const callArgs = (prisma.userLoginHistory.findMany as jest.Mock).mock.calls[0][0];
      const sinceDate = callArgs.where.loginAt.gte;
      const expectedDate = new Date();
      expectedDate.setHours(expectedDate.getHours() - 48);

      // Check that the date is within 1 second of expected
      expect(Math.abs(sinceDate.getTime() - expectedDate.getTime())).toBeLessThan(1000);
    });
  });

  describe('getUserLoginHistory', () => {
    it('should return login history for user', async () => {
      // Arrange
      const userId = 'user-123';
      const mockHistory = [
        {
          id: 'login-1',
          userId,
          ipAddress: '203.0.113.195',
          loginAt: new Date('2025-01-23'),
        },
        {
          id: 'login-2',
          userId,
          ipAddress: '198.51.100.42',
          loginAt: new Date('2025-01-22'),
        },
      ];

      mockPrismaService.userLoginHistory.findMany.mockResolvedValue(mockHistory);

      // Act
      const result = await service.getUserLoginHistory(userId, 50);

      // Assert
      expect(prisma.userLoginHistory.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { loginAt: 'desc' },
        take: 50,
      });

      expect(result).toEqual(mockHistory);
    });

    it('should use default limit of 50', async () => {
      // Arrange
      const userId = 'user-123';
      mockPrismaService.userLoginHistory.findMany.mockResolvedValue([]);

      // Act
      await service.getUserLoginHistory(userId);

      // Assert
      expect(prisma.userLoginHistory.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { loginAt: 'desc' },
        take: 50,
      });
    });
  });

  describe('findMultiAccountUsers', () => {
    it('should find IPs with multiple accounts', async () => {
      // Arrange
      const mockGroupBy = [{ ipAddress: '203.0.113.195' }];
      const mockAccounts = [
        {
          userId: 'user-1',
          loginAt: new Date('2025-01-23'),
          user: { username: 'player1', displayName: 'Player One' },
        },
        {
          userId: 'user-2',
          loginAt: new Date('2025-01-22'),
          user: { username: 'player2', displayName: 'Player Two' },
        },
      ];

      mockPrismaService.userLoginHistory.groupBy.mockResolvedValue(mockGroupBy);
      mockPrismaService.userLoginHistory.findMany.mockResolvedValue(mockAccounts);

      // Act
      const result = await service.findMultiAccountUsers(30);

      // Assert
      expect(prisma.userLoginHistory.groupBy).toHaveBeenCalledWith({
        by: ['ipAddress'],
        where: {
          loginAt: { gte: expect.any(Date) },
          isVpn: false,
          isProxy: false,
        },
        having: {
          userId: {
            _count: {
              gt: 1,
            },
          },
        },
      });

      expect(result).toEqual([
        {
          ipAddress: '203.0.113.195',
          accounts: [
            {
              userId: 'user-1',
              username: 'player1',
              displayName: 'Player One',
              lastLogin: new Date('2025-01-23'),
            },
            {
              userId: 'user-2',
              username: 'player2',
              displayName: 'Player Two',
              lastLogin: new Date('2025-01-22'),
            },
          ],
        },
      ]);
    });

    it('should return empty array when no multi-accounts found', async () => {
      // Arrange
      mockPrismaService.userLoginHistory.groupBy.mockResolvedValue([]);

      // Act
      const result = await service.findMultiAccountUsers();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('getIpStatistics', () => {
    it('should return IP statistics', async () => {
      // Arrange
      mockPrismaService.userLoginHistory.count
        .mockResolvedValueOnce(1000) // totalLogins
        .mockResolvedValueOnce(50)   // vpnLogins
        .mockResolvedValueOnce(30)   // proxyLogins
        .mockResolvedValueOnce(10);  // torLogins

      mockPrismaService.userLoginHistory.groupBy.mockResolvedValue(
        Array(250).fill({ ipAddress: 'dummy' })
      );

      // Act
      const result = await service.getIpStatistics();

      // Assert
      expect(result).toEqual({
        totalLogins: 1000,
        uniqueIps: 250,
        vpnLogins: 50,
        proxyLogins: 30,
        torLogins: 10,
        suspiciousLogins: 90,
      });

      expect(prisma.userLoginHistory.count).toHaveBeenCalledTimes(4);
      expect(prisma.userLoginHistory.groupBy).toHaveBeenCalledWith({
        by: ['ipAddress'],
      });
    });
  });
});
