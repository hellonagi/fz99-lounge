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
        // プロフィール情報
        profile: {
          select: {
            country: true,
          },
        },
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

    // Flatten profile.country to country
    const { profile, ...rest } = user;
    return {
      ...rest,
      country: profile?.country || null,
    };
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

  async updateStreamUrls(userId: number, data: { youtubeUrl?: string; twitchUrl?: string }) {
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

  async updateProfile(userId: number, data: { displayName?: string; country?: string }) {
    // ユーザー取得
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true, displayNameLastChangedAt: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // displayName更新処理
    let displayNameToUpdate: string | undefined;
    if (data.displayName) {
      // 全角→半角変換
      const normalized = toHalfWidth(data.displayName);

      // バリデーション
      const validation = validateDisplayName(normalized);
      if (!validation.valid) {
        throw new BadRequestException(validation.error);
      }

      // 60日制限チェック（初回設定時はスキップ）
      if (user.displayName && user.displayNameLastChangedAt) {
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

      displayNameToUpdate = normalized;
    }

    // トランザクションでUserとProfileを更新
    const result = await this.prisma.$transaction(async (tx) => {
      // User更新
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          ...(displayNameToUpdate && {
            displayName: displayNameToUpdate,
            displayNameLastChangedAt: new Date(),
          }),
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

      // Profile更新（countryがある場合）
      let country: string | null = null;
      if (data.country) {
        const profile = await tx.profile.upsert({
          where: { userId },
          create: {
            userId,
            country: data.country.toUpperCase(),
          },
          update: {
            country: data.country.toUpperCase(),
          },
          select: { country: true },
        });
        country = profile.country;
      } else {
        // 既存のプロフィールからcountryを取得
        const existingProfile = await tx.profile.findUnique({
          where: { userId },
          select: { country: true },
        });
        country = existingProfile?.country || null;
      }

      return { ...updatedUser, country };
    });

    return result;
  }

  /**
   * Get suggested country from latest login history (IP geolocation)
   */
  async getSuggestedCountry(userId: number): Promise<{ country: string | null }> {
    // Find the most recent login with country data
    const latestLogin = await this.prisma.userLoginHistory.findFirst({
      where: {
        userId,
        country: { not: null },
      },
      orderBy: { loginAt: 'desc' },
      select: { country: true },
    });

    return { country: latestLogin?.country || null };
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
