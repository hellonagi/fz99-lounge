import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { CreateMatchDto } from './dto/create-match.dto';
import { EventCategory, MatchStatus, UserStatus } from '@prisma/client';

@Injectable()
export class MatchesService {
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

  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
    @InjectQueue('matches') private matchQueue: Queue,
  ) {}

  async create(createMatchDto: CreateMatchDto, createdBy: number) {
    const { seasonId, inGameMode, leagueType, scheduledStart, minPlayers, maxPlayers, notes } =
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

    // Check if there's already a WAITING match for this season
    const existingWaitingMatch = await this.prisma.match.findFirst({
      where: {
        seasonId,
        status: MatchStatus.WAITING,
      },
    });

    if (existingWaitingMatch) {
      throw new BadRequestException(
        `A WAITING match already exists for this season (Match #${existingWaitingMatch.matchNumber})`,
      );
    }

    // Get next match number
    const lastMatch = await this.prisma.match.findFirst({
      where: { seasonId },
      orderBy: { matchNumber: 'desc' },
    });

    const matchNumber = lastMatch ? lastMatch.matchNumber + 1 : 1;

    // Create match and game in a transaction
    const match = await this.prisma.$transaction(async (tx) => {
      const scheduledDate = new Date(scheduledStart);
      // Default deadline is 1 hour after scheduled start
      const deadlineDate = new Date(scheduledDate.getTime() + 60 * 60 * 1000);

      const newMatch = await tx.match.create({
        data: {
          seasonId,
          matchNumber,
          scheduledStart: scheduledDate,
          deadline: deadlineDate,
          minPlayers: minPlayers || 4,
          maxPlayers: maxPlayers || 20,
          createdBy,
          notes,
          status: MatchStatus.WAITING,
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
        },
      });

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
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );
    }

    return matchWithIncludes;
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
    // WAITINGマッチを検索
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
          in: [MatchStatus.COMPLETED, MatchStatus.FINALIZED, MatchStatus.IN_PROGRESS],
        },
      },
      orderBy: { actualStart: 'desc' },
      take: limit,
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
              orderBy: { totalScore: 'desc' },
              take: 1,
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

    // Format the response
    return matches.map((match) => {
      const game = match.games[0];
      const winner = game?.participants[0];

      return {
        id: match.id,
        matchNumber: match.matchNumber,
        category: match.season.event.category,
        seasonNumber: match.season.seasonNumber,
        playerCount: match.participants.length,
        status: match.status,
        startedAt: match.actualStart,
        winner: winner
          ? {
              id: winner.user.id,
              displayName: winner.user.displayName,
              totalScore: winner.totalScore,
            }
          : null,
      };
    });
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
    const match = await this.getById(matchId);

    // Only allow cancellation of WAITING or IN_PROGRESS matches
    if (match.status !== MatchStatus.WAITING && match.status !== MatchStatus.IN_PROGRESS) {
      throw new BadRequestException('Can only cancel matches in WAITING or IN_PROGRESS status');
    }

    // Update match status to CANCELLED
    const updatedMatch = await this.prisma.match.update({
      where: { id: matchId },
      data: { status: MatchStatus.CANCELLED },
      include: this.matchDetailInclude,
    });

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

    // Delete all related participants and match in a transaction
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
    });

    return { message: 'Match deleted successfully' };
  }
}
