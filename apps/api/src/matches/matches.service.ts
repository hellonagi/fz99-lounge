import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GameMode } from '@prisma/client';

@Injectable()
export class MatchesService {
  constructor(private prisma: PrismaService) {}

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
}
