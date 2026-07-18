import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import {
  confirmedEntries,
  divisionForInGameMode,
  roundQualifiedLabel,
} from '@fz99/shared';
import { PrismaService } from '../prisma/prisma.service';
import { DiscordBotService } from '../discord-bot/discord-bot.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import {
  EventCategory,
  League,
  MatchStatus,
  Prisma,
  StreamPlatform,
  TournamentStatus,
  TournamentDivision,
  TournamentMode,
} from '@prisma/client';

// 運営がボタンを押してから公開までの猶予(秒)
const PASSCODE_COUNTDOWN_SECONDS = 60;

// Bull遅延ジョブ(passcode-reveal)のペイロード。
// 発火時にDBの現在状態と照合し、一致しない予約は投稿せずスキップする
export interface PasscodeRevealJobData {
  gameId: number;
  tournamentConfigId: number;
  matchNumber: number;
  expectedRevealTime: string;
  passcodeVersion: number;
}

@Injectable()
export class TournamentsService {
  private readonly logger = new Logger(TournamentsService.name);
  // In-memory store: gameId → Discord passcode message ID (新カウントダウン開始時の旧投稿削除に使用)
  private passcodeMessageIds = new Map<number, string>();
  // In-memory store: gameId → Discord countdown message ID (deleted when passcode is revealed)
  private countdownMessageIds = new Map<number, string>();

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    private discordBotService: DiscordBotService,
    private configService: ConfigService,
    @InjectQueue('tournaments') private tournamentsQueue: Queue,
  ) {}

  async create(dto: CreateTournamentDto) {
    const {
      name,
      totalRounds,
      rounds,
      tournamentDate,
      registrationStart,
      registrationEnd,
      minPlayers = 40,
      maxPlayers = 99,
      content,
    } = dto;

    if (rounds.length !== totalRounds) {
      throw new BadRequestException(
        `rounds array length (${rounds.length}) must match totalRounds (${totalRounds})`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Find or create TOURNAMENT event
      let event = await tx.event.findFirst({
        where: { category: EventCategory.TOURNAMENT },
      });
      if (!event) {
        event = await tx.event.create({
          data: {
            category: EventCategory.TOURNAMENT,
            name: 'TOURNAMENT',
            description: 'Tournament mode seasons',
          },
        });
      }

      // Calculate tournamentNumber: count existing tournaments with same name + 1
      const existingCount = await tx.tournamentConfig.count({
        where: { name },
      });
      const tournamentNumber = existingCount + 1;

      // Determine season number (max existing + 1)
      const maxSeason = await tx.season.findFirst({
        where: { eventId: event.id },
        orderBy: { seasonNumber: 'desc' },
        select: { seasonNumber: true },
      });
      const seasonNumber = (maxSeason?.seasonNumber ?? 0) + 1;

      // Create season (inactive - tournament manages its own lifecycle)
      const season = await tx.season.create({
        data: {
          eventId: event.id,
          seasonNumber,
          startDate: new Date(tournamentDate),
          isActive: false,
          description: `${name} #${tournamentNumber}`,
        },
      });

      // Create tournament config
      const tournamentConfig = await tx.tournamentConfig.create({
        data: {
          seasonId: season.id,
          name,
          tournamentNumber,
          status: TournamentStatus.DRAFT,
          rounds: rounds as any,
          totalRounds,
          tournamentDate: new Date(tournamentDate),
          registrationStart: new Date(registrationStart),
          registrationEnd: new Date(registrationEnd),
          minPlayers,
          maxPlayers,
          ...(content !== undefined && { content: content as any }),
        },
      });

      return this.findOne(tournamentConfig.id, tx);
    });
  }

  async findByDateRange(from: Date, to: Date) {
    const configs = await this.prisma.tournamentConfig.findMany({
      where: {
        tournamentDate: { gte: from, lt: to },
        status: { not: TournamentStatus.DRAFT },
      },
      include: {
        season: { include: { event: true } },
        _count: { select: { registrations: true } },
      },
      orderBy: { tournamentDate: 'asc' },
    });

    return configs.map((c) => ({
      ...c,
      registrationCount: c._count.registrations,
      _count: undefined,
    }));
  }

  async findAll() {
    const configs = await this.prisma.tournamentConfig.findMany({
      include: {
        season: { include: { event: true } },
        _count: { select: { registrations: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return configs.map((c) => ({
      ...c,
      registrationCount: c._count.registrations,
      _count: undefined,
    }));
  }

  async findOne(id: number, tx?: any, includePasscodes: boolean = true) {
    const prisma = tx || this.prisma;
    const config = await prisma.tournamentConfig.findUnique({
      where: { id },
      include: {
        season: {
          include: {
            event: true,
            matches: {
              orderBy: { matchNumber: 'asc' },
              include: {
                games: {
                  orderBy: { gameNumber: 'asc' },
                  include: {
                    participants: {
                      include: {
                        user: {
                          select: {
                            id: true,
                            profileNumber: true,
                            displayName: true,
                            avatarHash: true,
                            profile: { select: { country: true } },
                          },
                        },
                        raceResults: { orderBy: { raceNumber: 'asc' } },
                      },
                    },
                  },
                },
                participants: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        profileNumber: true,
                        displayName: true,
                        avatarHash: true,
                        profile: { select: { country: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        _count: { select: { registrations: true } },
      },
    });

    if (!config) {
      throw new NotFoundException('Tournament not found');
    }

    // 一般向けレスポンスからはパスコードを除去する(公開経路はDiscordのみ)
    const season =
      !includePasscodes && config.season
        ? {
            ...config.season,
            matches: config.season.matches?.map((m: any) => ({
              ...m,
              games: m.games?.map(
                ({ passcode: _passcode, ...game }: any) => game,
              ),
            })),
          }
        : config.season;

    return {
      ...config,
      season,
      registrationCount: config._count.registrations,
      _count: undefined,
      discordPasscodeChannelUrls: this.getDiscordPasscodeChannelUrls(),
    };
  }

  // 部門別のパスコード公開チャンネルURL(専用→フォールバックの解決はbot側と共通)
  private getDiscordPasscodeChannelUrls(): Record<
    TournamentDivision,
    string | null
  > | null {
    const guildId = this.configService.get<string>('DISCORD_GUILD_ID');
    if (!guildId) return null;
    const urlFor = (division: TournamentDivision) => {
      const { channelId } =
        this.discordBotService.resolveTournamentPasscodeChannel(division);
      return channelId
        ? `https://discord.com/channels/${guildId}/${channelId}`
        : null;
    };
    return {
      [TournamentDivision.GP]: urlFor(TournamentDivision.GP),
      [TournamentDivision.CLASSIC]: urlFor(TournamentDivision.CLASSIC),
    };
  }

  async update(id: number, dto: UpdateTournamentDto) {
    const existing = await this.prisma.tournamentConfig.findUnique({
      where: { id },
      include: { season: true },
    });
    if (!existing) {
      throw new NotFoundException('Tournament not found');
    }

    // ステータスは前後どちらにも動かせる(誤操作からの復帰を塞がない)。
    // 遷移に紐付く副作用は冪等に保つ
    if (dto.status && dto.status === existing.status) {
      throw new BadRequestException(`Tournament is already ${dto.status}`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.tournamentConfig.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.totalRounds !== undefined && {
            totalRounds: dto.totalRounds,
          }),
          ...(dto.rounds !== undefined && { rounds: dto.rounds as any }),
          ...(dto.tournamentDate !== undefined && {
            tournamentDate: new Date(dto.tournamentDate),
          }),
          ...(dto.registrationStart !== undefined && {
            registrationStart: new Date(dto.registrationStart),
          }),
          ...(dto.registrationEnd !== undefined && {
            registrationEnd: new Date(dto.registrationEnd),
          }),
          ...(dto.minPlayers !== undefined && { minPlayers: dto.minPlayers }),
          ...(dto.maxPlayers !== undefined && { maxPlayers: dto.maxPlayers }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.content !== undefined && { content: dto.content as any }),
        },
      });

      // REGISTRATION_CLOSED: create matches + games for each round
      // (再訪時は重複生成せず、参加者だけ最新の登録内容へ同期する)
      if (dto.status === TournamentStatus.REGISTRATION_CLOSED) {
        const existingMatches = await tx.match.count({
          where: { seasonId: existing.seasonId },
        });
        if (existingMatches === 0) {
          await this.createMatchesForTournament(existing, tx);
        } else {
          await this.syncMatchParticipants(existing, tx);
        }
      }

      // IN_PROGRESS: advance only the first round (matchNumber: 1) to IN_PROGRESS
      if (dto.status === TournamentStatus.IN_PROGRESS) {
        await tx.match.updateMany({
          where: {
            seasonId: existing.seasonId,
            status: MatchStatus.WAITING,
            matchNumber: 1,
          },
          data: { status: MatchStatus.IN_PROGRESS },
        });
      }
    });

    return this.findOne(id);
  }

  private generatePasscode(): string {
    return Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');
  }

  private getRoundMeta(
    config: {
      id: number;
      name: string;
      tournamentNumber: number;
      rounds: any;
    },
    matchNumber: number,
  ) {
    const rounds = config.rounds as Array<{
      roundNumber: number;
      inGameMode: string;
      league?: string;
    }>;
    const roundConfig = rounds.find((r) => r.roundNumber === matchNumber);
    const baseUrl =
      this.configService.get<string>('CORS_ORIGIN') || 'https://fz99lounge.com';
    return {
      tournamentName: `${config.name} #${config.tournamentNumber}`,
      roundLabel: roundQualifiedLabel(rounds, matchNumber),
      inGameMode: roundConfig?.inGameMode || 'GRAND_PRIX',
      league: roundConfig?.league,
      scoreUrl: `${baseUrl}/tournament/${config.id}?round=${matchNumber}`,
    };
  }

  /**
   * パスコード公開を予約する。公開経路は「運営のボタン押下 → カウントダウン → 公開」のみ。
   *
   * - 予約はBull遅延ジョブ(API再起動後も残り、期限超過分は起動時に即発火)
   * - ジョブ発火時にDBの公開予定時刻・パスコード版を照合し、
   *   hide/再生成/再カウントダウンで置き換えられた古い予約は投稿せずスキップする
   * - Discordのカウントダウンembed投稿はfire-and-forget(失敗しても予約自体は生きる)
   */
  private async schedulePasscodeReveal(params: {
    gameId: number;
    tournamentConfigId: number;
    matchNumber: number;
    revealAt: Date;
    passcodeVersion: number;
    tournamentName: string;
    roundLabel: string;
    inGameMode: string;
    league?: string;
    scoreUrl: string;
    countdownDescription?: string;
    deleteExistingMessage?: boolean;
  }) {
    const jobData: PasscodeRevealJobData = {
      gameId: params.gameId,
      tournamentConfigId: params.tournamentConfigId,
      matchNumber: params.matchNumber,
      expectedRevealTime: params.revealAt.toISOString(),
      passcodeVersion: params.passcodeVersion,
    };

    await this.tournamentsQueue.add('passcode-reveal', jobData, {
      delay: Math.max(0, params.revealAt.getTime() - Date.now()),
      jobId: `passcode-reveal-${params.gameId}-${params.revealAt.getTime()}`,
      removeOnComplete: true,
      removeOnFail: true,
    });

    const division = divisionForInGameMode(params.inGameMode);

    void (async () => {
      try {
        // Delete existing passcode Discord message if requested
        if (params.deleteExistingMessage) {
          const existingMessageId = this.passcodeMessageIds.get(params.gameId);
          if (existingMessageId) {
            await this.discordBotService
              .deleteTournamentMessage(existingMessageId, division)
              .catch((err) =>
                this.logger.error(
                  'Failed to delete existing Discord passcode message',
                  err,
                ),
              );
            this.passcodeMessageIds.delete(params.gameId);
          }
        }

        // Delete stale countdown message from a previous (superseded) countdown
        const previousCountdownId = this.countdownMessageIds.get(params.gameId);
        if (previousCountdownId) {
          await this.discordBotService
            .deleteTournamentMessage(previousCountdownId, division)
            .catch(() => undefined);
          this.countdownMessageIds.delete(params.gameId);
        }

        const countdownMessageId =
          await this.discordBotService.announceTournamentCountdownStarted({
            tournamentName: params.tournamentName,
            roundLabel: params.roundLabel,
            inGameMode: params.inGameMode,
            league: params.league,
            passcodeRevealTime: params.revealAt,
            description: params.countdownDescription,
          });
        if (countdownMessageId) {
          this.countdownMessageIds.set(params.gameId, countdownMessageId);
        }
      } catch (err) {
        this.logger.error('Failed to send countdown Discord announcement', err);
      }
    })();
  }

  /**
   * Bullジョブ(passcode-reveal)の実体。
   * DBの現在状態がこの予約と完全に一致するときだけDiscordへパスコードを投稿する。
   * 一致しない = hide/再生成/別のカウントダウンで置き換え済みなので何もしない。
   */
  async executePasscodeReveal(data: PasscodeRevealJobData) {
    const game = await this.prisma.game.findUnique({
      where: { id: data.gameId },
      select: {
        passcode: true,
        passcodeVersion: true,
        passcodeRevealTime: true,
        match: { select: { status: true } },
      },
    });

    if (!game?.passcodeRevealTime) {
      this.logger.log(
        `Skipping passcode reveal for game ${data.gameId}: no reveal time set`,
      );
      return;
    }
    const revealTime = new Date(game.passcodeRevealTime).getTime();
    if (revealTime <= 0) {
      this.logger.log(
        `Skipping passcode reveal for game ${data.gameId}: passcode was hidden`,
      );
      return;
    }
    if (revealTime !== new Date(data.expectedRevealTime).getTime()) {
      this.logger.log(
        `Skipping passcode reveal for game ${data.gameId}: superseded by a newer countdown`,
      );
      return;
    }
    if (game.passcodeVersion !== data.passcodeVersion) {
      this.logger.log(
        `Skipping passcode reveal for game ${data.gameId}: passcode was regenerated`,
      );
      return;
    }
    if (game.match.status !== MatchStatus.IN_PROGRESS) {
      this.logger.log(
        `Skipping passcode reveal for game ${data.gameId}: match is not in progress`,
      );
      return;
    }

    const config = await this.prisma.tournamentConfig.findUnique({
      where: { id: data.tournamentConfigId },
    });
    if (!config) return;

    const meta = this.getRoundMeta(config, data.matchNumber);
    const countdownMessageId = this.countdownMessageIds.get(data.gameId);
    const messageId =
      await this.discordBotService.announceTournamentPasscodeRevealed({
        tournamentName: meta.tournamentName,
        roundLabel: meta.roundLabel,
        inGameMode: meta.inGameMode,
        league: meta.league,
        passcode: game.passcode,
        scoreUrl: meta.scoreUrl,
        countdownMessageId: countdownMessageId || undefined,
      });
    this.countdownMessageIds.delete(data.gameId);
    if (messageId) {
      this.passcodeMessageIds.set(data.gameId, messageId);
    }
  }

  private async createMatchesForTournament(
    config: {
      id: number;
      seasonId: number;
      rounds: any;
      tournamentDate: Date;
      minPlayers: number;
      maxPlayers: number;
    },
    tx: any,
  ) {
    const rounds = config.rounds as Array<{
      roundNumber: number;
      inGameMode: string;
      league?: string;
      offsetMinutes?: number;
    }>;

    // 各ラウンドには該当division(GP/Classic)の登録者だけを参加させる
    const userIdsByDivision = await this.getRegisteredUserIdsByDivision(
      config.id,
      tx,
    );

    for (const round of rounds) {
      const userIds =
        userIdsByDivision[divisionForInGameMode(round.inGameMode)];
      const scheduledStart = new Date(config.tournamentDate);
      if (round.offsetMinutes) {
        scheduledStart.setMinutes(
          scheduledStart.getMinutes() + round.offsetMinutes,
        );
      }
      // Deadline: 15 minutes after scheduled start
      const deadline = new Date(scheduledStart);
      deadline.setMinutes(deadline.getMinutes() + 15);

      // Create match
      const match = await tx.match.create({
        data: {
          seasonId: config.seasonId,
          matchNumber: round.roundNumber,
          status: MatchStatus.WAITING,
          minPlayers: config.minPlayers,
          maxPlayers: config.maxPlayers,
          scheduledStart,
          deadline,
        },
      });

      // Add all registered users as match participants
      await tx.matchParticipant.createMany({
        data: userIds.map((userId: number) => ({
          matchId: match.id,
          userId,
        })),
      });

      // Create game for this round
      await tx.game.create({
        data: {
          matchId: match.id,
          gameNumber: 1,
          inGameMode: round.inGameMode as any,
          leagueType: (round.league as any) || null,
          passcode: this.generatePasscode(),
        },
      });
    }
  }

  // division別の確定参加者ユーザーID。
  // 先着定員(GP 32+67 / Classic 20)を超えたwaitlist登録は含めない。
  // 登録キャンセルで繰り上がった場合はREGISTRATION_CLOSED再遷移の同期で反映される
  private async getRegisteredUserIdsByDivision(
    tournamentConfigId: number,
    tx: any,
  ): Promise<Record<TournamentDivision, number[]>> {
    const registrations = (await tx.tournamentRegistration.findMany({
      where: { tournamentConfigId },
      select: { userId: true, division: true, mode: true },
      orderBy: { registeredAt: 'asc' },
    })) as Array<{
      userId: number;
      division: TournamentDivision;
      mode: TournamentMode | null;
    }>;

    const byDivision: Record<TournamentDivision, number[]> = {
      [TournamentDivision.GP]: [],
      [TournamentDivision.CLASSIC]: [],
    };
    for (const division of Object.values(TournamentDivision)) {
      const entries = registrations.filter((r) => r.division === division);
      byDivision[division] = [
        ...new Set(confirmedEntries(division, entries).map((r) => r.userId)),
      ];
    }
    return byDivision;
  }

  // マッチ生成後に登録が変わった場合(締切の再オープン等)のために、
  // REGISTRATION_CLOSED再遷移時は既存マッチの参加者を登録内容へ同期する
  private async syncMatchParticipants(
    config: { id: number; seasonId: number; rounds: any },
    tx: any,
  ) {
    const rounds = config.rounds as Array<{
      roundNumber: number;
      inGameMode: string;
    }>;
    const userIdsByDivision = await this.getRegisteredUserIdsByDivision(
      config.id,
      tx,
    );

    const matches = (await tx.match.findMany({
      where: { seasonId: config.seasonId },
      select: { id: true, matchNumber: true },
    })) as Array<{ id: number; matchNumber: number | null }>;

    for (const match of matches) {
      const round = rounds.find((r) => r.roundNumber === match.matchNumber);
      if (!round) continue;
      const userIds =
        userIdsByDivision[divisionForInGameMode(round.inGameMode)];

      await tx.matchParticipant.deleteMany({
        where: { matchId: match.id, userId: { notIn: userIds } },
      });
      await tx.matchParticipant.createMany({
        data: userIds.map((userId) => ({ matchId: match.id, userId })),
        skipDuplicates: true,
      });
    }
  }

  async advanceRound(tournamentConfigId: number) {
    const config = await this.prisma.tournamentConfig.findUnique({
      where: { id: tournamentConfigId },
      include: { season: true },
    });

    if (!config) {
      throw new NotFoundException('Tournament not found');
    }

    // RESULTS_PENDING中に再オープンしたGPを閉じ直すケースも許可する(ソフトロック回避)
    if (
      config.status !== TournamentStatus.IN_PROGRESS &&
      config.status !== TournamentStatus.RESULTS_PENDING
    ) {
      throw new BadRequestException('Tournament is not in progress');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Find the current IN_PROGRESS match
      const currentMatch = await tx.match.findFirst({
        where: {
          seasonId: config.seasonId,
          status: MatchStatus.IN_PROGRESS,
        },
        include: { games: { select: { id: true }, take: 1 } },
        orderBy: { matchNumber: 'asc' },
      });

      if (!currentMatch) {
        throw new BadRequestException('No in-progress round found');
      }

      // Complete the current match
      await tx.match.update({
        where: { id: currentMatch.id },
        data: { status: MatchStatus.COMPLETED },
      });

      // Find the next WAITING match
      const nextMatch = await tx.match.findFirst({
        where: {
          seasonId: config.seasonId,
          status: MatchStatus.WAITING,
        },
        include: { games: { select: { id: true }, take: 1 } },
        orderBy: { matchNumber: 'asc' },
      });

      if (nextMatch) {
        // Advance next match to IN_PROGRESS
        await tx.match.update({
          where: { id: nextMatch.id },
          data: { status: MatchStatus.IN_PROGRESS },
        });
      } else {
        // No more rounds — transition tournament to RESULTS_PENDING
        await tx.tournamentConfig.update({
          where: { id: tournamentConfigId },
          data: { status: TournamentStatus.RESULTS_PENDING },
        });
      }

      return {
        tournament: await this.findOne(tournamentConfigId, tx),
        completedGameId: currentMatch.games[0]?.id,
        startedGameId: nextMatch?.games[0]?.id,
      };
    });

    // Emit status change events after transaction commits
    if (result.completedGameId) {
      this.eventEmitter.emit('game.statusChanged', {
        gameId: result.completedGameId,
        status: MatchStatus.COMPLETED,
      });
    }
    if (result.startedGameId) {
      this.eventEmitter.emit('game.statusChanged', {
        gameId: result.startedGameId,
        status: MatchStatus.IN_PROGRESS,
      });
    }

    return result.tournament;
  }

  async register(
    tournamentConfigId: number,
    userId: number,
    params: {
      division: TournamentDivision;
      mode?: TournamentMode | null;
      prizeEntry?: boolean;
    },
  ) {
    const { division, mode, prizeEntry } = params;

    if (mode !== TournamentMode.OFFLINE && mode !== TournamentMode.ONLINE) {
      throw new BadRequestException('mode must be OFFLINE or ONLINE');
    }

    const config = await this.prisma.tournamentConfig.findUnique({
      where: { id: tournamentConfigId },
    });

    if (!config) {
      throw new NotFoundException('Tournament not found');
    }

    if (config.status !== TournamentStatus.REGISTRATION_OPEN) {
      throw new BadRequestException('Registration is not open');
    }

    try {
      await this.prisma.tournamentRegistration.create({
        data: {
          userId,
          tournamentConfigId,
          division,
          mode,
          prizeEntry: prizeEntry ?? false,
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new BadRequestException('Already registered for this division');
      }
      throw error;
    }

    return { message: 'Registered successfully' };
  }

  async cancelRegistration(
    tournamentConfigId: number,
    userId: number,
    division: TournamentDivision,
  ) {
    const config = await this.prisma.tournamentConfig.findUnique({
      where: { id: tournamentConfigId },
    });

    if (!config) {
      throw new NotFoundException('Tournament not found');
    }

    if (config.status !== TournamentStatus.REGISTRATION_OPEN) {
      throw new BadRequestException('Cannot cancel registration at this stage');
    }

    const registration = await this.prisma.tournamentRegistration.findUnique({
      where: {
        userId_tournamentConfigId_division: {
          userId,
          tournamentConfigId,
          division,
        },
      },
    });

    if (!registration) {
      throw new BadRequestException('Not registered');
    }

    await this.prisma.tournamentRegistration.delete({
      where: { id: registration.id },
    });

    return { message: 'Registration cancelled' };
  }

  /**
   * カウントダウン開始。運営が対象GP・リーグ・パスコードを明示指定できる。
   *
   * 進行が予定とズレても運営の指示だけで確実に動くよう、
   * フェーズ・順序・時刻による暗黙の自動判定は行わない:
   * - どのGPでも状態を問わず発火できる(COMPLETEDは再オープン、順序の縛りなし)
   * - RESULTS_PENDINGからも発火でき、大会をIN_PROGRESSへ戻す
   * - 「ライブなGPは1つ」だけ維持: 他のIN_PROGRESSは公開済みならCOMPLETED
   *   (提出は開いたまま)、未公開ならWAITINGへ戻す(後で発火し直せる)
   * - 公開は押下からcountdownSeconds後、Discordのみ(Bullジョブが保証)
   */
  async startCountdown(
    tournamentConfigId: number,
    options: {
      matchNumber?: number;
      league?: League;
      passcode?: string;
    } = {},
    countdownSeconds = PASSCODE_COUNTDOWN_SECONDS,
  ) {
    const config = await this.prisma.tournamentConfig.findUnique({
      where: { id: tournamentConfigId },
      include: { season: true },
    });

    if (!config) throw new NotFoundException('Tournament not found');

    if (
      config.status !== TournamentStatus.REGISTRATION_CLOSED &&
      config.status !== TournamentStatus.IN_PROGRESS &&
      config.status !== TournamentStatus.RESULTS_PENDING
    ) {
      throw new BadRequestException(
        'Tournament must be REGISTRATION_CLOSED, IN_PROGRESS or RESULTS_PENDING',
      );
    }

    const needsStatusReset = config.status !== TournamentStatus.IN_PROGRESS;

    const result = await this.prisma.$transaction(async (tx) => {
      if (needsStatusReset) {
        await tx.tournamentConfig.update({
          where: { id: tournamentConfigId },
          data: { status: TournamentStatus.IN_PROGRESS },
        });
      }

      // 対象ラウンドの解決: 明示指定 > 現在IN_PROGRESS > 次のWAITING
      let targetMatch: Prisma.MatchGetPayload<{
        include: { games: true };
      }> | null;
      if (options.matchNumber != null) {
        targetMatch = await tx.match.findFirst({
          where: {
            seasonId: config.seasonId,
            matchNumber: options.matchNumber,
          },
          include: { games: { take: 1 } },
        });
        if (!targetMatch) {
          throw new BadRequestException(`GP${options.matchNumber} not found`);
        }
        if (
          targetMatch.status !== MatchStatus.WAITING &&
          targetMatch.status !== MatchStatus.IN_PROGRESS &&
          targetMatch.status !== MatchStatus.COMPLETED
        ) {
          throw new BadRequestException(
            `GP${options.matchNumber} is ${targetMatch.status}`,
          );
        }
      } else {
        targetMatch =
          (await tx.match.findFirst({
            where: {
              seasonId: config.seasonId,
              status: MatchStatus.IN_PROGRESS,
            },
            include: { games: { take: 1 } },
            orderBy: { matchNumber: 'asc' },
          })) ??
          (await tx.match.findFirst({
            where: {
              seasonId: config.seasonId,
              status: MatchStatus.WAITING,
            },
            include: { games: { take: 1 } },
            orderBy: { matchNumber: 'asc' },
          }));
        if (!targetMatch) {
          throw new BadRequestException('No active game found');
        }
      }

      const game = targetMatch.games[0];
      if (!game) throw new BadRequestException('No active game found');

      // 「ライブなGPは1つ」だけ維持する(順序の縛りはなし)。
      // 他のIN_PROGRESSは、公開済みならCOMPLETED、未公開ならWAITINGへ戻す
      const otherLiveMatches = await tx.match.findMany({
        where: {
          seasonId: config.seasonId,
          status: MatchStatus.IN_PROGRESS,
          id: { not: targetMatch.id },
        },
        include: { games: { take: 1 } },
      });
      const sideEffects: Array<{ gameId: number; status: MatchStatus }> = [];
      for (const other of otherLiveMatches) {
        const otherGame = other.games[0];
        const revealMs = otherGame?.passcodeRevealTime
          ? new Date(otherGame.passcodeRevealTime).getTime()
          : 0;
        const wasRevealed = revealMs > 0 && revealMs <= Date.now();
        await tx.match.update({
          where: { id: other.id },
          data: {
            status: wasRevealed ? MatchStatus.COMPLETED : MatchStatus.WAITING,
          },
        });
        if (otherGame && !wasRevealed) {
          // 未公開のままWAITINGへ戻す場合は予約状態もリセット
          // (残っているBullジョブは照合ガードでスキップされる)
          await tx.game.update({
            where: { id: otherGame.id },
            data: { passcodeRevealTime: null },
          });
        }
        if (otherGame) {
          sideEffects.push({
            gameId: otherGame.id,
            status: wasRevealed ? MatchStatus.COMPLETED : MatchStatus.WAITING,
          });
        }
      }

      const statusChanged = targetMatch.status !== MatchStatus.IN_PROGRESS;
      if (statusChanged) {
        await tx.match.update({
          where: { id: targetMatch.id },
          data: { status: MatchStatus.IN_PROGRESS },
        });
      }

      const revealAt = new Date(Date.now() + countdownSeconds * 1000);
      const passcodeChanged =
        options.passcode != null && options.passcode !== game.passcode;

      const updatedGame = await tx.game.update({
        where: { id: game.id },
        data: {
          passcodeRevealTime: revealAt,
          ...(options.passcode != null && { passcode: options.passcode }),
          ...(passcodeChanged && { splitNotified: false }),
          ...(options.league && { leagueType: options.league }),
        },
      });

      // リーグ変更はconfig.roundsにも反映(Web表示・Discord embedの整合)
      let rounds = config.rounds as Array<{
        roundNumber: number;
        inGameMode: string;
        league?: string;
        offsetMinutes?: number;
      }>;
      if (options.league) {
        rounds = rounds.map((r) =>
          r.roundNumber === targetMatch.matchNumber
            ? { ...r, league: options.league }
            : r,
        );
        await tx.tournamentConfig.update({
          where: { id: tournamentConfigId },
          data: { rounds: rounds as unknown as Prisma.InputJsonValue },
        });
      }

      return {
        gameId: game.id,
        matchNumber: targetMatch.matchNumber!,
        passcodeVersion: updatedGame.passcodeVersion,
        passcodeRevealTime: revealAt.toISOString(),
        rounds,
        statusChanged,
        sideEffects,
        tournament: await this.findOne(tournamentConfigId, tx),
      };
    });

    this.eventEmitter.emit('game.passcodeCountdownStarted', {
      gameId: result.gameId,
      passcodeRevealTime: result.passcodeRevealTime,
    });

    if (needsStatusReset || result.statusChanged) {
      this.eventEmitter.emit('game.statusChanged', {
        gameId: result.gameId,
        status: MatchStatus.IN_PROGRESS,
      });
    }
    for (const effect of result.sideEffects) {
      this.eventEmitter.emit('game.statusChanged', effect);
    }

    // Discord: countdown embed now, passcode reveal via durable Bull job
    const meta = this.getRoundMeta(
      { ...config, rounds: result.rounds },
      result.matchNumber,
    );
    await this.schedulePasscodeReveal({
      gameId: result.gameId,
      tournamentConfigId,
      matchNumber: result.matchNumber,
      revealAt: new Date(result.passcodeRevealTime),
      passcodeVersion: result.passcodeVersion,
      ...meta,
      deleteExistingMessage: true,
    });

    return result.tournament;
  }

  async notifySplit(tournamentConfigId: number) {
    const config = await this.prisma.tournamentConfig.findUnique({
      where: { id: tournamentConfigId },
    });

    if (!config) throw new NotFoundException('Tournament not found');

    if (config.status !== TournamentStatus.IN_PROGRESS) {
      throw new BadRequestException('Tournament is not in progress');
    }

    const currentMatch = await this.prisma.match.findFirst({
      where: {
        seasonId: config.seasonId,
        status: MatchStatus.IN_PROGRESS,
      },
      include: { games: { take: 1 } },
      orderBy: { matchNumber: 'asc' },
    });

    if (!currentMatch) {
      throw new BadRequestException('No in-progress round found');
    }

    const { tournamentName, roundLabel, inGameMode } = this.getRoundMeta(
      config,
      currentMatch.matchNumber!,
    );
    await this.discordBotService.announceTournamentSplit({
      tournamentName,
      roundLabel,
      inGameMode,
    });

    // Set DB flag + notify all clients via WebSocket (skipDiscord: already sent above)
    const gameId = currentMatch.games[0]?.id;
    if (gameId) {
      await this.prisma.game.update({
        where: { id: gameId },
        data: { splitNotified: true },
      });
      this.eventEmitter.emit('game.splitVoteThresholdReached', {
        gameId,
        currentVotes: 0,
        requiredVotes: 0,
        seasonId: config.seasonId,
        matchNumber: currentMatch.matchNumber,
        skipDiscord: true,
      });
    }

    return { message: 'Split notification sent' };
  }

  @OnEvent('game.splitVoteThresholdReached')
  async handleSplitVoteThresholdReached(payload: {
    gameId: number;
    seasonId: number;
    matchNumber: number;
    skipDiscord?: boolean;
  }) {
    if (payload.skipDiscord) return;

    const config = await this.prisma.tournamentConfig.findFirst({
      where: { seasonId: payload.seasonId },
    });
    if (!config) return;

    const { tournamentName, roundLabel, inGameMode } = this.getRoundMeta(
      config,
      payload.matchNumber,
    );
    await this.discordBotService.announceTournamentSplit({
      tournamentName,
      roundLabel,
      inGameMode,
    });

    this.logger.log(
      `Auto split notification sent for ${roundLabel} (gameId: ${payload.gameId})`,
    );
  }

  async regeneratePasscode(
    tournamentConfigId: number,
    countdownSeconds = PASSCODE_COUNTDOWN_SECONDS,
  ) {
    const config = await this.prisma.tournamentConfig.findUnique({
      where: { id: tournamentConfigId },
      include: { season: true },
    });

    if (!config) throw new NotFoundException('Tournament not found');

    if (config.status !== TournamentStatus.IN_PROGRESS) {
      throw new BadRequestException('Tournament is not in progress');
    }

    const currentMatch = await this.prisma.match.findFirst({
      where: {
        seasonId: config.seasonId,
        status: MatchStatus.IN_PROGRESS,
      },
      include: { games: { take: 1 } },
      orderBy: { matchNumber: 'asc' },
    });

    if (!currentMatch?.games[0]) {
      throw new BadRequestException('No active game found');
    }

    const game = currentMatch.games[0];
    const newPasscode = this.generatePasscode();
    const revealAt = new Date(Date.now() + countdownSeconds * 1000);

    const updatedGame = await this.prisma.game.update({
      where: { id: game.id },
      data: {
        passcode: newPasscode,
        passcodeVersion: { increment: 1 },
        passcodeRevealTime: revealAt,
        splitNotified: false,
      },
    });

    this.eventEmitter.emit('game.passcodeCountdownStarted', {
      gameId: game.id,
      passcodeRevealTime: revealAt.toISOString(),
    });

    // Discord: delete existing passcode message, send countdown, schedule reveal
    const meta = this.getRoundMeta(config, currentMatch.matchNumber!);
    const revealTs = Math.floor(revealAt.getTime() / 1000);
    await this.schedulePasscodeReveal({
      gameId: game.id,
      tournamentConfigId,
      matchNumber: currentMatch.matchNumber!,
      revealAt,
      passcodeVersion: updatedGame.passcodeVersion,
      ...meta,
      countdownDescription: `Split — New passcode reveals <t:${revealTs}:R>`,
      deleteExistingMessage: true,
    });

    return this.findOne(tournamentConfigId);
  }

  async assignDiscordRoles(tournamentConfigId: number) {
    const config = await this.prisma.tournamentConfig.findUnique({
      where: { id: tournamentConfigId },
    });

    if (!config) throw new NotFoundException('Tournament not found');

    const registrations = await this.prisma.tournamentRegistration.findMany({
      where: { tournamentConfigId },
      include: {
        user: {
          select: { discordId: true, displayName: true },
        },
      },
    });

    // 全参加者(重複除去) + 部門別リスト
    const idsOf = (division?: TournamentDivision) => [
      ...new Set(
        registrations
          .filter((r) => !division || r.division === division)
          .map((r) => r.user.discordId)
          .filter((id): id is string => !!id),
      ),
    ];

    const result = await this.discordBotService.syncTournamentRoles({
      all: idsOf(),
      byDivision: {
        [TournamentDivision.GP]: idsOf(TournamentDivision.GP),
        [TournamentDivision.CLASSIC]: idsOf(TournamentDivision.CLASSIC),
      },
    });

    // Map notInServer discord IDs back to display names
    const discordIdToName = new Map(
      registrations.map((r) => [r.user.discordId, r.user.displayName]),
    );

    return {
      assigned: result.assigned,
      alreadyHad: result.alreadyHad,
      removed: result.removed,
      notInServer: result.notInServer.map((discordId) => ({
        displayName: discordIdToName.get(discordId) || discordId,
        discordId,
      })),
    };
  }

  // 部門別のテスト投稿(チャンネル設定の事前確認用)
  async testDiscordPasscodeChannels(tournamentConfigId: number) {
    const config = await this.prisma.tournamentConfig.findUnique({
      where: { id: tournamentConfigId },
    });
    if (!config) throw new NotFoundException('Tournament not found');

    const results: Array<{
      division: TournamentDivision;
      channelId: string | null;
      usedFallback: boolean;
      ok: boolean;
    }> = [];
    for (const division of Object.values(TournamentDivision)) {
      results.push(
        await this.discordBotService.postTournamentTestMessage(division),
      );
    }
    return results;
  }

  async getStreams(tournamentConfigId: number) {
    return this.prisma.tournamentStream.findMany({
      where: { tournamentConfigId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async addStream(
    tournamentConfigId: number,
    dto: {
      platform: 'YOUTUBE' | 'TWITCH';
      channelIdentifier: string;
      label: string;
    },
  ) {
    const config = await this.prisma.tournamentConfig.findUnique({
      where: { id: tournamentConfigId },
    });
    if (!config) {
      throw new NotFoundException('Tournament not found');
    }

    const maxSort = await this.prisma.tournamentStream.aggregate({
      where: { tournamentConfigId },
      _max: { sortOrder: true },
    });

    return this.prisma.tournamentStream.create({
      data: {
        tournamentConfigId,
        platform: dto.platform as StreamPlatform,
        channelIdentifier: dto.channelIdentifier,
        label: dto.label,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
    });
  }

  async removeStream(streamId: number) {
    const stream = await this.prisma.tournamentStream.findUnique({
      where: { id: streamId },
    });
    if (!stream) {
      throw new NotFoundException('Stream not found');
    }

    await this.prisma.tournamentStream.delete({ where: { id: streamId } });
    return { message: 'Stream removed' };
  }

  async setFeaturedStream(tournamentConfigId: number, streamId: number) {
    await this.prisma.$transaction([
      this.prisma.tournamentStream.updateMany({
        where: { tournamentConfigId },
        data: { isFeatured: false },
      }),
      this.prisma.tournamentStream.update({
        where: { id: streamId },
        data: { isFeatured: true },
      }),
    ]);
    return this.prisma.tournamentStream.findMany({
      where: { tournamentConfigId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getRecentCompleted(limit: number = 5) {
    const configs = await this.prisma.tournamentConfig.findMany({
      where: {
        status: {
          in: [TournamentStatus.COMPLETED, TournamentStatus.RESULTS_PENDING],
        },
      },
      orderBy: { tournamentDate: 'desc' },
      take: limit,
      include: {
        _count: { select: { registrations: true } },
      },
    });

    const seasonIds = configs.map((c) => c.seasonId);

    // Get the top scorer per season (sum of totalScore across all games)
    const winners = seasonIds.length
      ? await this.prisma.$queryRaw<
          Array<{
            seasonId: number;
            userId: number;
            displayName: string | null;
            totalScore: bigint;
          }>
        >`
          SELECT m."seasonId" AS "seasonId", gp."userId" AS "userId", u."displayName" AS "displayName",
                 SUM(gp."totalScore") AS "totalScore"
          FROM game_participants gp
          JOIN games g ON g.id = gp."gameId"
          JOIN matches m ON m.id = g."matchId"
          JOIN users u ON u.id = gp."userId"
          WHERE m."seasonId" IN (${Prisma.join(seasonIds)})
            AND gp."totalScore" IS NOT NULL
          GROUP BY m."seasonId", gp."userId", u."displayName"
          ORDER BY m."seasonId", SUM(gp."totalScore") DESC
        `
      : [];

    // Build a map: seasonId → top 3 scorers, plus the full top-tied set
    const topScorersMap = new Map<
      number,
      Array<{
        rank: number;
        id: number;
        displayName: string | null;
        totalScore: number;
      }>
    >();
    const allByseasonId = new Map<
      number,
      Array<{ id: number; displayName: string | null; totalScore: number }>
    >();
    for (const w of winners) {
      const entry = {
        id: w.userId,
        displayName: w.displayName,
        totalScore: Number(w.totalScore),
      };
      const all = allByseasonId.get(w.seasonId) ?? [];
      all.push(entry);
      allByseasonId.set(w.seasonId, all);

      const list = topScorersMap.get(w.seasonId) ?? [];
      if (list.length < 3) {
        list.push({ rank: list.length + 1, ...entry });
        topScorersMap.set(w.seasonId, list);
      }
    }

    return configs.map((c) => {
      const topScorers = topScorersMap.get(c.seasonId) ?? [];
      const all = allByseasonId.get(c.seasonId) ?? [];
      const topScore = all[0]?.totalScore ?? null;
      const tiedWinners =
        topScore !== null ? all.filter((s) => s.totalScore === topScore) : [];
      return {
        id: c.id,
        name: c.name,
        tournamentNumber: c.tournamentNumber,
        status: c.status,
        tournamentDate: c.tournamentDate,
        totalRounds: c.totalRounds,
        participantCount: c._count.registrations,
        winner: tiedWinners[0] ?? null,
        winners: tiedWinners,
        topScorers,
      };
    });
  }

  async getParticipants(tournamentConfigId: number) {
    const config = await this.prisma.tournamentConfig.findUnique({
      where: { id: tournamentConfigId },
    });

    if (!config) {
      throw new NotFoundException('Tournament not found');
    }

    return this.prisma.tournamentRegistration.findMany({
      where: { tournamentConfigId },
      include: {
        user: {
          select: {
            id: true,
            profileNumber: true,
            discordId: true,
            displayName: true,
            avatarHash: true,
            profile: { select: { country: true } },
          },
        },
      },
      orderBy: { registeredAt: 'asc' },
    });
  }
}
