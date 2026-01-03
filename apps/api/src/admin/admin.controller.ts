import { Controller, Get, Post, Param, Query, UseGuards, ForbiddenException, Req, BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LoginTrackingService } from '../auth/login-tracking.service';
import { ClassicRatingService } from '../rating/classic-rating.service';
import { UserRole, EventCategory } from '@prisma/client';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  private readonly defaultAlertDays: number;

  constructor(
    private loginTrackingService: LoginTrackingService,
    private configService: ConfigService,
    private classicRatingService: ClassicRatingService,
  ) {
    this.defaultAlertDays = this.configService.get<number>('SUSPICIOUS_LOGIN_ALERT_DAYS', 7);
  }

  /**
   * Check if user has admin or moderator role
   */
  private checkAdminAccess(req: Request) {
    const user = req.user as any;
    if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.MODERATOR)) {
      throw new ForbiddenException('Admin access required');
    }
    return user;
  }

  /**
   * Get users with multiple accounts (same IP)
   */
  @Get('multi-accounts')
  async getMultiAccountUsers(
    @Req() req: Request,
    @Query('days') days: string = '30',
  ) {
    this.checkAdminAccess(req);

    const daysBack = parseInt(days, 10) || 30;
    const multiAccountUsers = await this.loginTrackingService.findMultiAccountUsers(daysBack);

    return {
      totalSuspiciousIps: multiAccountUsers.length,
      totalAccountsInvolved: multiAccountUsers.reduce((sum, ip) => sum + ip.accounts.length, 0),
      data: multiAccountUsers,
    };
  }

  /**
   * Get login history for a specific user
   */
  @Get('users/:userId/login-history')
  async getUserLoginHistory(
    @Req() req: Request,
    @Param('userId') userId: string,
    @Query('limit') limit: string = '50',
  ) {
    this.checkAdminAccess(req);

    const limitNum = parseInt(limit, 10) || 50;
    const history = await this.loginTrackingService.getUserLoginHistory(parseInt(userId, 10), limitNum);

    return {
      userId,
      totalLogins: history.length,
      loginHistory: history,
    };
  }

  /**
   * Get all accounts that have logged in from a specific IP
   */
  @Get('ip/:ipAddress/accounts')
  async getAccountsFromIp(
    @Req() req: Request,
    @Param('ipAddress') ipAddress: string,
    @Query('days') days: string = '30',
  ) {
    this.checkAdminAccess(req);

    const daysBack = parseInt(days, 10) || 30;
    const accounts = await this.loginTrackingService.getAccountsFromIp(ipAddress, daysBack);

    return {
      ipAddress,
      totalAccounts: accounts.length,
      accounts,
    };
  }

  /**
   * Get IP tracking statistics
   */
  @Get('statistics/ip-tracking')
  async getIpStatistics(@Req() req: Request) {
    this.checkAdminAccess(req);

    const stats = await this.loginTrackingService.getIpStatistics();

    return {
      ...stats,
      suspiciousPercentage: stats.totalLogins > 0
        ? ((stats.suspiciousLogins / stats.totalLogins) * 100).toFixed(2) + '%'
        : '0%',
    };
  }

  /**
   * Get recent suspicious login activity
   */
  @Get('suspicious-activity')
  async getSuspiciousActivity(
    @Req() req: Request,
    @Query('days') days?: string,
  ) {
    this.checkAdminAccess(req);

    const daysBack = days ? parseInt(days, 10) : this.defaultAlertDays;

    // Get multi-account users
    const multiAccountUsers = await this.loginTrackingService.findMultiAccountUsers(daysBack);

    // Filter for highly suspicious cases (3+ accounts from same IP)
    const highlySuspicious = multiAccountUsers.filter(ip => ip.accounts.length >= 3);
    const moderatelySuspicious = multiAccountUsers.filter(ip => ip.accounts.length === 2);

    return {
      timeframe: `Last ${daysBack} days`,
      summary: {
        highlySuspicious: highlySuspicious.length,
        moderatelySuspicious: moderatelySuspicious.length,
        totalSuspiciousIps: multiAccountUsers.length,
      },
      highlySuspicious,
      moderatelySuspicious: moderatelySuspicious.slice(0, 10), // Limit to first 10
    };
  }

  /**
   * Trigger rating calculation for a specific game
   */
  @Post('games/:gameId/calculate-rating')
  async calculateRating(
    @Req() req: Request,
    @Param('gameId') gameId: string,
  ) {
    this.checkAdminAccess(req);

    const gameIdNum = parseInt(gameId, 10);
    if (isNaN(gameIdNum)) {
      throw new ForbiddenException('Invalid game ID');
    }

    await this.classicRatingService.calculateAndUpdateRatings(gameIdNum);

    return {
      success: true,
      message: `Rating calculation completed for game ${gameIdNum}`,
    };
  }

  /**
   * Recalculate ratings from a specific match number
   * POST /admin/rating/recalculate/:category/:season/from/:matchNumber
   * Example: POST /admin/rating/recalculate/classic/1/from/5
   */
  @Post('rating/recalculate/:category/:season/from/:matchNumber')
  async recalculateRatingsFromMatch(
    @Req() req: Request,
    @Param('category') category: string,
    @Param('season') season: string,
    @Param('matchNumber') matchNumber: string,
  ) {
    this.checkAdminAccess(req);

    // Validate category
    const categoryUpper = category.toUpperCase();
    if (categoryUpper !== 'CLASSIC') {
      throw new BadRequestException('Only CLASSIC category is supported for now');
    }
    const eventCategory = categoryUpper as EventCategory;

    // Validate season number
    const seasonNumber = parseInt(season, 10);
    if (isNaN(seasonNumber) || seasonNumber < 1) {
      throw new BadRequestException('Invalid season number');
    }

    // Validate match number
    const fromMatchNumber = parseInt(matchNumber, 10);
    if (isNaN(fromMatchNumber) || fromMatchNumber < 1) {
      throw new BadRequestException('Invalid match number');
    }

    const result = await this.classicRatingService.recalculateFromMatch(
      eventCategory,
      seasonNumber,
      fromMatchNumber,
    );

    return {
      success: true,
      message: `Rating recalculation completed from match ${fromMatchNumber}`,
      ...result,
    };
  }
}