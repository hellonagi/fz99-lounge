import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { EventCategory, MatchStatus, StreamPlatform, TournamentStatus } from '@prisma/client';

const STATUS_ORDER: TournamentStatus[] = [
  TournamentStatus.DRAFT,
  TournamentStatus.REGISTRATION_OPEN,
  TournamentStatus.REGISTRATION_CLOSED,
  TournamentStatus.IN_PROGRESS,
  TournamentStatus.RESULTS_PENDING,
  TournamentStatus.COMPLETED,
];

@Injectable()
export class TournamentsService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
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

  async findOne(id: number, tx?: any) {
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

    return {
      ...config,
      registrationCount: config._count.registrations,
      _count: undefined,
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

    // Validate status transition (forward only)
    if (dto.status) {
      const currentIdx = STATUS_ORDER.indexOf(existing.status);
      const newIdx = STATUS_ORDER.indexOf(dto.status);
      if (newIdx <= currentIdx) {
        throw new BadRequestException(
          `Cannot transition from ${existing.status} to ${dto.status}. Only forward transitions allowed.`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.tournamentConfig.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.totalRounds !== undefined && { totalRounds: dto.totalRounds }),
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
      if (dto.status === TournamentStatus.REGISTRATION_CLOSED) {
        await this.createMatchesForTournament(existing, tx);
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
    return Math.floor(Math.random() * 10000).toString().padStart(4, '0');
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

    // Get all registered participants
    const registrations = await tx.tournamentRegistration.findMany({
      where: { tournamentConfigId: config.id },
      select: { userId: true },
    });
    const userIds = registrations.map((r: { userId: number }) => r.userId);

    for (const round of rounds) {
      const scheduledStart = new Date(config.tournamentDate);
      if (round.offsetMinutes) {
        scheduledStart.setMinutes(scheduledStart.getMinutes() + round.offsetMinutes);
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

  async advanceRound(tournamentConfigId: number) {
    const config = await this.prisma.tournamentConfig.findUnique({
      where: { id: tournamentConfigId },
      include: { season: true },
    });

    if (!config) {
      throw new NotFoundException('Tournament not found');
    }

    if (config.status !== TournamentStatus.IN_PROGRESS) {
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

  async register(tournamentConfigId: number, userId: number, prizeEntry?: boolean) {
    const config = await this.prisma.tournamentConfig.findUnique({
      where: { id: tournamentConfigId },
      include: { _count: { select: { registrations: true } } },
    });

    if (!config) {
      throw new NotFoundException('Tournament not found');
    }

    if (config.status !== TournamentStatus.REGISTRATION_OPEN) {
      throw new BadRequestException('Registration is not open');
    }

    const now = new Date();
    if (now < config.registrationStart || now > config.registrationEnd) {
      throw new BadRequestException('Registration period has ended or not started');
    }

    if (config._count.registrations >= config.maxPlayers) {
      throw new BadRequestException('Tournament is full');
    }

    try {
      await this.prisma.tournamentRegistration.create({
        data: {
          userId,
          tournamentConfigId,
          prizeEntry: prizeEntry ?? false,
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new BadRequestException('Already registered');
      }
      throw error;
    }

    return { message: 'Registered successfully' };
  }

  async cancelRegistration(tournamentConfigId: number, userId: number) {
    const config = await this.prisma.tournamentConfig.findUnique({
      where: { id: tournamentConfigId },
    });

    if (!config) {
      throw new NotFoundException('Tournament not found');
    }

    if (config.status !== TournamentStatus.REGISTRATION_OPEN) {
      throw new BadRequestException('Cannot cancel registration at this stage');
    }

    const now = new Date();
    if (now < config.registrationStart || now > config.registrationEnd) {
      throw new BadRequestException('Registration period has ended or not started');
    }

    const registration = await this.prisma.tournamentRegistration.findUnique({
      where: {
        userId_tournamentConfigId: {
          userId,
          tournamentConfigId,
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

  async getStreams(tournamentConfigId: number) {
    return this.prisma.tournamentStream.findMany({
      where: { tournamentConfigId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async addStream(
    tournamentConfigId: number,
    dto: { platform: 'YOUTUBE' | 'TWITCH'; channelIdentifier: string; label: string },
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
