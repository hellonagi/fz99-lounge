import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toHalfWidth, validateDisplayName } from '../common/utils/string.util';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        profileId: true,
        discordId: true,
        username: true,
        displayName: true,
        avatarHash: true,
        role: true,
        status: true,
        youtubeUrl: true,
        twitchUrl: true,
        createdAt: true,
        lastLoginAt: true,
        statsGP: {
          select: {
            mmr: true,
            seasonHighMmr: true,
            totalMatches: true,
            totalWins: true,
            top3Finishes: true,
            top10Finishes: true,
            averagePosition: true,
            totalKos: true,
            bestPosition: true,
            currentStreak: true,
            favoriteMachine: true,
          },
        },
        statsClassic: {
          select: {
            mmr: true,
            seasonHighMmr: true,
            totalMatches: true,
            totalWins: true,
            top3Finishes: true,
            averagePosition: true,
            bestPosition: true,
            currentStreak: true,
            favoriteMachine: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findByDiscordId(discordId: string) {
    const user = await this.prisma.user.findUnique({
      where: { discordId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findByProfileId(profileId: number) {
    const user = await this.prisma.user.findUnique({
      where: { profileId },
      select: {
        id: true,
        profileId: true,
        discordId: true,
        username: true,
        displayName: true,
        avatarHash: true,
        role: true,
        status: true,
        youtubeUrl: true,
        twitchUrl: true,
        createdAt: true,
        lastLoginAt: true,
        statsGP: {
          select: {
            mmr: true,
            seasonHighMmr: true,
            totalMatches: true,
            totalWins: true,
            top3Finishes: true,
            top10Finishes: true,
            averagePosition: true,
            totalKos: true,
            bestPosition: true,
            currentStreak: true,
            favoriteMachine: true,
          },
        },
        statsClassic: {
          select: {
            mmr: true,
            seasonHighMmr: true,
            totalMatches: true,
            totalWins: true,
            top3Finishes: true,
            averagePosition: true,
            bestPosition: true,
            currentStreak: true,
            favoriteMachine: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateDisplayName(userId: string, displayName: string) {
    // 全角→半角変換
    const normalized = toHalfWidth(displayName);

    // バリデーション
    const validation = validateDisplayName(normalized);
    if (!validation.valid) {
      throw new BadRequestException(validation.error);
    }

    // ユーザー取得
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, displayNameLastChangedAt: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 60日制限チェック
    if (user.displayNameLastChangedAt) {
      const daysSinceLastChange = Math.floor(
        (Date.now() - user.displayNameLastChangedAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceLastChange < 60) {
        const daysRemaining = 60 - daysSinceLastChange;
        throw new BadRequestException(
          `Display name can only be changed once every 60 days. ${daysRemaining} days remaining.`
        );
      }
    }

    // 更新
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName: normalized,
        displayNameLastChangedAt: new Date(),
      },
      select: {
        id: true,
        profileId: true,
        discordId: true,
        username: true,
        displayName: true,
        avatarHash: true,
        role: true,
      },
    });
  }

  async updateProfile(userId: string, data: { youtubeUrl?: string; twitchUrl?: string }) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.youtubeUrl !== undefined && { youtubeUrl: data.youtubeUrl || null }),
        ...(data.twitchUrl !== undefined && { twitchUrl: data.twitchUrl || null }),
      },
      select: {
        id: true,
        profileId: true,
        discordId: true,
        username: true,
        displayName: true,
        avatarHash: true,
        role: true,
        youtubeUrl: true,
        twitchUrl: true,
      },
    });
  }

  async getLeaderboard(gameMode: 'GP' | 'CLASSIC', limit = 100) {
    if (gameMode === 'GP') {
      return this.prisma.userStatsGP.findMany({
        take: limit,
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
    } else {
      return this.prisma.userStatsClassic.findMany({
        take: limit,
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
    }
  }
}
