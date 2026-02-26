import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { DiscordBotService } from '../discord-bot/discord-bot.service';
import { TracksService } from '../tracks/tracks.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { EventCategory, InGameMode, MatchStatus, UserStatus } from '@prisma/client';

/** カテゴリごとのマッチ占有時間（分）。ここに定義されたカテゴリ同士でスパン重複チェックを行う */
export const CATEGORY_SPAN_MINUTES: Partial<Record<EventCategory, number>> = {
  GP: 30,
  CLASSIC: 15,
  TEAM_CLASSIC: 15,
  TEAM_GP: 30,
};

@Injectable()
export class MatchesService implements OnModuleInit, OnModuleDestroy {
  // 詳細なマッチ情報を取得するための共通includeオプション（基本形）
  private readonly matchDetailInclude = {
    season: {
      include: {
        event: true,
        tournamentConfig: true,
      },
    },
    participants: {
      include: {
        user: {
          select: {
            id: true,
            discordId: true,
            displayName: true,
            avatarHash: true,
          },
        },
      },
    },
    games: true,
  };

  // seasonStatsを含むincludeオプションを生成
  private getMatchDetailIncludeWithRating(seasonId: number) {
    return {
      season: {
        include: {
          event: true,
          tournamentConfig: true,
        },
      },
      participants: {
        include: {
          user: {
            select: {
              id: true,
              discordId: true,
              displayName: true,
              avatarHash: true,
              seasonStats: {
                where: {
                  seasonId,
                },
                select: {
                  displayRating: true,
                },
              },
            },
          },
        },
      },
      games: true,
    };
  }

  private readonly logger = new Logger(MatchesService.name);
  private overdueCheckInterval: NodeJS.Timeout | null = null;

  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
    @InjectQueue('matches') private matchQueue: Queue,
    private discordBotService: DiscordBotService,
    private tracksService: TracksService,
  ) {}

  async onModuleInit() {
    await this.cleanupGhostJobs();
    await this.recoverOverdueMatches();
    // 30秒ごとに期限切れWAITINGマッチをチェック
    this.overdueCheckInterval = setInterval(() => {
      this.recoverOverdueMatches().catch((err) => {
        this.logger.error('Periodic overdue match check failed:', err);
      });
    }, 30_000);
  }

  onModuleDestroy() {
    if (this.overdueCheckInterval) {
      clearInterval(this.overdueCheckInterval);
    }
  }

  /**
   * マッチに関連するBullMQジョブ（start-match, reminder）を削除する。
   * マッチ削除時に呼び出して、ゴーストジョブの蓄積を防ぐ。
   */
  async removeMatchJobs(matchId: number): Promise<void> {
    const jobIds = [`start-match-${matchId}`, `reminder-${matchId}`];
    for (const jobId of jobIds) {
      try {
        const job = await this.matchQueue.getJob(jobId);
        if (job) {
          await job.remove();
          this.logger.log(`Removed job ${jobId}`);
        }
      } catch (error) {
        this.logger.error(`Failed to remove job ${jobId}:`, error);
      }
    }
  }

  /**
   * 起動時にdelayedキュー内のゴーストジョブ（DBに存在しないマッチのジョブ）を削除する。
   */
  private async cleanupGhostJobs() {
    try {
      const delayedJobs = await this.matchQueue.getDelayed();
      let removed = 0;

      for (const job of delayedJobs) {
        const matchId = job.data?.matchId;
        if (!matchId) continue;

        const match = await this.prisma.match.findUnique({
          where: { id: matchId },
          select: { id: true, status: true },
        });

        // マッチが存在しない、またはWAITING以外（CANCELLED等）のジョブを削除
        if (!match || match.status !== MatchStatus.WAITING) {
          await job.remove();
          removed++;
        }
      }

      if (removed > 0) {
        this.logger.warn(`Cleaned up ${removed} ghost jobs from delayed queue`);
      }
    } catch (error) {
      this.logger.error('Failed to cleanup ghost jobs:', error);
    }
  }

  /**
   * API起動時に期限切れのWAITINGマッチを検出し、BullMQジョブを再登録する。
   * コンテナ再起動でジョブが失われた場合のリカバリ処理。
   */
  private async recoverOverdueMatches() {
    const overdueMatches = await this.prisma.match.findMany({
      where: {
        status: MatchStatus.WAITING,
        scheduledStart: {
          lte: new Date(),
        },
      },
      select: { id: true, scheduledStart: true },
    });

    if (overdueMatches.length === 0) return;

    this.logger.warn(`Found ${overdueMatches.length} overdue WAITING match(es), re-queuing start-match jobs`);

    for (const match of overdueMatches) {
      // 既にジョブが存在するか確認
      const existingJob = await this.matchQueue.getJob(`start-match-${match.id}`);
      if (existingJob) {
        this.logger.log(`Job already exists for match ${match.id}, skipping`);
        continue;
      }

      await this.matchQueue.add(
        'start-match',
        { matchId: match.id },
        {
          delay: 0, // 即時実行
          removeOnComplete: true,
          removeOnFail: { count: 10 },
          attempts: 3,
          jobId: `start-match-${match.id}`,
        },
      );
      this.logger.log(`Re-queued start-match job for overdue match ${match.id}`);
    }
  }

  async create(createMatchDto: CreateMatchDto, createdBy: number, options?: { silent?: boolean }) {
    const { seasonId, inGameMode, leagueType, scheduledStart, minPlayers, maxPlayers, notes, recurringMatchId } =
      createMatchDto;

    // Validate scheduledStart is at least 1 minute from now
    const scheduledDate = new Date(scheduledStart);
    const minTime = new Date(Date.now() + 60 * 1000);
    if (scheduledDate < minTime) {
      throw new BadRequestException('Start time must be at least 1 minute from now');
    }

    // Get season with event
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
      include: { event: true },
    });

    if (!season) {
      throw new BadRequestException(`Season ${seasonId} not found`);
    }

    if (!season.isActive) {
      throw new BadRequestException(`Season ${seasonId} is not active`);
    }

    // スパンベースの重複チェック
    const newSpan = CATEGORY_SPAN_MINUTES[season.event.category];
    if (newSpan) {
      const newStartMs = scheduledDate.getTime();
      const newEndMs = newStartMs + newSpan * 60 * 1000;
      const maxSpan = Math.max(...Object.values(CATEGORY_SPAN_MINUTES).filter((v): v is number => v != null));
      const windowStart = new Date(newStartMs - maxSpan * 60 * 1000 + 1);
      const windowEnd = new Date(newEndMs - 1);

      const candidates = await this.prisma.match.findMany({
        where: {
          status: { not: MatchStatus.CANCELLED },
          scheduledStart: { gte: windowStart, lte: windowEnd },
          season: {
            event: {
              category: { in: Object.keys(CATEGORY_SPAN_MINUTES) as EventCategory[] },
            },
          },
        },
        include: { season: { include: { event: true } } },
      });

      for (const existing of candidates) {
        const existSpan = CATEGORY_SPAN_MINUTES[existing.season.event.category];
        if (!existSpan) continue;
        const existStartMs = existing.scheduledStart.getTime();
        const existEndMs = existStartMs + existSpan * 60 * 1000;
        if (newStartMs < existEndMs && existStartMs < newEndMs) {
          throw new BadRequestException(
            `Match time overlaps with an existing match (${newSpan}-minute window required)`,
          );
        }
      }
    }

    // CLASSIC_MINI_PRIXモードの場合、トラックセットを自動計算
    let tracks: number[] | null = null;
    if (inGameMode === InGameMode.CLASSIC_MINI_PRIX) {
      tracks = this.tracksService.calculateClassicMiniTracks(new Date(scheduledStart));
    }

    // GP/MIRROR_GP: auto-assign 5 tracks based on league
    if ((inGameMode === InGameMode.GRAND_PRIX || inGameMode === InGameMode.MIRROR_GRAND_PRIX) && leagueType) {
      tracks = this.tracksService.getGpTracksByLeague(leagueType);
    }

    // Create match and game in a transaction, then reassign matchNumbers by scheduledStart order
    const match = await this.prisma.$transaction(async (tx) => {
      const scheduledDate = new Date(scheduledStart);
      // Default deadline is 1 hour after scheduled start
      const deadlineDate = new Date(scheduledDate.getTime() + 60 * 60 * 1000);

      const newMatch = await tx.match.create({
        data: {
          seasonId,
          // matchNumber is assigned by reassignWaitingMatchNumbers below
          scheduledStart: scheduledDate,
          deadline: deadlineDate,
          minPlayers: minPlayers || 4,
          maxPlayers: maxPlayers || 20,
          createdBy,
          notes,
          status: MatchStatus.WAITING,
          ...(recurringMatchId && { recurringMatchId }),
        },
      });

      // Create first game (without passcode - will be generated at scheduledStart)
      await tx.game.create({
        data: {
          matchId: newMatch.id,
          inGameMode,
          leagueType,
          gameNumber: 1,
          passcode: '', // Empty until scheduledStart
          ...(tracks && { tracks }), // CLASSIC_MINI_PRIXの場合は自動計算されたトラックが設定される
        },
      });

      // Reassign all WAITING matchNumbers based on scheduledStart order
      await this.reassignWaitingMatchNumbers(tx, seasonId);

      return newMatch;
    });

    // Fetch match with includes
    const matchWithIncludes = await this.prisma.match.findUnique({
      where: { id: match.id },
      include: this.matchDetailInclude,
    });

    // Schedule BullMQ job to generate passcode and start match at scheduledStart time
    const now = new Date();
    const delay = new Date(scheduledStart).getTime() - now.getTime();

    if (delay > 0) {
      await this.matchQueue.add(
        'start-match',
        { matchId: match.id },
        {
          delay,
          removeOnComplete: true,
          removeOnFail: { count: 10 },
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          jobId: `start-match-${match.id}`,
        },
      );

      // Schedule 5-minute reminder only if match is scheduled 1+ hour ahead
      const ONE_HOUR = 60 * 60 * 1000;
      const FIVE_MINUTES = 5 * 60 * 1000;
      if (delay >= ONE_HOUR) {
        const reminderDelay = delay - FIVE_MINUTES;
        await this.matchQueue.add(
          'reminder-match',
          { matchId: match.id },
          {
            delay: reminderDelay,
            removeOnComplete: true,
            removeOnFail: { count: 10 },
            jobId: `reminder-${match.id}`,
          },
        );
      }
    }

    // Announce match creation to Discord (fire and forget - don't block on errors)
    // Skip if silent mode (e.g., auto-generated by recurring schedule)
    if (!options?.silent && matchWithIncludes && matchWithIncludes.matchNumber && matchWithIncludes.games[0]) {
      try {
        const creator = await this.prisma.user.findUnique({
          where: { id: createdBy },
          select: { displayName: true, username: true },
        });

        await this.discordBotService.announceMatchCreated({
          matchNumber: matchWithIncludes.matchNumber,
          seasonNumber: season.seasonNumber,
          category: season.event.category,
          seasonName: season.event.name,
          inGameMode: matchWithIncludes.games[0].inGameMode,
          leagueType: matchWithIncludes.games[0].leagueType,
          scheduledStart: new Date(scheduledStart),
          minPlayers: match.minPlayers,
          maxPlayers: match.maxPlayers,
          creatorDisplayName: creator?.displayName || creator?.username || 'Unknown',
        });
      } catch (error) {
        this.logger.error('Failed to announce match creation to Discord:', error);
        // Don't throw - Discord failure should not block match creation
      }
    }

    return matchWithIncludes;
  }

  async getByDateRange(from: Date, to: Date) {
    return this.prisma.match.findMany({
      where: {
        scheduledStart: {
          gte: from,
          lt: to,
        },
        status: {
          not: MatchStatus.CANCELLED,
        },
      },
      orderBy: { scheduledStart: 'asc' },
      include: this.matchDetailInclude,
    });
  }

  async getAll(eventCategory?: EventCategory, status?: MatchStatus) {
    return this.prisma.match.findMany({
      where: {
        ...(eventCategory && {
          season: {
            event: {
              category: eventCategory,
            },
          },
        }),
        ...(status && { status }),
      },
      orderBy: { scheduledStart: 'asc' },
      include: this.matchDetailInclude,
    });
  }

  async getNext(eventCategory?: EventCategory) {
    // WAITINGマッチを検索（開始時刻を1分以上過ぎたものは除外）
    const match = await this.prisma.match.findFirst({
      where: {
        ...(eventCategory && {
          season: {
            event: {
              category: eventCategory,
            },
          },
        }),
        status: MatchStatus.WAITING,
        scheduledStart: {
          gt: new Date(Date.now() - 60 * 1000),
        },
      },
      orderBy: { scheduledStart: 'asc' },
      include: {
        season: {
          include: {
            event: true,
            tournamentConfig: true,
          },
        },
        games: true,
      },
    });

    if (!match) {
      return null;
    }

    // レーティング付きで再取得
    return this.prisma.match.findUnique({
      where: { id: match.id },
      include: this.getMatchDetailIncludeWithRating(match.seasonId),
    });
  }

  async getById(matchId: number) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: this.matchDetailInclude,
    });

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    return match;
  }

  async getRecent(limit: number = 5) {
    // Get recent completed/finalized matches
    const matches = await this.prisma.match.findMany({
      where: {
        status: {
          in: [MatchStatus.COMPLETED, MatchStatus.FINALIZED],
        },
      },
      orderBy: { actualStart: 'desc' },
      take: limit * 3,
      include: {
        season: {
          include: {
            event: true,
          },
        },
        participants: true,
        games: {
          include: {
            participants: {
              where: { isExcluded: false, totalScore: { not: null } },
              orderBy: { totalScore: 'desc' },
              include: {
                user: {
                  select: {
                    id: true,
                    displayName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Format the response and filter out matches without winners
    return matches
      .map((match) => {
        const game = match.games[0];
        const matchCategory = match.season.event.category;

        const commonFields = {
          id: match.id,
          matchNumber: match.matchNumber,
          category: matchCategory,
          seasonNumber: match.season.seasonNumber,
          playerCount: game ? game.participants.length : match.participants.length,
          status: match.status,
          startedAt: match.actualStart,
        };

        // Individual top scorer (participants are ordered by totalScore desc)
        const topScorer = game?.participants[0];
        const winner = topScorer
          ? {
              id: topScorer.user.id,
              displayName: topScorer.user.displayName,
              totalScore: topScorer.totalScore,
            }
          : null;

        return {
          ...commonFields,
          winner,
          winningTeam: null,
        };
      })
      .filter(
        (match) =>
          (match.winner !== null || match.winningTeam !== null) &&
          match.playerCount > 1,
      )
      .slice(0, limit);
  }

  async getResultsPaginated(
    category: EventCategory,
    seasonNumber: number,
    page: number = 1,
    limit: number = 20,
  ) {
    const where = {
      status: {
        in: [MatchStatus.COMPLETED, MatchStatus.FINALIZED],
      },
      season: {
        event: { category },
        seasonNumber,
      },
      // Only matches with winner (game with participants)
      games: {
        some: {
          participants: {
            some: {},
          },
        },
      },
    };

    // Get all matching IDs with participant count to filter
    const allMatches = await this.prisma.match.findMany({
      where,
      select: {
        id: true,
        _count: {
          select: { participants: true },
        },
      },
      orderBy: { scheduledStart: 'desc' },
    });

    // Filter to only matches with 2+ participants
    const validMatchIds = allMatches
      .filter((m) => m._count.participants >= 2)
      .map((m) => m.id);

    const total = validMatchIds.length;
    const skip = (page - 1) * limit;
    const paginatedIds = validMatchIds.slice(skip, skip + limit);

    const matches = await this.prisma.match.findMany({
      where: {
        id: { in: paginatedIds },
      },
      orderBy: { scheduledStart: 'desc' },
      include: {
        season: {
          include: {
            event: true,
          },
        },
        participants: true,
        games: {
          include: {
            _count: {
              select: { participants: { where: { isExcluded: false } } },
            },
            participants: {
              ...((category === 'TEAM_CLASSIC' || category === 'TEAM_GP')
                ? {
                    where: { isExcluded: false, totalScore: { not: null } },
                    orderBy: { totalScore: 'desc' as const },
                    take: 1,
                    include: {
                      user: {
                        select: { id: true, displayName: true },
                      },
                    },
                  }
                : {
                    where: { totalScore: { not: null } },
                    orderBy: { totalScore: 'desc' as const },
                    take: 1,
                    include: {
                      user: {
                        select: { id: true, displayName: true },
                      },
                    },
                  }),
            },
          },
        },
      },
    });

    // Format the response
    const data = matches.map((match) => {
      const game = match.games[0];
      const matchCategory = match.season.event.category;

      const commonFields = {
        id: match.id,
        matchNumber: match.matchNumber,
        category: matchCategory,
        seasonNumber: match.season.seasonNumber,
        playerCount: game ? game._count.participants : match.participants.length,
        status: match.status,
        startedAt: match.actualStart,
      };

      // Individual top scorer (participants are ordered by totalScore desc)
      const topScorer = game?.participants[0];
      return {
        ...commonFields,
        winner: topScorer
          ? {
              id: topScorer.user.id,
              displayName: topScorer.user.displayName,
              totalScore: topScorer.totalScore,
            }
          : null,
      };
    });

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
      },
    };
  }

  async join(matchId: number, userId: number) {
    const match = await this.getById(matchId);

    // Check if match is in WAITING status
    if (match.status !== MatchStatus.WAITING) {
      throw new BadRequestException('Match is not accepting players');
    }

    // Check if match is full
    const currentPlayers = match.participants.length;
    if (currentPlayers >= match.maxPlayers) {
      throw new BadRequestException('Match is full');
    }

    // Check if user is already a participant
    const existingParticipant = await this.prisma.matchParticipant.findUnique({
      where: {
        matchId_userId: {
          matchId,
          userId,
        },
      },
    });

    if (existingParticipant) {
      throw new BadRequestException('Already in match');
    }

    // Check if user is banned or suspended
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.status === UserStatus.BANNED) {
      throw new ForbiddenException('You are permanently banned');
    }

    if (user.status === UserStatus.SUSPENDED) {
      if (user.suspendedUntil && user.suspendedUntil > new Date()) {
        throw new ForbiddenException('You are currently suspended');
      }
    }

    // Add user as participant
    await this.prisma.matchParticipant.create({
      data: {
        matchId,
        userId,
      },
    });

    // Fetch updated match
    const updatedMatch = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: this.matchDetailInclude,
    });

    // Emit WebSocket event to notify all clients
    this.eventsGateway.emitMatchUpdated(updatedMatch);

    return updatedMatch;
  }

  async leave(matchId: number, userId: number) {
    const match = await this.getById(matchId);

    // Check if match is in WAITING status
    if (match.status !== MatchStatus.WAITING) {
      throw new BadRequestException('Cannot leave match at this time');
    }

    // Check if user is a participant
    const participant = await this.prisma.matchParticipant.findUnique({
      where: {
        matchId_userId: {
          matchId,
          userId,
        },
      },
    });

    if (!participant) {
      throw new BadRequestException('Not in match');
    }

    // Remove user from participants
    await this.prisma.matchParticipant.delete({
      where: { id: participant.id },
    });

    // Fetch updated match
    const updatedMatch = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: this.matchDetailInclude,
    });

    // Emit WebSocket event to notify all clients
    this.eventsGateway.emitMatchUpdated(updatedMatch);

    return updatedMatch;
  }

  async cancel(matchId: number) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        ...this.matchDetailInclude,
        season: {
          include: {
            event: true,
          },
        },
      },
    });

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    // Only allow cancellation of WAITING or IN_PROGRESS matches
    if (match.status !== MatchStatus.WAITING && match.status !== MatchStatus.IN_PROGRESS) {
      throw new BadRequestException('Can only cancel matches in WAITING or IN_PROGRESS status');
    }

    // Save original matchNumber before clearing it (for Discord announcement)
    const originalMatchNumber = match.matchNumber;

    // Update match status to CANCELLED and clear matchNumber to free it for reuse
    const updatedMatch = await this.prisma.match.update({
      where: { id: matchId },
      data: {
        status: MatchStatus.CANCELLED,
        matchNumber: null,
      },
      include: this.matchDetailInclude,
    });

    // Remove scheduled reminder job if exists
    try {
      const reminderJob = await this.matchQueue.getJob(`reminder-${matchId}`);
      if (reminderJob) {
        await reminderJob.remove();
        this.logger.log(`Removed reminder job for match ${matchId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to remove reminder job for match ${matchId}:`, error);
    }

    // Post cancellation message to passcode channel and schedule channel deletion after 1 hour
    for (const game of updatedMatch.games) {
      try {
        await this.discordBotService.postCancellationMessage(game.id);
        // Schedule channel deletion after 24 hours
        await this.matchQueue.add(
          'delete-discord-channel',
          { gameId: game.id },
          { delay: 24 * 60 * 60 * 1000, removeOnComplete: true, removeOnFail: { count: 10 } }, // 24 hours
        );
      } catch (error) {
        this.logger.error(`Failed to handle Discord channel for game ${game.id}:`, error);
        // Continue even if Discord fails
      }
    }

    // Announce cancellation to Discord announce channel
    if (originalMatchNumber !== null) {
      try {
        await this.discordBotService.announceMatchCancelled({
          matchNumber: originalMatchNumber,
          seasonNumber: match.season.seasonNumber,
          category: match.season.event.category,
          seasonName: match.season.event.name,
          reason: 'admin_cancelled',
        });
      } catch (error) {
        this.logger.error('Failed to announce match cancellation to Discord:', error);
      }
    }

    // Reassign WAITING matchNumbers after cancellation to fill gaps
    await this.reassignWaitingMatchNumbers(this.prisma, match.seasonId);

    // Emit WebSocket event to notify all clients
    this.eventsGateway.emitMatchUpdated(updatedMatch);

    return { message: 'Match cancelled successfully', match: updatedMatch };
  }

  async delete(matchId: number) {
    const match = await this.getById(matchId);

    // Only allow deletion of WAITING matches
    if (match.status !== MatchStatus.WAITING) {
      throw new BadRequestException('Cannot delete match that is not in WAITING status');
    }

    const seasonId = match.seasonId;

    // BullMQのstart-matchジョブとreminderジョブを削除
    await this.removeMatchJobs(matchId);

    // Delete all related participants and match in a transaction, then reassign numbers
    await this.prisma.$transaction(async (tx) => {
      // First delete all related MatchParticipant records
      await tx.matchParticipant.deleteMany({
        where: { matchId },
      });

      // Delete all related Games
      await tx.game.deleteMany({
        where: { matchId },
      });

      // Then delete the match
      await tx.match.delete({
        where: { id: matchId },
      });

      // Reassign WAITING matchNumbers after deletion to fill gaps
      await this.reassignWaitingMatchNumbers(tx, seasonId);
    });

    return { message: 'Match deleted successfully' };
  }

  /**
   * Reassign matchNumbers for all WAITING matches in a season
   * based on scheduledStart order. Locked (non-WAITING) matches keep their numbers.
   */
  async reassignWaitingMatchNumbers(
    tx: {
      match: {
        findMany: typeof this.prisma.match.findMany;
        updateMany: typeof this.prisma.match.updateMany;
        update: typeof this.prisma.match.update;
      };
    },
    seasonId: number,
  ): Promise<void> {
    // Get all non-cancelled matches in this season
    const allMatches = await tx.match.findMany({
      where: {
        seasonId,
        status: { not: MatchStatus.CANCELLED },
      },
      select: {
        id: true,
        matchNumber: true,
        status: true,
        scheduledStart: true,
      },
    });

    // Separate locked (non-WAITING) vs flexible (WAITING)
    const locked = allMatches.filter(
      (m: { status: MatchStatus }) => m.status !== MatchStatus.WAITING,
    );
    const flexible = allMatches.filter(
      (m: { status: MatchStatus }) => m.status === MatchStatus.WAITING,
    );

    if (flexible.length === 0) return;

    // Get locked number set
    const lockedNumbers = new Set<number>(
      locked
        .map((m: { matchNumber: number | null }) => m.matchNumber)
        .filter((n): n is number => n !== null),
    );

    // Sort flexible by scheduledStart, then by id for tiebreaker
    flexible.sort(
      (a: { scheduledStart: Date; id: number }, b: { scheduledStart: Date; id: number }) => {
        const timeDiff = a.scheduledStart.getTime() - b.scheduledStart.getTime();
        return timeDiff !== 0 ? timeDiff : a.id - b.id;
      },
    );

    // Null out all flexible matchNumbers to avoid unique constraint violations
    await tx.match.updateMany({
      where: {
        id: { in: flexible.map((m: { id: number }) => m.id) },
      },
      data: { matchNumber: null },
    });

    // Assign numbers starting after the highest locked number (no gaps in WAITING range)
    const maxLocked = lockedNumbers.size > 0 ? Math.max(...Array.from(lockedNumbers)) : 0;
    let nextNumber = maxLocked + 1;
    for (const match of flexible) {
      await tx.match.update({
        where: { id: match.id },
        data: { matchNumber: nextNumber },
      });
      nextNumber++;
    }
  }
}
