import { Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
const UAParser = require('ua-parser-js');

@Injectable()
export class LoginTrackingService {
  private readonly logger = new Logger(LoginTrackingService.name);
  private readonly multiAccountThreshold: number;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.multiAccountThreshold = this.configService.get<number>('MULTI_ACCOUNT_IP_THRESHOLD', 3);
  }

  /**
   * Extract client IP address from request
   * Handles proxy headers like X-Forwarded-For, X-Real-IP
   */
  extractIpAddress(req: Request): string {
    // Check for common proxy headers
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      // X-Forwarded-For can contain multiple IPs, take the first one
      const ips = typeof forwarded === 'string' ? forwarded.split(',') : forwarded;
      return (Array.isArray(ips) ? ips[0] : ips).trim();
    }

    // Check X-Real-IP header
    const realIp = req.headers['x-real-ip'];
    if (realIp) {
      return typeof realIp === 'string' ? realIp : realIp[0];
    }

    // Fallback to direct connection IP
    return req.socket.remoteAddress || req.ip || 'unknown';
  }

  /**
   * Parse user agent string to extract browser, OS, and device info
   */
  parseUserAgent(userAgent?: string): {
    browser?: string;
    os?: string;
    deviceType?: string;
  } {
    if (!userAgent) {
      return {};
    }

    const parser = new UAParser(userAgent);
    const result = parser.getResult();

    // Determine device type
    let deviceType: string | undefined;
    if (result.device.type) {
      deviceType = result.device.type;
    } else if (/mobile/i.test(userAgent)) {
      deviceType = 'mobile';
    } else if (/tablet/i.test(userAgent)) {
      deviceType = 'tablet';
    } else {
      deviceType = 'desktop';
    }

    return {
      browser: result.browser.name,
      os: result.os.name,
      deviceType,
    };
  }

  /**
   * Detect if IP is IPv4 or IPv6
   */
  detectIpVersion(ipAddress: string): string {
    if (ipAddress.includes(':')) {
      return 'IPv6';
    }
    return 'IPv4';
  }

  /**
   * Basic VPN/Proxy detection (can be enhanced with external services)
   */
  async detectProxyVpn(ipAddress: string): Promise<{
    isVpn: boolean;
    isProxy: boolean;
    isTor: boolean;
  }> {
    // Basic Tor exit node detection (checks for common Tor patterns)
    const isTor = this.checkForTorExitNode(ipAddress);

    // In production, you would integrate with services like:
    // - IPQualityScore
    // - ProxyCheck.io
    // - VPNBlocker
    // For now, return defaults

    return {
      isVpn: false,
      isProxy: false,
      isTor,
    };
  }

  /**
   * Basic Tor exit node detection
   */
  private checkForTorExitNode(ipAddress: string): boolean {
    // Common Tor exit node IP ranges (simplified)
    // In production, maintain an updated list from Tor Project
    const torPatterns = [
      /^192\.42\.116\./,
      /^199\.87\.154\./,
      /^198\.96\.155\./,
    ];

    return torPatterns.some(pattern => pattern.test(ipAddress));
  }

  /**
   * Record user login
   */
  async recordLogin(
    userId: number,
    req: Request,
    loginMethod: string = 'discord'
  ): Promise<void> {
    try {
      const ipAddress = this.extractIpAddress(req);
      const userAgent = req.headers['user-agent'];
      const { browser, os, deviceType } = this.parseUserAgent(userAgent);
      const ipVersion = this.detectIpVersion(ipAddress);
      const { isVpn, isProxy, isTor } = await this.detectProxyVpn(ipAddress);

      // Record login history
      await this.prisma.userLoginHistory.create({
        data: {
          userId,
          ipAddress,
          ipVersion,
          userAgent: userAgent || null,
          browser,
          os,
          deviceType,
          loginMethod,
          isVpn,
          isProxy,
          isTor,
        },
      });

      // Update user's last login timestamp
      await this.prisma.user.update({
        where: { id: userId },
        data: { lastLoginAt: new Date() },
      });

      this.logger.log(`Login recorded for user ${userId} from IP ${ipAddress}`);

      // Check for suspicious activity
      await this.checkSuspiciousActivity(userId, ipAddress);
    } catch (error) {
      this.logger.error(`Failed to record login for user ${userId}:`, error);
      // Don't throw - login tracking shouldn't break authentication
    }
  }

  /**
   * Check for suspicious login patterns
   */
  private async checkSuspiciousActivity(userId: number, ipAddress: string): Promise<void> {
    try {
      // Check if multiple accounts are using the same IP
      const accountsFromSameIp = await this.getAccountsFromIp(ipAddress);

      if (accountsFromSameIp.length >= this.multiAccountThreshold) {
        const otherAccounts = accountsFromSameIp.filter(acc => acc.userId !== userId);

        if (otherAccounts.length > 0) {
          this.logger.warn(
            `Multiple accounts detected from IP ${ipAddress}: ${accountsFromSameIp.length} accounts (threshold: ${this.multiAccountThreshold})`,
            {
              currentUser: userId,
              otherUsers: otherAccounts.map(acc => acc.userId),
            }
          );

          // In production, you might want to:
          // - Send notification to moderators
          // - Flag accounts for review
          // - Update trust scores
        }
      }

      // Check for rapid IP changes (potential account sharing)
      const recentLogins = await this.getRecentLoginsForUser(userId, 24); // Last 24 hours
      const uniqueIps = new Set(recentLogins.map(login => login.ipAddress));

      if (uniqueIps.size > 5) {
        this.logger.warn(
          `User ${userId} has logged in from ${uniqueIps.size} different IPs in the last 24 hours`
        );
      }
    } catch (error) {
      this.logger.error(`Failed to check suspicious activity:`, error);
    }
  }

  /**
   * Get all accounts that have logged in from a specific IP
   */
  async getAccountsFromIp(
    ipAddress: string,
    daysBack: number = 30
  ): Promise<Array<{ userId: number; username: string; lastLogin: Date }>> {
    const since = new Date();
    since.setDate(since.getDate() - daysBack);

    const logins = await this.prisma.userLoginHistory.findMany({
      where: {
        ipAddress,
        loginAt: { gte: since },
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

    return logins.map(login => ({
      userId: login.userId,
      username: login.user.username,
      lastLogin: login.loginAt,
    }));
  }

  /**
   * Get recent logins for a user
   */
  async getRecentLoginsForUser(
    userId: number,
    hoursBack: number = 24
  ): Promise<Array<{ ipAddress: string; loginAt: Date }>> {
    const since = new Date();
    since.setHours(since.getHours() - hoursBack);

    return this.prisma.userLoginHistory.findMany({
      where: {
        userId,
        loginAt: { gte: since },
      },
      select: {
        ipAddress: true,
        loginAt: true,
      },
      orderBy: { loginAt: 'desc' },
    });
  }

  /**
   * Get login history for a user
   */
  async getUserLoginHistory(
    userId: number,
    limit: number = 50
  ) {
    return this.prisma.userLoginHistory.findMany({
      where: { userId },
      orderBy: { loginAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Find users with multiple accounts (same IP)
   */
  async findMultiAccountUsers(daysBack: number = 30): Promise<Array<{
    ipAddress: string;
    accounts: Array<{
      userId: number;
      username: string;
      displayName: string | null;
      lastLogin: Date;
    }>;
  }>> {
    const since = new Date();
    since.setDate(since.getDate() - daysBack);

    // Get all IPs with multiple users
    const multiAccountIps = await this.prisma.userLoginHistory.groupBy({
      by: ['ipAddress'],
      where: {
        loginAt: { gte: since },
        // Exclude known VPNs/proxies if needed
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

    const results: Array<{
      ipAddress: string;
      accounts: Array<{
        userId: number;
        username: string;
        displayName: string | null;
        lastLogin: Date;
      }>;
    }> = [];

    for (const { ipAddress } of multiAccountIps) {
      const accounts = await this.prisma.userLoginHistory.findMany({
        where: {
          ipAddress,
          loginAt: { gte: since },
        },
        select: {
          userId: true,
          loginAt: true,
          user: {
            select: {
              username: true,
              displayName: true,
            },
          },
        },
        distinct: ['userId'],
        orderBy: { loginAt: 'desc' },
      });

      if (accounts.length > 1) {
        results.push({
          ipAddress,
          accounts: accounts.map(acc => ({
            userId: acc.userId,
            username: acc.user.username,
            displayName: acc.user.displayName,
            lastLogin: acc.loginAt,
          })),
        });
      }
    }

    return results;
  }

  /**
   * Get IP statistics for monitoring
   */
  async getIpStatistics() {
    const totalLogins = await this.prisma.userLoginHistory.count();
    const uniqueIps = await this.prisma.userLoginHistory.groupBy({
      by: ['ipAddress'],
    });
    const vpnLogins = await this.prisma.userLoginHistory.count({
      where: { isVpn: true },
    });
    const proxyLogins = await this.prisma.userLoginHistory.count({
      where: { isProxy: true },
    });
    const torLogins = await this.prisma.userLoginHistory.count({
      where: { isTor: true },
    });

    return {
      totalLogins,
      uniqueIps: uniqueIps.length,
      vpnLogins,
      proxyLogins,
      torLogins,
      suspiciousLogins: vpnLogins + proxyLogins + torLogins,
    };
  }
}