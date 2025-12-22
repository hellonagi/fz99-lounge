import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toHalfWidth, validateDisplayName } from '../common/utils/string.util';
import { EventCategory } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
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
        // シーズン別統計を取得（アクティブシーズンのみ）
        seasonStats: {
          where: {
            season: { isActive: true },
          },
          select: {
            seasonId: true,
            displayRating: true,
            seasonHighRating: true,
            totalMatches: true,
            firstPlaces: true,
            secondPlaces: true,
            thirdPlaces: true,
            survivedCount: true,
            assistUsedCount: true,
            season: {
              select: {
                seasonNumber: true,
                event: {
                  select: {
                    category: true,
                    name: true,
                  },
                },
              },
            },
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

  async updateDisplayName(userId: number, displayName: string) {
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
        discordId: true,
        username: true,
        displayName: true,
        avatarHash: true,
        role: true,
      },
    });
  }

  async updateProfile(userId: number, data: { youtubeUrl?: string; twitchUrl?: string }) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.youtubeUrl !== undefined && { youtubeUrl: data.youtubeUrl || null }),
        ...(data.twitchUrl !== undefined && { twitchUrl: data.twitchUrl || null }),
      },
      select: {
        id: true,
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

  /**
   * リーダーボード取得
   * GP/CLASSIC両方ともUserSeasonStatsから取得
   */
  async getLeaderboard(eventCategory: 'GP' | 'CLASSIC', seasonNumber?: number, limit = 100) {
    // シーズンを特定
    let targetSeasonId: number | undefined;

    if (seasonNumber !== undefined) {
      const season = await this.prisma.season.findFirst({
        where: {
          seasonNumber,
          event: { category: eventCategory as EventCategory },
        },
        select: { id: true },
      });
      targetSeasonId = season?.id;
    } else {
      // アクティブシーズンを取得
      const activeSeason = await this.prisma.season.findFirst({
        where: {
          isActive: true,
          event: { category: eventCategory as EventCategory },
        },
        select: { id: true },
      });
      targetSeasonId = activeSeason?.id;
    }

    if (!targetSeasonId) {
      return [];
    }

    return this.prisma.userSeasonStats.findMany({
      where: {
        seasonId: targetSeasonId,
      },
      take: limit,
      orderBy: { displayRating: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            avatarHash: true,
          },
        },
      },
    });
  }
}
