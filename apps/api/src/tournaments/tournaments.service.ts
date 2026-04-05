import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { EventCategory, TournamentStatus } from '@prisma/client';

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
  constructor(private prisma: PrismaService) {}

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
                games: true,
                participants: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        profileNumber: true,
                        displayName: true,
                        avatarHash: true,
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

    await this.prisma.tournamentConfig.update({
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

    return this.findOne(id);
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
          },
        },
      },
      orderBy: { registeredAt: 'asc' },
    });
  }
}
