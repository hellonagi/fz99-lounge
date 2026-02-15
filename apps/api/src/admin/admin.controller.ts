import { Controller, Get, Post, Patch, Param, Query, Body, Req, UseGuards, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { LoginTrackingService } from '../auth/login-tracking.service';
import { ClassicRatingService } from '../rating/classic-rating.service';
import { TeamClassicRatingService } from '../rating/team-classic-rating.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, EventCategory, ModeratorPermission } from '@prisma/client';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
export class AdminController {
  private readonly defaultAlertDays: number;

  constructor(
    private loginTrackingService: LoginTrackingService,
    private configService: ConfigService,
    private classicRatingService: ClassicRatingService,
    private teamClassicRatingService: TeamClassicRatingService,
    private prisma: PrismaService,
  ) {
    this.defaultAlertDays = this.configService.get<number>('SUSPICIOUS_LOGIN_ALERT_DAYS', 7);
  }

  /**
   * Get users with multiple accounts (same IP)
   */
  @Get('multi-accounts')
  @Permissions(ModeratorPermission.VIEW_MULTI_ACCOUNTS)
  async getMultiAccountUsers(
    @Query('days') days: string = '30',
  ) {
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
  @Permissions(ModeratorPermission.VIEW_LOGIN_HISTORY)
  async getUserLoginHistory(
    @Param('userId') userId: string,
    @Query('limit') limit: string = '50',
  ) {
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
  @Permissions(ModeratorPermission.VIEW_MULTI_ACCOUNTS)
  async getAccountsFromIp(
    @Param('ipAddress') ipAddress: string,
    @Query('days') days: string = '30',
  ) {
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
  @Permissions(ModeratorPermission.VIEW_MULTI_ACCOUNTS)
  async getIpStatistics() {
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
  @Permissions(ModeratorPermission.VIEW_MULTI_ACCOUNTS)
  async getSuspiciousActivity(
    @Query('days') days?: string,
  ) {
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
  @Permissions(ModeratorPermission.RECALCULATE_RATING)
  async calculateRating(
    @Param('gameId') gameId: string,
  ) {
    const gameIdNum = parseInt(gameId, 10);
    if (isNaN(gameIdNum)) {
      throw new BadRequestException('Invalid game ID');
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
  @Permissions(ModeratorPermission.RECALCULATE_RATING)
  async recalculateRatingsFromMatch(
    @Param('category') category: string,
    @Param('season') season: string,
    @Param('matchNumber') matchNumber: string,
  ) {

    // Validate category
    const categoryUpper = category.toUpperCase();
    if (categoryUpper !== 'CLASSIC' && categoryUpper !== 'TEAM_CLASSIC') {
      throw new BadRequestException('Only CLASSIC and TEAM_CLASSIC categories are supported');
    }
    const eventCategory = categoryUpper as EventCategory;

    // Validate season number
    const seasonNumber = parseInt(season, 10);
    if (isNaN(seasonNumber) || seasonNumber < 0) {
      throw new BadRequestException('Invalid season number');
    }

    // Validate match number
    const fromMatchNumber = parseInt(matchNumber, 10);
    if (isNaN(fromMatchNumber) || fromMatchNumber < 1) {
      throw new BadRequestException('Invalid match number');
    }

    const result = eventCategory === EventCategory.TEAM_CLASSIC
      ? await this.teamClassicRatingService.recalculateFromMatch(seasonNumber, fromMatchNumber)
      : await this.classicRatingService.recalculateFromMatch(eventCategory, seasonNumber, fromMatchNumber);

    return {
      success: true,
      message: `Rating recalculation completed from match ${fromMatchNumber}`,
      ...result,
    };
  }

  /**
   * List all users with pagination and search
   */
  @Get('users')
  @Roles(UserRole.ADMIN)
  async getUsers(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where = search
      ? {
          OR: [
            { username: { contains: search, mode: 'insensitive' as const } },
            { displayName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarHash: true,
          discordId: true,
          role: true,
          lastLoginAt: true,
          createdAt: true,
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limitNum);
    return {
      data: users,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    };
  }

  /**
   * Update user role (PLAYER <-> MODERATOR only)
   */
  @Patch('users/:userId/role')
  @Roles(UserRole.ADMIN)
  async updateUserRole(
    @Param('userId') userId: string,
    @Body('role') role: string,
    @Req() req: Request,
  ) {
    const userIdNum = parseInt(userId, 10);
    if (isNaN(userIdNum)) {
      throw new BadRequestException('Invalid user ID');
    }

    if (role !== 'PLAYER' && role !== 'MODERATOR') {
      throw new BadRequestException('Role must be PLAYER or MODERATOR');
    }

    const currentUser = req.user as any;
    if (currentUser.id === userIdNum) {
      throw new ForbiddenException('Cannot change your own role');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: userIdNum },
      select: { id: true, role: true },
    });

    if (!targetUser) {
      throw new BadRequestException('User not found');
    }

    if (targetUser.role === UserRole.ADMIN) {
      throw new ForbiddenException('Cannot change ADMIN role');
    }

    // Update role and clean up permissions if demoting
    if (role === 'PLAYER' && targetUser.role === UserRole.MODERATOR) {
      await this.prisma.$transaction([
        this.prisma.userPermission.deleteMany({ where: { userId: userIdNum } }),
        this.prisma.user.update({
          where: { id: userIdNum },
          data: { role: UserRole.PLAYER },
        }),
      ]);
    } else {
      await this.prisma.user.update({
        where: { id: userIdNum },
        data: { role: role as UserRole },
      });
    }

    return { success: true };
  }
}