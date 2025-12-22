import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventCategory, MatchStatus, ResultStatus } from '@prisma/client';
import { SubmitScoreDto } from './dto/submit-score.dto';
import { UpdateScoreDto } from './dto/update-score.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClassicRatingService } from '../rating/classic-rating.service';

@Injectable()
export class GamesService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    private classicRatingService: ClassicRatingService,
  ) {}

  async getById(gameId: number, userId?: number) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        match: {
          include: {
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
                profile: {
                  select: { country: true },
                },
              },
            },
            raceResults: true,
          },
        },
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Check if user is a participant
    const isParticipant = userId
      ? game.match?.participants?.some((p) => p.userId === userId) || false
      : false;

    // Only show passcode to participants
    if (!isParticipant) {
      const { passcode, ...gameWithoutPasscode } = game;
      return gameWithoutPasscode;
    }

    return game;
  }

  async getByEventSeasonMatch(
    eventCategory: EventCategory,
    seasonNumber: number,
    matchNumber: number,
    gameNumber: number = 1,
    userId?: number,
  ) {
    // Find game by event category, season number, match number, and sequence
    const game = await this.prisma.game.findFirst({
      where: {
        gameNumber,
        match: {
          matchNumber,
          season: {
            seasonNumber,
            event: {
              category: eventCategory,
            },
          },
        },
      },
      include: {
        match: {
          include: {
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
                        season: {
                          seasonNumber,
                          event: {
                            category: eventCategory,
                          },
                        },
                      },
                      select: {
                        displayRating: true,
                      },
                    },
                  },
                },
              },
            },
            ratingHistories: true,
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
                profile: {
                  select: { country: true },
                },
              },
            },
            raceResults: true,
          },
        },
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Build rating map from rating histories
    const ratingMap = new Map<number, { displayRating: number }>();
    if (game.match?.ratingHistories) {
      for (const rh of game.match.ratingHistories) {
        ratingMap.set(rh.userId, { displayRating: rh.displayRating });
      }
    }

    // Get previous ratings for each user to calculate change
    const userIds = game.participants.map(p => p.userId);
    const previousRatings = await this.prisma.ratingHistory.findMany({
      where: {
        userId: { in: userIds },
        matchId: { lt: game.matchId }, // Matches before this one
      },
      orderBy: { createdAt: 'desc' },
      distinct: ['userId'],
    });
    const previousRatingMap = new Map<number, number>();
    for (const pr of previousRatings) {
      previousRatingMap.set(pr.userId, pr.displayRating);
    }

    // Add rating info to participants
    const participantsWithRating = game.participants.map(p => {
      const currentRating = ratingMap.get(p.userId);
      const previousRating = previousRatingMap.get(p.userId) ?? 0; // 0 if first match
      const ratingAfter = currentRating?.displayRating ?? null;
      const ratingChange = ratingAfter !== null ? ratingAfter - previousRating : null;

      return {
        ...p,
        ratingAfter,
        ratingChange,
      };
    });

    // Replace participants with enhanced version
    const gameWithRatings = {
      ...game,
      participants: participantsWithRating,
    };

    // Check if user is a participant
    const isParticipant = userId
      ? game.match?.participants?.some((p) => p.userId === userId) || false
      : false;

    // Only show passcode to participants
    if (!isParticipant) {
      const { passcode, ...gameWithoutPasscode } = gameWithRatings;
      return gameWithoutPasscode;
    }

    return gameWithRatings;
  }

  /**
   * Submit score for a game
   * TODO: Refactor for new RaceResult-based schema
   * Current implementation creates GameParticipant with basic info,
   * RaceResult submission needs to be implemented separately
   */
  async submitScore(gameId: number, userId: number, submitScoreDto: SubmitScoreDto) {
    // Find the game and verify it's in progress
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        match: {
          include: {
            participants: true,
          },
        },
        participants: {
          where: { userId },
        },
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Check match status - allow score submission during IN_PROGRESS
    if (game.match.status !== MatchStatus.IN_PROGRESS) {
      throw new BadRequestException('Cannot submit score - match is not in progress');
    }

    const now = new Date();
    let participantId: number;

    // Check if user is a participant
    if (!game.participants.length) {
      // User is not a participant yet, add them
      const participant = await this.prisma.gameParticipant.create({
        data: {
          gameId,
          userId,
          machine: submitScoreDto.machine,
          assistEnabled: submitScoreDto.assistEnabled,
          status: ResultStatus.SUBMITTED,
          submittedAt: now,
        },
      });
      participantId = participant.id;
    } else {
      // Update existing participant's status
      await this.prisma.gameParticipant.update({
        where: {
          id: game.participants[0].id,
        },
        data: {
          machine: submitScoreDto.machine,
          assistEnabled: submitScoreDto.assistEnabled,
          status: ResultStatus.SUBMITTED,
          submittedAt: now,
        },
      });
      participantId = game.participants[0].id;
    }

    // Handle race results for CLASSIC mode
    if (submitScoreDto.raceResults && submitScoreDto.raceResults.length > 0) {
      // Delete existing race results for this participant
      await this.prisma.raceResult.deleteMany({
        where: { gameParticipantId: participantId },
      });

      let totalScore = 0;
      let eliminatedAtRace: number | null = null;

      // Create new race results and calculate totals
      for (const raceResult of submitScoreDto.raceResults) {
        const points = raceResult.isEliminated ? 0 : (raceResult.position ? this.calculateRacePoints(raceResult.position) : 0);

        await this.prisma.raceResult.create({
          data: {
            gameParticipantId: participantId,
            raceNumber: raceResult.raceNumber,
            position: raceResult.isEliminated ? null : (raceResult.position || null),
            points,
            isEliminated: raceResult.isEliminated,
          },
        });

        // Add to total (only non-eliminated races count)
        totalScore += points;

        // Track first elimination
        if (raceResult.isEliminated && eliminatedAtRace === null) {
          eliminatedAtRace = raceResult.raceNumber;
        }
      }

      // Update participant with calculated totals
      await this.prisma.gameParticipant.update({
        where: { id: participantId },
        data: {
          totalScore,
          eliminatedAtRace,
        },
      });
    }

    // Get the updated participant
    const updatedParticipant = await this.prisma.gameParticipant.findUnique({
      where: { id: participantId },
      include: {
        user: {
          select: {
            id: true,
            discordId: true,
            displayName: true,
            avatarHash: true,
            profile: {
              select: { country: true },
            },
          },
        },
        raceResults: true,
      },
    });

    // Emit event for real-time update
    this.eventEmitter.emit('game.scoreUpdated', {
      gameId,
      participant: updatedParticipant,
    });

    // Check if all participants have submitted
    await this.checkAndCompleteGame(gameId, game.matchId, game.match.participants.length);

    return updatedParticipant;
  }

  async submitScoreByEventSeasonMatch(
    eventCategory: EventCategory,
    seasonNumber: number,
    matchNumber: number,
    userId: number,
    submitScoreDto: SubmitScoreDto,
    gameNumber: number = 1,
  ) {
    // Find game by event category, season number, match number, and sequence
    const game = await this.prisma.game.findFirst({
      where: {
        gameNumber,
        match: {
          matchNumber,
          season: {
            seasonNumber,
            event: {
              category: eventCategory,
            },
          },
        },
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    return this.submitScore(game.id, userId, submitScoreDto);
  }

  /**
   * Update score for existing participant (moderator action)
   * Only updates race results, not machine/assist settings
   */
  async updateScoreByEventSeasonMatch(
    eventCategory: EventCategory,
    seasonNumber: number,
    matchNumber: number,
    userId: number,
    updateScoreDto: UpdateScoreDto,
    gameNumber: number = 1,
  ) {
    // Find game by event category, season number, match number, and sequence
    const game = await this.prisma.game.findFirst({
      where: {
        gameNumber,
        match: {
          matchNumber,
          season: {
            seasonNumber,
            event: {
              category: eventCategory,
            },
          },
        },
      },
      include: {
        match: true,
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Find existing participant
    const participant = await this.prisma.gameParticipant.findFirst({
      where: {
        gameId: game.id,
        userId,
      },
    });

    if (!participant) {
      throw new NotFoundException('Participant not found in this game');
    }

    // Delete existing race results
    await this.prisma.raceResult.deleteMany({
      where: { gameParticipantId: participant.id },
    });

    let totalScore = 0;
    let eliminatedAtRace: number | null = null;

    // Create new race results and calculate totals
    for (const raceResult of updateScoreDto.raceResults) {
      const points = raceResult.isEliminated
        ? 0
        : raceResult.position
          ? this.calculateRacePoints(raceResult.position)
          : 0;

      await this.prisma.raceResult.create({
        data: {
          gameParticipantId: participant.id,
          raceNumber: raceResult.raceNumber,
          position: raceResult.isEliminated ? null : (raceResult.position || null),
          points,
          isEliminated: raceResult.isEliminated,
        },
      });

      // Add to total (only non-eliminated races count)
      totalScore += points;

      // Track first elimination
      if (raceResult.isEliminated && eliminatedAtRace === null) {
        eliminatedAtRace = raceResult.raceNumber;
      }
    }

    // Update participant with calculated totals
    await this.prisma.gameParticipant.update({
      where: { id: participant.id },
      data: {
        totalScore,
        eliminatedAtRace,
        status: ResultStatus.SUBMITTED,
        submittedAt: new Date(),
      },
    });

    // Get the updated participant
    const updatedParticipant = await this.prisma.gameParticipant.findUnique({
      where: { id: participant.id },
      include: {
        user: {
          select: {
            id: true,
            discordId: true,
            displayName: true,
            avatarHash: true,
            profile: {
              select: { country: true },
            },
          },
        },
        raceResults: true,
      },
    });

    // Emit event for real-time update
    this.eventEmitter.emit('game.scoreUpdated', {
      gameId: game.id,
      participant: updatedParticipant,
    });

    return updatedParticipant;
  }

  /**
   * Calculate points from position (CLASSIC mode)
   * 1st = 100pts, 2nd = 95pts, 3rd = 90pts... (5pt decrements)
   * 20th = 5pts, eliminated = 0pts
   */
  private calculateRacePoints(position: number): number {
    if (position < 1 || position > 20) return 0;
    return 105 - (position * 5); // 1st=100, 2nd=95, 3rd=90...
  }

  /**
   * Check if all participants have submitted scores and auto-complete the game
   * Note: Rating calculation is now triggered at Match.deadline, not on score submission
   */
  private async checkAndCompleteGame(
    gameId: number,
    matchId: number,
    totalParticipants: number,
  ) {
    // Count how many participants have submitted scores
    const submittedCount = await this.prisma.gameParticipant.count({
      where: {
        gameId,
        status: ResultStatus.SUBMITTED,
      },
    });

    // If all participants have submitted, mark match as completed
    // Note: Final rating calculation happens at Match.deadline via scheduled job
    if (submittedCount >= totalParticipants) {
      await this.prisma.match.update({
        where: { id: matchId },
        data: { status: MatchStatus.COMPLETED },
      });

      // Emit event for real-time status update
      this.eventEmitter.emit('game.completed', {
        gameId,
        matchId,
        completedAt: new Date(),
      });
    }
  }

  /**
   * Manually end a match and calculate ratings
   * Only MODERATOR/ADMIN can call this
   */
  async endMatch(
    eventCategory: EventCategory,
    seasonNumber: number,
    matchNumber: number,
    gameNumber: number = 1,
  ) {
    // Find the game
    const game = await this.prisma.game.findFirst({
      where: {
        gameNumber,
        match: {
          matchNumber,
          season: {
            seasonNumber,
            event: {
              category: eventCategory,
            },
          },
        },
      },
      include: {
        match: {
          include: {
            season: {
              include: {
                event: true,
              },
            },
          },
        },
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Check if match is in a state that can be ended
    if (game.match.status !== MatchStatus.IN_PROGRESS && game.match.status !== MatchStatus.COMPLETED) {
      throw new BadRequestException(
        `Cannot end match - current status is ${game.match.status}`,
      );
    }

    // Update match status to COMPLETED
    await this.prisma.match.update({
      where: { id: game.matchId },
      data: {
        status: MatchStatus.COMPLETED,
      },
    });

    // Calculate ratings
    await this.classicRatingService.calculateAndUpdateRatings(game.id);

    // Emit event for real-time status update
    this.eventEmitter.emit('game.completed', {
      gameId: game.id,
      matchId: game.matchId,
      completedAt: new Date(),
    });

    return {
      success: true,
      message: `Match ended and ratings calculated for game ${game.id}`,
      gameId: game.id,
      matchId: game.matchId,
    };
  }
}
