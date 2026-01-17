import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventCategory } from '@prisma/client';
import {
  CLASSIC_CONFIG,
  ParticipantWithRating,
} from './classic-rating.constants';
import { calculateRatingChanges } from './classic-rating.algorithm';

@Injectable()
export class ClassicRatingService {
  private readonly logger = new Logger(ClassicRatingService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Calculate median of an array of numbers
   */
  private calculateMedian(values: number[]): number | null {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
  }

  /**
   * Calculate median stats for a user in a season
   */
  private async calculateMedianStats(
    tx: any,
    userId: number,
    seasonId: number,
  ): Promise<{
    medianPosition: number | null;
    medianPoints: number | null;
    favoriteMachine: string | null;
  }> {
    // Get all verified game participations for this user in this season
    const userParticipations = await tx.gameParticipant.findMany({
      where: {
        userId,
        status: 'VERIFIED',
        game: { match: { seasonId } },
      },
      select: {
        totalScore: true,
        machine: true,
        gameId: true,
      },
    });

    if (userParticipations.length === 0) {
      return { medianPosition: null, medianPoints: null, favoriteMachine: null };
    }

    // Get all game IDs
    const gameIds = userParticipations.map((p: { gameId: number }) => p.gameId);

    // Get all participants for these games to calculate positions
    const allParticipants = await tx.gameParticipant.findMany({
      where: {
        gameId: { in: gameIds },
        status: 'VERIFIED',
      },
      select: {
        gameId: true,
        userId: true,
        totalScore: true,
      },
    });

    // Group participants by game and calculate positions
    const gameParticipantsMap = new Map<number, Array<{ userId: number; totalScore: number }>>();
    for (const p of allParticipants) {
      const list = gameParticipantsMap.get(p.gameId) || [];
      list.push({ userId: p.userId, totalScore: p.totalScore ?? 0 });
      gameParticipantsMap.set(p.gameId, list);
    }

    // Calculate user's position in each game
    const positions: number[] = [];
    const points: number[] = [];
    const machineCount = new Map<string, number>();

    for (const userPart of userParticipations) {
      const gameParticipants = gameParticipantsMap.get(userPart.gameId) || [];
      // Sort by score descending
      const sorted = [...gameParticipants].sort((a, b) => b.totalScore - a.totalScore);

      // Find user's position (with tie handling)
      let position = 1;
      let prevScore: number | null = null;
      let sameCount = 0;
      for (const p of sorted) {
        if (prevScore !== null && p.totalScore === prevScore) {
          sameCount++;
        } else {
          position += sameCount;
          sameCount = 1;
        }
        if (p.userId === userId) {
          positions.push(position);
          break;
        }
        prevScore = p.totalScore;
      }

      points.push(userPart.totalScore ?? 0);

      // Count machine usage
      if (userPart.machine) {
        machineCount.set(userPart.machine, (machineCount.get(userPart.machine) || 0) + 1);
      }
    }

    // Find favorite machine
    let favoriteMachine: string | null = null;
    let maxCount = 0;
    for (const [machine, count] of machineCount.entries()) {
      if (count > maxCount) {
        maxCount = count;
        favoriteMachine = machine;
      }
    }

    return {
      medianPosition: this.calculateMedian(positions),
      medianPoints: this.calculateMedian(points),
      favoriteMachine,
    };
  }

  /**
   * Main entry point: Calculate and update ratings for all participants in a game
   */
  async calculateAndUpdateRatings(gameId: number): Promise<void> {
    this.logger.log(`[CLASSIC] Calculating ratings for game ${gameId}`);

    // Get game and participants
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        participants: {
          where: {
            status: 'VERIFIED',
          },
          include: {
            user: true,
          },
        },
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
      throw new Error(`Game ${gameId} not found`);
    }

    const eventCategory = game.match.season.event.category;
    if (eventCategory !== EventCategory.CLASSIC) {
      throw new Error(
        `Game ${gameId} is not CLASSIC mode (got ${eventCategory})`,
      );
    }

    const seasonId = game.match.seasonId;

    // Sort participants by position
    const sortedParticipants = this.sortAndRankParticipants(game.participants);

    // Skip if less than 2 participants (Elo requires at least 2)
    if (sortedParticipants.length < 2) {
      this.logger.warn(
        `[CLASSIC] Skipping rating calculation for game ${gameId}: only ${sortedParticipants.length} participant(s)`,
      );
      return;
    }

    // Get or create season stats for each participant
    const participantsWithRatings: ParticipantWithRating[] = [];

    for (const p of sortedParticipants) {
      let seasonStats = await this.prisma.userSeasonStats.findUnique({
        where: {
          userId_seasonId: {
            userId: p.userId,
            seasonId: seasonId,
          },
        },
      });

      if (!seasonStats) {
        // New player: create with initial rating
        seasonStats = await this.prisma.userSeasonStats.create({
          data: {
            userId: p.userId,
            seasonId: seasonId,
            internalRating: CLASSIC_CONFIG.INITIAL_RATING,
            seasonHighRating: 0,
            displayRating: 0,
            totalMatches: 0,
          },
        });
      }

      participantsWithRatings.push({
        participantId: p.id,
        userId: p.userId,
        position: p.calculatedPosition,
        totalScore: p.totalScore ?? 0,
        eliminatedAtRace: p.eliminatedAtRace,
        currentRating: seasonStats.internalRating,
        currentSeasonHigh: seasonStats.seasonHighRating,
        gamesPlayed: seasonStats.totalMatches,
        currentDisplayRating: seasonStats.displayRating,
        currentConvergencePoints: seasonStats.convergencePoints,
      });
    }

    // Calculate rating changes using the algorithm
    const ratingChanges = calculateRatingChanges(participantsWithRatings);

    // Update database in transaction
    await this.prisma.$transaction(async (tx) => {
      for (const change of ratingChanges) {
        const participant = participantsWithRatings.find(
          (p) => p.userId === change.userId,
        )!;

        // Calculate median stats for this user
        const medianStats = await this.calculateMedianStats(
          tx,
          change.userId,
          seasonId,
        );

        // Update UserSeasonStats
        await tx.userSeasonStats.update({
          where: {
            userId_seasonId: {
              userId: change.userId,
              seasonId: seasonId,
            },
          },
          data: {
            internalRating: change.newInternalRating,
            seasonHighRating: Math.max(
              change.newSeasonHigh,
              change.newDisplayRating,
            ),
            displayRating: change.newDisplayRating,
            convergencePoints: change.newConvergencePoints,
            totalMatches: { increment: 1 },
            totalPoints: { increment: participant.totalScore ?? 0 },
            totalPositions: { increment: participant.position },
            firstPlaces:
              participant.position === 1 ? { increment: 1 } : undefined,
            secondPlaces:
              participant.position === 2 ? { increment: 1 } : undefined,
            thirdPlaces:
              participant.position === 3 ? { increment: 1 } : undefined,
            survivedCount:
              participant.eliminatedAtRace === null
                ? { increment: 1 }
                : undefined,
            medianPosition: medianStats.medianPosition,
            medianPoints: medianStats.medianPoints,
            favoriteMachine: medianStats.favoriteMachine,
          },
        });

        // Record rating history
        await tx.ratingHistory.create({
          data: {
            userId: change.userId,
            matchId: game.matchId,
            internalRating: change.newInternalRating,
            displayRating: change.newDisplayRating,
            convergencePoints: change.newConvergencePoints,
          },
        });
      }
    });

    this.logger.log(
      `[CLASSIC] Ratings updated for ${ratingChanges.length} participants in game ${gameId}`,
    );
  }

  /**
   * Sort participants and calculate positions
   */
  private sortAndRankParticipants(
    participants: any[],
  ): Array<any & { calculatedPosition: number }> {
    // Sort by score (descending)
    const sorted = [...participants].sort((a, b) => {
      return (b.totalScore ?? 0) - (a.totalScore ?? 0);
    });

    // Calculate positions (same score = same position)
    const result: Array<any & { calculatedPosition: number }> = [];
    let currentPosition = 1;
    let prevScore: number | null = null;
    let samePositionCount = 0;

    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      const score = p.totalScore ?? 0;

      let isTie = false;
      if (i > 0 && score === prevScore) {
        isTie = true;
      }

      if (isTie) {
        samePositionCount++;
      } else {
        currentPosition += samePositionCount;
        samePositionCount = 1;
      }

      result.push({
        ...p,
        calculatedPosition: currentPosition,
      });

      prevScore = score;
    }

    return result;
  }

  /**
   * Recalculate ratings from a specific match onwards (admin function)
   */
  async recalculateFromMatch(
    category: EventCategory,
    seasonNumber: number,
    fromMatchNumber: number,
  ): Promise<{ recalculatedMatches: number; recalculatedGames: number }> {
    this.logger.log(
      `[RECALC] Starting recalculation from match ${fromMatchNumber} for ${category} season ${seasonNumber}`,
    );

    // Step 1: Get target matches
    const matches = await this.prisma.match.findMany({
      where: {
        season: {
          seasonNumber,
          event: { category },
        },
        matchNumber: { gte: fromMatchNumber },
        status: 'FINALIZED',
      },
      orderBy: { matchNumber: 'asc' },
      include: {
        games: {
          include: {
            participants: {
              where: { status: 'VERIFIED' },
            },
          },
        },
        season: true,
      },
    });

    if (matches.length === 0) {
      this.logger.warn(
        `[RECALC] No finalized matches found from matchNumber ${fromMatchNumber}`,
      );
      return { recalculatedMatches: 0, recalculatedGames: 0 };
    }

    const matchIds = matches.map((m) => m.id);
    const seasonId = matches[0].seasonId;

    // Step 2: Identify all users in target matches
    const allUserIds = new Set<number>();
    for (const match of matches) {
      for (const game of match.games) {
        for (const p of game.participants) {
          allUserIds.add(p.userId);
        }
      }
    }
    const userIds = Array.from(allUserIds);

    this.logger.log(
      `[RECALC] Found ${matches.length} matches, ${userIds.length} users to recalculate`,
    );

    // Step 3: Get state at fromMatchNumber-1 (for reset)
    let baseRatingsByUser: Map<
      number,
      {
        internalRating: number;
        displayRating: number;
        convergencePoints: number;
        totalMatches: number;
      }
    >;

    if (fromMatchNumber === 1) {
      // Reset to initial values if recalculating from match 1
      baseRatingsByUser = new Map();
      for (const userId of userIds) {
        baseRatingsByUser.set(userId, {
          internalRating: CLASSIC_CONFIG.INITIAL_RATING,
          displayRating: 0,
          convergencePoints: 0,
          totalMatches: 0,
        });
      }
    } else {
      // Get from rating_history at fromMatchNumber-1
      const prevMatch = await this.prisma.match.findFirst({
        where: {
          seasonId,
          matchNumber: fromMatchNumber - 1,
          status: 'FINALIZED',
        },
      });

      baseRatingsByUser = new Map();

      if (prevMatch) {
        const prevHistories = await this.prisma.ratingHistory.findMany({
          where: {
            matchId: prevMatch.id,
            userId: { in: userIds },
          },
        });

        for (const rh of prevHistories) {
          baseRatingsByUser.set(rh.userId, {
            internalRating: rh.internalRating,
            displayRating: rh.displayRating,
            convergencePoints: rh.convergencePoints,
            totalMatches: 0,
          });
        }
      }

      // Users who joined after fromMatchNumber get initial values
      for (const userId of userIds) {
        if (!baseRatingsByUser.has(userId)) {
          baseRatingsByUser.set(userId, {
            internalRating: CLASSIC_CONFIG.INITIAL_RATING,
            displayRating: 0,
            convergencePoints: 0,
            totalMatches: 0,
          });
        }
      }
    }

    // Step 4: Reset in transaction
    await this.prisma.$transaction(async (tx) => {
      // Delete rating histories for target matches
      await tx.ratingHistory.deleteMany({
        where: { matchId: { in: matchIds } },
      });
      this.logger.log(
        `[RECALC] Deleted rating histories for ${matchIds.length} matches`,
      );

      // Reset UserSeasonStats
      for (const userId of userIds) {
        const base = baseRatingsByUser.get(userId)!;

        const prevHistoryCount = await tx.ratingHistory.count({
          where: {
            userId,
            match: { seasonId },
          },
        });

        await tx.userSeasonStats.upsert({
          where: {
            userId_seasonId: { userId, seasonId },
          },
          update: {
            internalRating: base.internalRating,
            displayRating: base.displayRating,
            seasonHighRating: base.displayRating,
            convergencePoints: base.convergencePoints,
            totalMatches: prevHistoryCount,
            totalPoints: 0,
            totalPositions: 0,
            firstPlaces: 0,
            secondPlaces: 0,
            thirdPlaces: 0,
            survivedCount: 0,
          },
          create: {
            userId,
            seasonId,
            internalRating: CLASSIC_CONFIG.INITIAL_RATING,
            displayRating: 0,
            convergencePoints: 0,
            totalMatches: 0,
          },
        });
      }
      this.logger.log(
        `[RECALC] Reset UserSeasonStats for ${userIds.length} users`,
      );
    });

    // Step 5: Recalculate each match in order
    let recalculatedGames = 0;
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      this.logger.log(
        `[RECALC] Processing match ${i + 1}/${matches.length} (matchNumber=${match.matchNumber})`,
      );

      for (const game of match.games) {
        if (game.participants.length >= 2) {
          await this.calculateAndUpdateRatings(game.id);
          recalculatedGames++;
        } else {
          this.logger.warn(
            `[RECALC] Skipping game ${game.id}: only ${game.participants.length} participant(s)`,
          );
        }
      }
    }

    this.logger.log(
      `[RECALC] Completed: ${matches.length} matches, ${recalculatedGames} games recalculated`,
    );

    return { recalculatedMatches: matches.length, recalculatedGames };
  }
}
