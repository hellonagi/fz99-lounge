import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventCategory } from '@prisma/client';
import {
  CLASSIC_CONFIG,
  ParticipantWithRating,
} from './classic-rating.constants';
import { calculateRatingChanges } from './classic-rating.algorithm';

/**
 * Team score data from game
 */
interface TeamScore {
  teamIndex: number;
  score: number;
  rank: number;
}

@Injectable()
export class TeamClassicRatingService {
  private readonly logger = new Logger(TeamClassicRatingService.name);

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
   * Calculate median stats for multiple users in a season (batch version)
   */
  private async calculateMedianStatsBatch(
    tx: any,
    userIds: number[],
    seasonId: number,
  ): Promise<
    Map<
      number,
      {
        medianPosition: number | null;
        medianPoints: number | null;
        favoriteMachine: string | null;
      }
    >
  > {
    const result = new Map<
      number,
      {
        medianPosition: number | null;
        medianPoints: number | null;
        favoriteMachine: string | null;
      }
    >();

    for (const userId of userIds) {
      result.set(userId, {
        medianPosition: null,
        medianPoints: null,
        favoriteMachine: null,
      });
    }

    if (userIds.length === 0) {
      return result;
    }

    // Get all verified game participations for all users in this season
    const allUserParticipations = await tx.gameParticipant.findMany({
      where: {
        userId: { in: userIds },
        status: 'VERIFIED',
        isExcluded: false,
        game: { match: { seasonId } },
      },
      select: {
        userId: true,
        totalScore: true,
        machine: true,
        gameId: true,
        teamIndex: true,
      },
    });

    if (allUserParticipations.length === 0) {
      return result;
    }

    // Collect all game IDs
    const gameIds = [
      ...new Set(
        allUserParticipations.map((p: { gameId: number }) => p.gameId),
      ),
    ];

    // Get all games to fetch team scores
    const games = await tx.game.findMany({
      where: { id: { in: gameIds } },
      select: { id: true, teamScores: true },
    });

    const gameTeamScoresMap = new Map<number, TeamScore[]>();
    for (const game of games) {
      if (game.teamScores) {
        gameTeamScoresMap.set(game.id, game.teamScores as TeamScore[]);
      }
    }

    // Group user participations by user
    const userParticipationsMap = new Map<
      number,
      Array<{
        totalScore: number | null;
        machine: string | null;
        gameId: number;
        teamIndex: number | null;
      }>
    >();
    for (const p of allUserParticipations) {
      const list = userParticipationsMap.get(p.userId) || [];
      list.push({
        totalScore: p.totalScore,
        machine: p.machine,
        gameId: p.gameId,
        teamIndex: p.teamIndex,
      });
      userParticipationsMap.set(p.userId, list);
    }

    // Calculate stats for each user
    for (const userId of userIds) {
      const userParticipations = userParticipationsMap.get(userId);
      if (!userParticipations || userParticipations.length === 0) {
        continue;
      }

      const positions: number[] = [];
      const points: number[] = [];
      const machineCount = new Map<string, number>();

      for (const userPart of userParticipations) {
        const teamScores = gameTeamScoresMap.get(userPart.gameId);
        if (teamScores && userPart.teamIndex !== null) {
          const teamScore = teamScores.find(
            (ts) => ts.teamIndex === userPart.teamIndex,
          );
          if (teamScore) {
            positions.push(teamScore.rank);
          }
        }

        points.push(userPart.totalScore ?? 0);

        if (userPart.machine) {
          machineCount.set(
            userPart.machine,
            (machineCount.get(userPart.machine) || 0) + 1,
          );
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

      result.set(userId, {
        medianPosition: this.calculateMedian(positions),
        medianPoints: this.calculateMedian(points),
        favoriteMachine,
      });
    }

    return result;
  }

  /**
   * Main entry point: Calculate and update ratings for all participants in a TEAM_CLASSIC game
   *
   * In TEAM_CLASSIC:
   * - Individual player positions are replaced by team positions
   * - All members of the same team get the same position (team rank)
   * - Rating calculation uses the standard CLASSIC algorithm but with team rank as position
   */
  async calculateAndUpdateRatings(gameId: number): Promise<void> {
    this.logger.log(`[TEAM_CLASSIC] Calculating ratings for game ${gameId}`);

    // Get game with participants and team scores
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        participants: {
          where: {
            status: 'VERIFIED',
            isExcluded: false, // Exclude excluded players from rating calculation
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
    if (eventCategory !== EventCategory.TEAM_CLASSIC && eventCategory !== EventCategory.TEAM_GP) {
      throw new Error(
        `Game ${gameId} is not a team mode (got ${eventCategory})`,
      );
    }
    const isTeamGp = eventCategory === EventCategory.TEAM_GP;

    if (!game.teamScores) {
      throw new Error(`Game ${gameId} has no team scores`);
    }

    const teamScores = game.teamScores as unknown as TeamScore[];
    const seasonId = game.match.seasonId;

    // Create a map of teamIndex -> rank
    const teamRankMap = new Map<number, number>();
    for (const ts of teamScores) {
      teamRankMap.set(ts.teamIndex, ts.rank);
    }

    // Skip if less than 2 participants
    if (game.participants.length < 2) {
      this.logger.warn(
        `[TEAM_CLASSIC] Skipping rating calculation for game ${gameId}: only ${game.participants.length} participant(s)`,
      );
      return;
    }

    // Get or create season stats for each participant
    const participantsWithRatings: ParticipantWithRating[] = [];

    for (const p of game.participants) {
      // Get team rank for this participant
      const teamRank = teamRankMap.get(p.teamIndex ?? -1);
      if (teamRank === undefined) {
        this.logger.warn(
          `[TEAM_CLASSIC] No team rank found for participant ${p.userId} with teamIndex ${p.teamIndex}`,
        );
        continue;
      }

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
        position: teamRank, // Use team rank instead of individual position
        totalScore: p.totalScore ?? 0,
        eliminatedAtRace: p.eliminatedAtRace,
        currentRating: seasonStats.internalRating,
        currentSeasonHigh: seasonStats.seasonHighRating,
        gamesPlayed: seasonStats.totalMatches,
        currentDisplayRating: seasonStats.displayRating,
        currentConvergencePoints: seasonStats.convergencePoints,
        teamIndex: p.teamIndex ?? undefined,
      });
    }

    if (participantsWithRatings.length < 2) {
      this.logger.warn(
        `[TEAM_CLASSIC] Skipping: only ${participantsWithRatings.length} valid participant(s)`,
      );
      return;
    }

    // Calculate rating changes with Team Classic options:
    // - Always use all-player comparison (no proximity mode)
    // - Exclude same-team members from Elo comparison
    // - Skip position bonuses (no 1st/2nd/3rd bonus)
    const ratingChanges = calculateRatingChanges(participantsWithRatings, {
      alwaysAllComparison: true,
      excludeSameTeam: true,
      skipPositionBonuses: true,
    });

    // MVP判定: チームごとにスコア最高のプレイヤーを特定
    const teamGroups = new Map<
      number,
      { userId: number; totalScore: number }[]
    >();
    for (const p of game.participants) {
      if (p.teamIndex === null) continue;
      const group = teamGroups.get(p.teamIndex) || [];
      group.push({ userId: p.userId, totalScore: p.totalScore ?? 0 });
      teamGroups.set(p.teamIndex, group);
    }

    const mvpUserIds = new Set<number>();
    for (const [, members] of teamGroups) {
      const maxScore = Math.max(...members.map((m) => m.totalScore));
      if (maxScore > 0) {
        members
          .filter((m) => m.totalScore === maxScore)
          .forEach((m) => mvpUserIds.add(m.userId));
      }
    }

    // Update database in transaction
    await this.prisma.$transaction(async (tx) => {
      // Batch fetch median stats for all users
      const userIds = ratingChanges.map((c) => c.userId);
      const allMedianStats = await this.calculateMedianStatsBatch(
        tx,
        userIds,
        seasonId,
      );

      // For TEAM_GP: fetch existing bestPosition values to compare (team rank as position)
      let existingBestPositions: Map<number, number | null> | undefined;
      if (isTeamGp) {
        const existingStats = await tx.userSeasonStats.findMany({
          where: { userId: { in: userIds }, seasonId },
          select: { userId: true, bestPosition: true },
        });
        existingBestPositions = new Map(existingStats.map((s: { userId: number; bestPosition: number | null }) => [s.userId, s.bestPosition]));
      }

      // Update UserSeasonStats for each participant
      const updatePromises = ratingChanges.map((change) => {
        const participant = participantsWithRatings.find(
          (p) => p.userId === change.userId,
        )!;
        const medianStats = allMedianStats.get(change.userId)!;

        // Calculate bestPosition for TEAM_GP (team rank)
        let bestPosition: number | undefined;
        if (isTeamGp && existingBestPositions) {
          const existing = existingBestPositions.get(change.userId) ?? null;
          const current = participant.position;
          bestPosition = existing === null
            ? current
            : Math.min(existing, current);
        }

        return tx.userSeasonStats.update({
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
            mvpCount: mvpUserIds.has(change.userId)
              ? { increment: 1 }
              : undefined,
            medianPosition: medianStats.medianPosition,
            medianPoints: medianStats.medianPoints,
            favoriteMachine: medianStats.favoriteMachine,
            ...(bestPosition !== undefined && { bestPosition }),
          },
        });
      });

      // Prepare rating history data for batch insert
      const historyData = ratingChanges.map((change) => ({
        userId: change.userId,
        matchId: game.matchId,
        internalRating: change.newInternalRating,
        displayRating: change.newDisplayRating,
        convergencePoints: change.newConvergencePoints,
      }));

      // Execute updates in parallel and batch insert history
      await Promise.all([
        ...updatePromises,
        tx.ratingHistory.createMany({ data: historyData }),
      ]);
    });

    this.logger.log(
      `[TEAM_CLASSIC] Ratings updated for ${ratingChanges.length} participants in game ${gameId}`,
    );
  }

  /**
   * Recalculate ratings from a specific match onwards (admin function)
   */
  async recalculateFromMatch(
    seasonNumber: number,
    fromMatchNumber: number,
    category: EventCategory = EventCategory.TEAM_CLASSIC,
  ): Promise<{ recalculatedMatches: number; recalculatedGames: number }> {
    const label = category === EventCategory.TEAM_GP ? 'TEAM_GP' : 'TEAM_CLASSIC';
    this.logger.log(
      `[${label} RECALC] Starting recalculation from match ${fromMatchNumber} for ${label} season ${seasonNumber}`,
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
              where: { status: 'VERIFIED', isExcluded: false },
            },
          },
        },
        season: true,
      },
    });

    if (matches.length === 0) {
      this.logger.warn(
        `[TEAM_CLASSIC RECALC] No finalized matches found from matchNumber ${fromMatchNumber}`,
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
      `[TEAM_CLASSIC RECALC] Found ${matches.length} matches, ${userIds.length} users to recalculate`,
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
      await tx.ratingHistory.deleteMany({
        where: { matchId: { in: matchIds } },
      });
      this.logger.log(
        `[TEAM_CLASSIC RECALC] Deleted rating histories for ${matchIds.length} matches`,
      );

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
            mvpCount: 0,
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
        `[TEAM_CLASSIC RECALC] Reset UserSeasonStats for ${userIds.length} users`,
      );
    });

    // Step 5: Recalculate each match in order
    let recalculatedGames = 0;
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      this.logger.log(
        `[TEAM_CLASSIC RECALC] Processing match ${i + 1}/${matches.length} (matchNumber=${match.matchNumber})`,
      );

      for (const game of match.games) {
        if (game.participants.length >= 2) {
          await this.calculateAndUpdateRatings(game.id);
          recalculatedGames++;
        } else {
          this.logger.warn(
            `[TEAM_CLASSIC RECALC] Skipping game ${game.id}: only ${game.participants.length} participant(s)`,
          );
        }
      }
    }

    this.logger.log(
      `[TEAM_CLASSIC RECALC] Completed: ${matches.length} matches, ${recalculatedGames} games recalculated`,
    );

    return { recalculatedMatches: matches.length, recalculatedGames };
  }
}
