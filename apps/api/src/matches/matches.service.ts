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
          orderBy: [
            {
              reportedPoints: { sort: 'desc', nulls: 'last' },
            },
          ],
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
          orderBy: [
            {
              reportedPoints: { sort: 'desc', nulls: 'last' },
            },
          ],
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
        lobby: {
          include: {
            participants: true,
          },
        },
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

    let participantId: string;

    // Check if user is a participant
    if (!match.participants.length) {
      // User is not a participant yet, add them
      const participant = await this.prisma.matchParticipant.create({
        data: {
          matchId,
          userId,
          machine: submitScoreDto.machine,
          position: null, // Position will be calculated based on points
          reportedPoints: submitScoreDto.reportedPoints,
          finalPoints: submitScoreDto.reportedPoints,
          assistEnabled: submitScoreDto.assistEnabled,
        },
      });
      participantId = participant.id;
    } else {
      // Update existing participant's score
      await this.prisma.matchParticipant.update({
        where: {
          id: match.participants[0].id,
        },
        data: {
          machine: submitScoreDto.machine,
          reportedPoints: submitScoreDto.reportedPoints,
          finalPoints: submitScoreDto.reportedPoints,
          assistEnabled: submitScoreDto.assistEnabled,
        },
      });
      participantId = match.participants[0].id;
    }

    // Calculate and update positions for all participants
    await this.updateMatchPositions(matchId);

    // Get the updated participant with position
    const updatedParticipant = await this.prisma.matchParticipant.findUnique({
      where: { id: participantId },
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
      participant: updatedParticipant,
    });

    // Check if all participants have submitted - auto complete match
    await this.checkAndCompleteMatch(matchId, match.lobby.id, match.lobby.participants.length);

    return updatedParticipant;
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

  /**
   * Update positions for all participants in a match based on their points
   * Handles tied rankings properly (e.g., #1, #1, #3, #4 for tied first place)
   */
  private async updateMatchPositions(matchId: string) {
    // Get all participants sorted by points (highest first)
    const participants = await this.prisma.matchParticipant.findMany({
      where: { matchId },
      orderBy: { finalPoints: 'desc' },
    });

    // Calculate positions with proper tie handling
    let currentRank = 1;
    let previousPoints: number | null = null;
    let participantsWithPoints = 0;

    for (let i = 0; i < participants.length; i++) {
      const participant = participants[i];

      // Skip if no points reported yet
      if (participant.finalPoints === null) {
        continue;
      }

      participantsWithPoints++;

      // If points changed from previous participant, update rank
      if (previousPoints !== null && previousPoints !== participant.finalPoints) {
        currentRank = participantsWithPoints;
      }

      // Update the participant's position
      await this.prisma.matchParticipant.update({
        where: { id: participant.id },
        data: { position: currentRank },
      });

      previousPoints = participant.finalPoints;
    }
  }

  /**
   * Check if all participants have submitted scores and auto-complete the match
   */
  private async checkAndCompleteMatch(matchId: string, lobbyId: string, totalParticipants: number) {
    // Count how many participants have submitted scores
    const submittedCount = await this.prisma.matchParticipant.count({
      where: {
        matchId,
        reportedPoints: { not: null },
      },
    });

    // If all participants have submitted, complete the match
    if (submittedCount >= totalParticipants) {
      await this.prisma.$transaction([
        // Update lobby status to COMPLETED
        this.prisma.lobby.update({
          where: { id: lobbyId },
          data: { status: LobbyStatus.COMPLETED },
        }),
        // Set match completedAt timestamp
        this.prisma.match.update({
          where: { id: matchId },
          data: { completedAt: new Date() },
        }),
      ]);

      // Emit event for real-time status update
      this.eventEmitter.emit('match.completed', {
        matchId,
        lobbyId,
        completedAt: new Date(),
      });
    }
  }
}
