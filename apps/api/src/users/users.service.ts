import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toHalfWidth, validateDisplayName } from '../common/utils/string.util';
import { EventCategory, MatchStatus, Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get seasons that a user has participated in (with at least 1 match)
   */
  async getUserSeasons(userId: number, category?: 'GP' | 'CLASSIC' | 'TEAM_CLASSIC' | 'TEAM_GP') {
    return this.prisma.season.findMany({
      where: {
        userSeasonStats: { some: { userId, totalMatches: { gte: 1 } } },
        ...(category && { event: { category: category as EventCategory } }),
      },
      include: { event: { select: { category: true } } },
      orderBy: { seasonNumber: 'desc' },
    });
  }

  async findById(id: number, seasonNumber?: number, category?: 'GP' | 'CLASSIC' | 'TEAM_CLASSIC' | 'TEAM_GP') {
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
        // 権限情報（MODERATOR用）
        permissions: {
          select: { permission: true },
        },
        // シーズン別統計を取得（seasonNumberが指定されればそのシーズン、なければアクティブシーズン）
        seasonStats: {
          where: seasonNumber !== undefined
            ? {
                season: {
                  seasonNumber,
                  ...(category && { event: { category: category as EventCategory } }),
                },
              }
            : {
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
            mvpCount: true,
            bestPosition: true,
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

    // Calculate leaderboard rank for each season
    const seasonStatsWithRank = await Promise.all(
      user.seasonStats.map(async (stats) => {
        const eventCategory = stats.season.event.category;
        const isGpMode = eventCategory === 'GP' || eventCategory === 'TEAM_GP';

        let rank: number;
        if (eventCategory === 'TEAM_GP') {
          // TEAM_GP: rank by wins (firstPlaces) desc, then MVP desc
          rank = await this.prisma.userSeasonStats.count({
            where: {
              seasonId: stats.seasonId,
              totalMatches: { gte: 1 },
              OR: [
                { firstPlaces: { gt: stats.firstPlaces } },
                {
                  firstPlaces: stats.firstPlaces,
                  mvpCount: { gt: stats.mvpCount },
                },
              ],
            },
          });
        } else if (eventCategory === 'GP') {
          // GP: rank by bestPosition (lower is better), nulls last
          rank = await this.prisma.userSeasonStats.count({
            where: {
              seasonId: stats.seasonId,
              totalMatches: { gte: 1 },
              bestPosition: stats.bestPosition != null
                ? { lt: stats.bestPosition }
                : undefined,
            },
          });
        } else {
          // CLASSIC/TEAM_CLASSIC: rank by displayRating (higher is better)
          rank = await this.prisma.userSeasonStats.count({
            where: {
              seasonId: stats.seasonId,
              displayRating: { gt: stats.displayRating },
            },
          });
        }
        return {
          ...stats,
          leaderboardRank: rank + 1,
        };
      })
    );

    // Flatten profile.country to country, flatten permissions
    const { profile, seasonStats, permissions, ...rest } = user;
    return {
      ...rest,
      country: profile?.country || null,
      permissions: permissions?.map((p) => p.permission) || [],
      seasonStats: seasonStatsWithRank,
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
   * ユーザーの試合履歴を取得
   */
  async getUserMatchHistory(
    userId: number,
    limit = 20,
    offset = 0,
    category?: 'GP' | 'CLASSIC' | 'TEAM_CLASSIC' | 'TEAM_GP',
    seasonNumber?: number,
  ) {
    // ユーザーが参加したゲームを取得（FINALIZEDのみ）
    const gameParticipants = await this.prisma.gameParticipant.findMany({
      where: {
        userId,
        game: {
          match: {
            status: MatchStatus.FINALIZED,
            ...(category && {
              season: {
                event: { category: category as EventCategory },
                ...(seasonNumber !== undefined && { seasonNumber }),
              },
            }),
            ...(seasonNumber !== undefined && !category && {
              season: { seasonNumber },
            }),
          },
        },
      },
      orderBy: { game: { match: { scheduledStart: 'desc' } } },
      skip: offset,
      take: limit,
      select: {
        totalScore: true,
        teamIndex: true,
        game: {
          select: {
            id: true,
            gameNumber: true,
            teamScores: true,
            match: {
              select: {
                id: true,
                matchNumber: true,
                status: true,
                scheduledStart: true,
                season: {
                  select: {
                    seasonNumber: true,
                    event: {
                      select: {
                        category: true,
                      },
                    },
                  },
                },
              },
            },
            // 順位を計算するために全参加者のスコアを取得 (提出済み = PENDING, VERIFIED, REJECTED)
            participants: {
              where: { status: { not: 'UNSUBMITTED' } },
              select: {
                userId: true,
                totalScore: true,
              },
              orderBy: { totalScore: 'desc' },
            },
          },
        },
      },
    });

    // レーティング履歴を取得（試合IDごと）
    const matchIds = [...new Set(gameParticipants.map((gp) => gp.game.match.id))];
    const ratingHistories = await this.prisma.ratingHistory.findMany({
      where: {
        userId,
        matchId: { in: matchIds },
      },
      select: {
        matchId: true,
        displayRating: true,
      },
    });

    // matchIdごとのレーティングをマップ化
    const ratingByMatchId = new Map<number, number>();
    for (const rh of ratingHistories) {
      ratingByMatchId.set(rh.matchId, rh.displayRating);
    }

    // 前回のレーティングを取得するため、シーズン別に全履歴を時系列順にソートして取得
    // ページネーションに関係なく、シーズン内の全マッチからレーティング履歴を取得
    // シーズンごとにレーティングはリセットされるため、同一シーズン内の履歴のみ使用
    const seasonIds = [...new Set(gameParticipants.map((gp) => gp.game.match.season.seasonNumber))];
    const allRatingHistory = await this.prisma.ratingHistory.findMany({
      where: {
        userId,
        match: {
          status: MatchStatus.FINALIZED,
          season: {
            seasonNumber: { in: seasonIds },
            ...(category && { event: { category: category as EventCategory } }),
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        matchId: true,
        displayRating: true,
        match: { select: { season: { select: { seasonNumber: true } } } },
      },
    });

    // シーズンごとにmatchIdの前回レーティングをマップ化
    const prevRatingByMatchId = new Map<number, number>();
    const seasonPrevRating = new Map<number, number>();
    for (const rh of allRatingHistory) {
      const sn = rh.match.season.seasonNumber;
      const prevRating = seasonPrevRating.get(sn) || 0;
      prevRatingByMatchId.set(rh.matchId, prevRating);
      seasonPrevRating.set(sn, rh.displayRating);
    }

    // 結果を整形
    return gameParticipants.map((gp) => {
      const match = gp.game.match;
      const participants = gp.game.participants;
      const gameCategory = match.season.event.category;

      let position: number;
      let totalParticipants: number;

      // TEAM_CLASSIC: compute team rank from teamScores
      if ((gameCategory === 'TEAM_CLASSIC' || gameCategory === 'TEAM_GP') && gp.teamIndex !== null && gp.game.teamScores) {
        const teamScores = gp.game.teamScores as { teamIndex: number; totalScore: number }[];
        const sorted = [...teamScores].sort((a, b) => b.totalScore - a.totalScore);
        position = sorted.findIndex((t) => t.teamIndex === gp.teamIndex) + 1 || teamScores.length;
        totalParticipants = teamScores.length;
      } else {
        // Individual: existing sort logic
        const sortedParticipants = [...participants].sort(
          (a, b) => (b.totalScore || 0) - (a.totalScore || 0),
        );
        position =
          sortedParticipants.findIndex((p) => p.userId === userId) + 1 || participants.length;
        totalParticipants = participants.length;
      }

      const ratingAfter = ratingByMatchId.get(match.id) || 0;
      const ratingBefore = prevRatingByMatchId.get(match.id) || 0;

      return {
        matchId: match.id,
        matchNumber: match.matchNumber,
        category: gameCategory,
        seasonNumber: match.season.seasonNumber,
        completedAt: match.scheduledStart,
        position,
        totalParticipants,
        totalScore: gp.totalScore,
        ratingBefore,
        ratingAfter,
        ratingChange: ratingAfter - ratingBefore,
      };
    });
  }

  /**
   * ユーザーのレーティング履歴を取得
   */
  async getUserRatingHistory(userId: number, category?: 'GP' | 'CLASSIC' | 'TEAM_CLASSIC' | 'TEAM_GP', seasonNumber?: number) {
    // シーズンを特定（seasonNumber指定があればそのシーズン、なければアクティブシーズン）
    let targetSeason: { id: number } | null = null;

    if (seasonNumber !== undefined) {
      targetSeason = await this.prisma.season.findFirst({
        where: {
          seasonNumber,
          ...(category && { event: { category: category as EventCategory } }),
        },
        select: { id: true },
      });
    } else {
      targetSeason = await this.prisma.season.findFirst({
        where: {
          isActive: true,
          ...(category && { event: { category: category as EventCategory } }),
        },
        select: { id: true },
      });
    }

    if (!targetSeason?.id) {
      return [];
    }

    // 該当シーズンのマッチIDを取得（FINALIZEDのみ）
    const seasonMatches = await this.prisma.match.findMany({
      where: { seasonId: targetSeason.id, status: MatchStatus.FINALIZED },
      select: { id: true },
    });
    const matchIds = seasonMatches.map((m) => m.id);

    // レーティング履歴を取得
    const ratingHistories = await this.prisma.ratingHistory.findMany({
      where: {
        userId,
        matchId: { in: matchIds },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        matchId: true,
        displayRating: true,
        internalRating: true,
        createdAt: true,
        match: {
          select: {
            matchNumber: true,
          },
        },
      },
    });

    // GP/TEAM_GP: also fetch position data for each match
    const isGpMode = category === 'GP' || category === 'TEAM_GP';
    let positionByMatchId = new Map<number, { position: number; totalParticipants: number }>();

    if (isGpMode && ratingHistories.length > 0) {
      const rhMatchIds = ratingHistories.map((rh) => rh.matchId);
      const gameParticipants = await this.prisma.gameParticipant.findMany({
        where: {
          userId,
          game: { match: { id: { in: rhMatchIds } } },
        },
        select: {
          teamIndex: true,
          game: {
            select: {
              teamScores: true,
              match: { select: { id: true } },
              participants: {
                where: { status: { not: 'UNSUBMITTED' } },
                select: { userId: true, totalScore: true },
                orderBy: { totalScore: 'desc' },
              },
            },
          },
        },
      });

      for (const gp of gameParticipants) {
        const matchId = gp.game.match.id;
        let position: number;
        let totalParticipants: number;

        if (category === 'TEAM_GP' && gp.teamIndex !== null && gp.game.teamScores) {
          const teamScores = gp.game.teamScores as { teamIndex: number; totalScore: number }[];
          const sorted = [...teamScores].sort((a, b) => b.totalScore - a.totalScore);
          position = sorted.findIndex((t) => t.teamIndex === gp.teamIndex) + 1 || teamScores.length;
          totalParticipants = teamScores.length;
        } else {
          const sorted = [...gp.game.participants].sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
          position = sorted.findIndex((p) => p.userId === userId) + 1 || gp.game.participants.length;
          totalParticipants = gp.game.participants.length;
        }

        positionByMatchId.set(matchId, { position, totalParticipants });
      }
    }

    return ratingHistories.map((rh) => {
      const positionData = positionByMatchId.get(rh.matchId);
      return {
        matchId: rh.matchId,
        matchNumber: rh.match.matchNumber,
        displayRating: rh.displayRating,
        internalRating: rh.internalRating,
        createdAt: rh.createdAt,
        ...(isGpMode && positionData && {
          position: positionData.position,
          totalParticipants: positionData.totalParticipants,
        }),
      };
    });
  }

  /**
   * リーダーボード取得
   * GP/CLASSIC両方ともUserSeasonStatsから取得
   */
  async getLeaderboard(
    eventCategory: 'GP' | 'CLASSIC' | 'TEAM_CLASSIC' | 'TEAM_GP',
    seasonNumber?: number,
    page = 1,
    limit = 20,
  ) {
    // シーズンを特定
    let targetSeasonId: number | undefined;
    let targetSeasonNumber: number | undefined;

    if (seasonNumber !== undefined) {
      // シーズン番号が指定された場合はそのシーズンを使用
      const season = await this.prisma.season.findFirst({
        where: {
          seasonNumber,
          event: { category: eventCategory as EventCategory },
        },
        select: { id: true, seasonNumber: true },
      });
      targetSeasonId = season?.id;
      targetSeasonNumber = season?.seasonNumber;
    } else {
      // アクティブシーズンを取得
      const activeSeason = await this.prisma.season.findFirst({
        where: {
          isActive: true,
          event: { category: eventCategory as EventCategory },
        },
        select: { id: true, seasonNumber: true, eventId: true },
      });

      if (activeSeason) {
        // アクティブシーズンにデータがあるかチェック
        const count = await this.prisma.userSeasonStats.count({
          where: { seasonId: activeSeason.id, totalMatches: { gte: 1 } },
        });

        if (count === 0) {
          // データがない → 前のシーズンを探す
          const previousSeason = await this.prisma.season.findFirst({
            where: {
              eventId: activeSeason.eventId,
              seasonNumber: activeSeason.seasonNumber - 1,
            },
            select: { id: true, seasonNumber: true },
          });
          if (previousSeason) {
            targetSeasonId = previousSeason.id;
            targetSeasonNumber = previousSeason.seasonNumber;
          } else {
            // 前シーズンがなければアクティブのまま（空でも表示）
            targetSeasonId = activeSeason.id;
            targetSeasonNumber = activeSeason.seasonNumber;
          }
        } else {
          targetSeasonId = activeSeason.id;
          targetSeasonNumber = activeSeason.seasonNumber;
        }
      }
    }

    if (!targetSeasonId) {
      return {
        data: [],
        meta: { total: 0, page, limit, totalPages: 0, hasNext: false, hasPrev: false },
      };
    }

    const skip = (page - 1) * limit;
    const where = {
      seasonId: targetSeasonId,
      totalMatches: { gte: 1 },
    };

    // GP: sort by bestPosition asc, then 1st/2nd/3rd desc
    // TEAM_GP: sort by wins (firstPlaces) desc, then MVP desc
    // CLASSIC/TEAM_CLASSIC: sort by displayRating desc
    let orderBy;
    if (eventCategory === 'TEAM_GP') {
      orderBy = [
        { firstPlaces: 'desc' as const },
        { mvpCount: 'desc' as const },
      ];
    } else if (eventCategory === 'GP') {
      orderBy = [
        { bestPosition: { sort: 'asc' as const, nulls: 'last' as const } },
        { firstPlaces: 'desc' as const },
        { secondPlaces: 'desc' as const },
        { thirdPlaces: 'desc' as const },
      ];
    } else {
      orderBy = [{ displayRating: 'desc' as const }];
    }

    const [total, data] = await Promise.all([
      this.prisma.userSeasonStats.count({ where }),
      this.prisma.userSeasonStats.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              avatarHash: true,
              profile: {
                select: {
                  country: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        seasonNumber: targetSeasonNumber,
      },
    };
  }

  /**
   * ユーザーのトラック別成績を取得
   */
  async getUserTrackStats(userId: number, category?: 'GP' | 'CLASSIC' | 'TEAM_CLASSIC' | 'TEAM_GP') {
    // カテゴリに対応するアクティブシーズンを取得
    const activeSeason = await this.prisma.season.findFirst({
      where: {
        isActive: true,
        ...(category && { event: { category: category as EventCategory } }),
      },
      select: { id: true },
    });

    if (!activeSeason?.id) {
      return [];
    }

    // ユーザーのレース結果を取得（FINALIZEDのみ）
    const raceResults = await this.prisma.raceResult.findMany({
      where: {
        gameParticipant: {
          userId,
          game: {
            match: {
              seasonId: activeSeason.id,
              status: MatchStatus.FINALIZED,
            },
          },
        },
      },
      select: {
        raceNumber: true,
        position: true,
        isEliminated: true,
        gameParticipant: {
          select: {
            game: {
              select: {
                tracks: true,
              },
            },
          },
        },
      },
    });

    // トラック別に集計
    const trackStats = new Map<number, {
      trackId: number;
      races: number;
      wins: number;
      podiums: number;
      totalPosition: number;
      eliminations: number;
    }>();

    for (const result of raceResults) {
      const tracks = result.gameParticipant.game.tracks as (number | null)[] | null;
      if (!tracks) continue;

      const trackId = tracks[result.raceNumber - 1];
      if (!trackId) continue;

      if (!trackStats.has(trackId)) {
        trackStats.set(trackId, {
          trackId,
          races: 0,
          wins: 0,
          podiums: 0,
          totalPosition: 0,
          eliminations: 0,
        });
      }

      const stats = trackStats.get(trackId)!;
      stats.races++;

      if (result.isEliminated) {
        stats.eliminations++;
      } else if (result.position) {
        stats.totalPosition += result.position;
        if (result.position === 1) stats.wins++;
        if (result.position <= 3) stats.podiums++;
      }
    }

    // 全トラック情報を取得（CLASSICはID 201-220、GP/TEAM_GPはID 1-120）
    const trackFilter = (category === 'CLASSIC' || category === 'TEAM_CLASSIC')
      ? { id: { gte: 201, lte: 220 } }
      : (category === 'GP' || category === 'TEAM_GP')
        ? { id: { gte: 1, lte: 120 } }
        : undefined;
    const allTracks = await this.prisma.track.findMany({
      where: trackFilter,
      select: {
        id: true,
        name: true,
        league: true,
        bannerPath: true,
      },
      orderBy: { id: 'asc' },
    });

    // 結果を整形（全トラックを含む）
    return allTracks.map((track) => {
      const stats = trackStats.get(track.id);
      const finishedRaces = stats ? stats.races - stats.eliminations : 0;
      return {
        trackId: track.id,
        trackName: track.name,
        league: track.league,
        bannerPath: track.bannerPath,
        races: stats?.races || 0,
        wins: stats?.wins || 0,
        podiums: stats?.podiums || 0,
        avgPosition: finishedRaces > 0 ? Math.round((stats!.totalPosition / finishedRaces) * 10) / 10 : null,
      };
    });
  }

  /**
   * 先週の注目プレイヤー3部門を取得
   * - 最多勝利（CLASSIC + TEAM_CLASSIC混合）
   * - 最多MVP（TEAM_CLASSICのチーム内最高スコア）
   * - 最高得点（CLASSIC + TEAM_CLASSIC混合、1試合での最高totalScore）
   */
  async getFeaturedWeeklyPlayers() {
    // 先週の日曜 00:00 UTC 〜 土曜 23:59:59.999 UTC を算出
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0=Sun, 1=Mon, ...
    const thisSunday = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - dayOfWeek,
      0, 0, 0, 0,
    ));
    const weekStart = new Date(thisSunday.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(Date.UTC(
      weekStart.getUTCFullYear(),
      weekStart.getUTCMonth(),
      weekStart.getUTCDate() + 6,
      23, 59, 59, 999,
    ));

    // 先週のFINALIZEDなCLASSIC + TEAM_CLASSICゲームを取得
    const games = await this.prisma.game.findMany({
      where: {
        match: {
          status: MatchStatus.FINALIZED,
          scheduledStart: { gte: weekStart, lte: weekEnd },
          season: {
            event: {
              category: { in: [EventCategory.CLASSIC, EventCategory.TEAM_CLASSIC, EventCategory.TEAM_GP] },
            },
          },
        },
      },
      select: {
        id: true,
        teamScores: true,
        match: {
          select: {
            season: { select: { event: { select: { category: true } } } },
          },
        },
        participants: {
          where: { status: { not: 'UNSUBMITTED' } },
          select: {
            userId: true,
            totalScore: true,
            teamIndex: true,
          },
        },
      },
    });

    // 集計用Map
    const userWins = new Map<number, number>();
    const userMvps = new Map<number, number>();
    const userHighScore = new Map<number, number>();

    for (const game of games) {
      const category = game.match.season.event.category;
      const isTeam = category === 'TEAM_CLASSIC' || category === 'TEAM_GP';

      // 最高得点（1試合での最高スコア）
      for (const p of game.participants) {
        const score = p.totalScore ?? 0;
        const current = userHighScore.get(p.userId) || 0;
        if (score > current) {
          userHighScore.set(p.userId, score);
        }
      }

      // 勝利判定
      if (isTeam && game.teamScores) {
        const scores = game.teamScores as { teamIndex: number; score: number; rank: number }[];
        const winningIndices = new Set(
          scores.filter((t) => t.rank === 1).map((t) => t.teamIndex),
        );
        for (const p of game.participants) {
          if (p.teamIndex !== null && winningIndices.has(p.teamIndex)) {
            userWins.set(p.userId, (userWins.get(p.userId) || 0) + 1);
          }
        }

        // MVP判定: チームごとにtotalScore最高のプレイヤー
        const teamGroups = new Map<number, { userId: number; totalScore: number }[]>();
        for (const p of game.participants) {
          if (p.teamIndex === null) continue;
          const group = teamGroups.get(p.teamIndex) || [];
          group.push({ userId: p.userId, totalScore: p.totalScore ?? 0 });
          teamGroups.set(p.teamIndex, group);
        }
        for (const [, members] of teamGroups) {
          const maxScore = Math.max(...members.map((m) => m.totalScore));
          if (maxScore > 0) {
            for (const m of members) {
              if (m.totalScore === maxScore) {
                userMvps.set(m.userId, (userMvps.get(m.userId) || 0) + 1);
              }
            }
          }
        }
      } else if (!isTeam) {
        // CLASSIC: totalScore最高が勝利
        const maxScore = Math.max(...game.participants.map((p) => p.totalScore || 0));
        if (maxScore > 0) {
          for (const p of game.participants) {
            if ((p.totalScore || 0) === maxScore) {
              userWins.set(p.userId, (userWins.get(p.userId) || 0) + 1);
            }
          }
        }
      }
    }

    // 各部門の1位を決定
    const mostWins = [...userWins.entries()]
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];

    const mostMvps = [...userMvps.entries()]
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];

    const topScorer = [...userHighScore.entries()]
      .filter(([, score]) => score > 0)
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];

    // 受賞者のuserIdを収集
    const awardUserIds = new Set<number>();
    if (mostWins) awardUserIds.add(mostWins[0]);
    if (mostMvps) awardUserIds.add(mostMvps[0]);
    if (topScorer) awardUserIds.add(topScorer[0]);

    if (awardUserIds.size === 0) {
      return { weekStart, weekEnd, awards: [] };
    }

    // ユーザー詳細を取得
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...awardUserIds] } },
      select: {
        id: true,
        discordId: true,
        displayName: true,
        avatarHash: true,
        profile: { select: { country: true } },
      },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const buildPlayer = (uid: number) => {
      const user = userMap.get(uid);
      return {
        userId: uid,
        discordId: user?.discordId || '',
        displayName: user?.displayName || '',
        avatarHash: user?.avatarHash || null,
        country: user?.profile?.country || null,
      };
    };

    const awards: {
      category: string;
      player: ReturnType<typeof buildPlayer>;
      value: number;
      detail?: string;
    }[] = [];

    if (mostWins) {
      awards.push({
        category: 'mostWins',
        player: buildPlayer(mostWins[0]),
        value: mostWins[1],
      });
    }
    if (topScorer) {
      awards.push({
        category: 'topScorer',
        player: buildPlayer(topScorer[0]),
        value: topScorer[1],
      });
    }
    if (mostMvps) {
      awards.push({
        category: 'mostMvps',
        player: buildPlayer(mostMvps[0]),
        value: mostMvps[1],
      });
    }

    return { weekStart, weekEnd, awards };
  }
}
