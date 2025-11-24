import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GameMode, LobbyStatus } from '@prisma/client';
import { SubmitScoreDto } from './dto/submit-score.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class MatchesService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async getById(matchId: string, userId?: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        lobby: {
          include: {
            event: {
              include: {
                season: true,
                tournament: true,
              },
            },
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    profileId: true,
                    discordId: true,
                    displayName: true,
                    avatarHash: true,
                  },
                },
              },
            },
          },
        },
        participants: {
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
          orderBy: {
            finalPoints: 'desc',
          },
        },
      },
    });

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    // Check if user is a participant
    const matchWithLobby = match as any; // Type assertion for lobby relation
    const isParticipant = userId
      ? matchWithLobby.lobby?.participants?.some((p: any) => p.userId === userId) || false
      : false;

    // Only show passcode to participants
    if (!isParticipant) {
      const { passcode, ...matchWithoutPasscode } = match;
      return matchWithoutPasscode;
    }

    return match;
  }

  async getByModeSeasonGame(
    gameMode: GameMode,
    seasonNumber: number,
    gameNumber: number,
    userId?: string,
  ) {
    // Find match by gameMode, season number, and game number
    const match = await this.prisma.match.findFirst({
      where: {
        gameMode,
        lobby: {
          gameNumber,
          event: {
            season: {
              seasonNumber,
            },
          },
        },
      },
      include: {
        lobby: {
          include: {
            event: {
              include: {
                season: true,
                tournament: true,
              },
            },
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    profileId: true,
                    discordId: true,
                    displayName: true,
                    avatarHash: true,
                  },
                },
              },
            },
          },
        },
        participants: {
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
          orderBy: {
            finalPoints: 'desc',
          },
        },
      },
    });

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    // Check if user is a participant
    const matchWithLobby = match as any; // Type assertion for lobby relation
    const isParticipant = userId
      ? matchWithLobby.lobby?.participants?.some((p: any) => p.userId === userId) || false
      : false;

    // Only show passcode to participants
    if (!isParticipant) {
      const { passcode, ...matchWithoutPasscode } = match;
      return matchWithoutPasscode;
    }

    return match;
  }

  async submitScore(matchId: string, userId: string, submitScoreDto: SubmitScoreDto) {
    // Find the match and verify it's in progress
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        lobby: true,
        participants: {
          where: { userId },
        },
      },
    });

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    // Check lobby status - allow score submission during IN_PROGRESS
    if (match.lobby.status !== LobbyStatus.IN_PROGRESS) {
      throw new BadRequestException('Cannot submit score - match is not in progress');
    }

    // Check if user is a participant
    if (!match.participants.length) {
      // User is not a participant yet, add them
      const participant = await this.prisma.matchParticipant.create({
        data: {
          matchId,
          userId,
          machine: submitScoreDto.machine,
          position: submitScoreDto.position,
          reportedPoints: submitScoreDto.reportedPoints,
          assistEnabled: submitScoreDto.assistEnabled,
        },
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

      // Emit event for real-time update
      this.eventEmitter.emit('match.scoreUpdated', {
        matchId,
        participant,
      });

      return participant;
    } else {
      // Update existing participant's score
      const participant = await this.prisma.matchParticipant.update({
        where: {
          id: match.participants[0].id,
        },
        data: {
          machine: submitScoreDto.machine,
          position: submitScoreDto.position,
          reportedPoints: submitScoreDto.reportedPoints,
          assistEnabled: submitScoreDto.assistEnabled,
        },
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

      // Emit event for real-time update
      this.eventEmitter.emit('match.scoreUpdated', {
        matchId,
        participant,
      });

      return participant;
    }
  }

  async submitScoreByModeSeasonGame(
    gameMode: GameMode,
    seasonNumber: number,
    gameNumber: number,
    userId: string,
    submitScoreDto: SubmitScoreDto,
  ) {
    // Find match by gameMode, season number, and game number
    const match = await this.prisma.match.findFirst({
      where: {
        gameMode,
        lobby: {
          gameNumber,
          event: {
            season: {
              seasonNumber,
            },
          },
        },
      },
    });

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    return this.submitScore(match.id, userId, submitScoreDto);
  }
}
