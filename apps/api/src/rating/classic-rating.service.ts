import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventCategory, ResultStatus } from '@prisma/client';

// ==================== CLASSIC MODE CONSTANTS ====================

const CLASSIC_CONFIG = {
  // レート計算パラメータ
  K_FACTOR: 10000,
  K_MULTIPLIER: 0.01, // K_FACTOR × K_MULTIPLIER = 100
  SCALE: 1000,
  INITIAL_RATING: 2750,

  // 収束パラメータ
  PLACEMENT_GAMES: 20,
  INITIAL_COMPARISON_GAMES: 5, // 最初の5試合は全員比較
  COMPARISON_RANGE: 3, // レート近傍±3人

  // 順位ボーナス
  POSITION_BONUS: { 1: 20, 2: 10, 3: 5 } as Record<number, number>,
  MIN_GUARANTEE: { 1: 10, 2: 5, 3: 2 } as Record<number, number>,

  // 最大変動キャップ
  MAX_RATING_CHANGE: 200,
};

// ==================== INTERFACES ====================

interface ParticipantWithRating {
  participantId: number;
  userId: number;
  position: number; // 計算された順位 (1-based)
  totalScore: number;
  eliminatedAtRace: number | null;
  currentRating: number;
  currentSeasonHigh: number;
  gamesPlayed: number;
  currentDisplayRating: number;
  currentConvergencePoints: number;
}

interface RatingChange {
  userId: number;
  participantId: number;
  oldInternalRating: number;
  newInternalRating: number;
  internalRatingChange: number;
  oldSeasonHigh: number;
  newSeasonHigh: number;
  oldDisplayRating: number;
  newDisplayRating: number;
  oldGamesPlayed: number;
  newGamesPlayed: number;
  oldConvergencePoints: number;
  newConvergencePoints: number;
}

@Injectable()
export class ClassicRatingService {
  private readonly logger = new Logger(ClassicRatingService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * メインエントリポイント: ゲームの全参加者のレートを計算・更新
   */
  async calculateAndUpdateRatings(gameId: number): Promise<void> {
    this.logger.log(`[CLASSIC] Calculating ratings for game ${gameId}`);

    // ゲームと参加者を取得
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        participants: {
          where: {
            status: 'SUBMITTED',
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
      throw new Error(`Game ${gameId} is not CLASSIC mode (got ${eventCategory})`);
    }

    const seasonId = game.match.seasonId;

    // 参加者を順位でソート
    const sortedParticipants = this.sortAndRankParticipants(game.participants);

    // 各参加者のシーズンスタッツを取得または作成
    const participantsWithRatings: ParticipantWithRating[] = [];

    for (const p of sortedParticipants) {
      // UserSeasonStatsを取得または作成
      let seasonStats = await this.prisma.userSeasonStats.findUnique({
        where: {
          userId_seasonId: {
            userId: p.userId,
            seasonId: seasonId,
          },
        },
      });

      if (!seasonStats) {
        // 新規プレイヤー: 初期レートで作成
        seasonStats = await this.prisma.userSeasonStats.create({
          data: {
            userId: p.userId,
            seasonId: seasonId,
            internalRating: CLASSIC_CONFIG.INITIAL_RATING,
            seasonHighRating: CLASSIC_CONFIG.INITIAL_RATING,
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

    // レート変動を計算
    const ratingChanges = this.calculateRatingChanges(participantsWithRatings);

    // トランザクションでDB更新
    await this.prisma.$transaction(async (tx) => {
      for (const change of ratingChanges) {
        const participant = participantsWithRatings.find(
          (p) => p.userId === change.userId,
        )!;

        // UserSeasonStats更新
        await tx.userSeasonStats.update({
          where: {
            userId_seasonId: {
              userId: change.userId,
              seasonId: seasonId,
            },
          },
          data: {
            internalRating: change.newInternalRating,
            seasonHighRating: Math.max(change.newSeasonHigh, change.newDisplayRating),
            displayRating: change.newDisplayRating,
            convergencePoints: change.newConvergencePoints,
            totalMatches: { increment: 1 },
            firstPlaces: participant.position === 1 ? { increment: 1 } : undefined,
            secondPlaces: participant.position === 2 ? { increment: 1 } : undefined,
            thirdPlaces: participant.position === 3 ? { increment: 1 } : undefined,
            survivedCount: participant.eliminatedAtRace === null ? { increment: 1 } : undefined,
          },
        });

        // RatingHistory記録
        await tx.ratingHistory.create({
          data: {
            userId: change.userId,
            matchId: game.matchId,
            internalRating: change.newInternalRating,
            displayRating: change.newDisplayRating,
          },
        });
      }
    });

    this.logger.log(
      `[CLASSIC] Ratings updated for ${ratingChanges.length} participants in game ${gameId}`,
    );
  }

  /**
   * 参加者をソートして順位を計算
   * - 完走者: totalScore順
   * - DNF race 3: 全員同順位
   * - DNF race 2: 全員同順位
   * - DNF race 1: 全員同順位
   */
  private sortAndRankParticipants(
    participants: any[],
  ): Array<any & { calculatedPosition: number }> {
    // ソート
    const sorted = [...participants].sort((a, b) => {
      const aElim = a.eliminatedAtRace;
      const bElim = b.eliminatedAtRace;

      // Both finished - sort by score
      if (aElim === null && bElim === null) {
        return (b.totalScore ?? 0) - (a.totalScore ?? 0);
      }

      // One finished, one DNF
      if (aElim === null) return -1;
      if (bElim === null) return 1;

      // Both DNF - later race = higher rank
      return bElim - aElim;
    });

    // 順位を計算
    const result: Array<any & { calculatedPosition: number }> = [];
    let currentPosition = 1;
    let prevElim: number | null | undefined = undefined;
    let prevScore: number | null = null;
    let samePositionCount = 0;

    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      const elim = p.eliminatedAtRace;
      const score = p.totalScore ?? 0;

      let isTie = false;
      if (i > 0) {
        if (elim !== null && elim === prevElim) {
          // Same DNF race = tied
          isTie = true;
        } else if (elim === null && prevElim === null && score === prevScore) {
          // Both finished with same score = tied
          isTie = true;
        }
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

      prevElim = elim;
      prevScore = score;
    }

    return result;
  }

  /**
   * レート変動を計算
   */
  private calculateRatingChanges(
    participants: ParticipantWithRating[],
  ): RatingChange[] {
    // Step 1: 順位を正規化（DNFグループは最下位グループとして扱う）
    const normalizedPositions = this.normalizePositions(participants);

    // Step 2: レートでソートして比較対象を決定
    const sortedByRating = [...participants].sort(
      (a, b) => b.currentRating - a.currentRating,
    );

    // Step 3: 各プレイヤーのレート変動を計算
    const rawChanges: Record<number, number> = {};

    for (const player of participants) {
      if (player.gamesPlayed < CLASSIC_CONFIG.INITIAL_COMPARISON_GAMES) {
        // 初期5試合: 全員と比較
        rawChanges[player.userId] = this.calculateWithAllComparison(
          player,
          participants,
          normalizedPositions,
        );
      } else {
        // 6試合目以降: レート近傍比較
        rawChanges[player.userId] = this.calculateWithProximityComparison(
          player,
          sortedByRating,
          normalizedPositions,
        );
      }
    }

    // Step 4: ゼロサム調整（ボーナス適用前）
    this.enforceZeroSum(rawChanges);

    // Step 5: 最大変動キャップ（±200）
    this.capMaxChange(rawChanges);

    // Step 6: 順位ボーナス適用（キャップ後に適用）
    this.applyPositionBonuses(rawChanges, participants);

    // Step 7: RatingChange配列を構築
    return this.buildRatingChanges(participants, rawChanges);
  }

  /**
   * 順位を正規化
   * - DNF users are grouped by their DNF race
   * - Non-DNF users keep their calculated position
   */
  private normalizePositions(
    participants: ParticipantWithRating[],
  ): Record<number, number> {
    const normalized: Record<number, number> = {};

    for (const p of participants) {
      // DNFユーザーは特殊な順位グループに入れる
      // position自体がすでにDNFグループで同順位になっているのでそのまま使用
      normalized[p.userId] = p.position;
    }

    return normalized;
  }

  /**
   * 全員比較方式（初期5試合）
   */
  private calculateWithAllComparison(
    player: ParticipantWithRating,
    allParticipants: ParticipantWithRating[],
    normalizedPositions: Record<number, number>,
  ): number {
    const opponents = allParticipants.filter((p) => p.userId !== player.userId);

    if (opponents.length === 0) return 0;

    // 期待スコア（従来のElo）
    let expectedScore = 0;
    for (const opponent of opponents) {
      const ratingDiff = opponent.currentRating - player.currentRating;
      expectedScore +=
        1.0 / (1.0 + Math.pow(10, ratingDiff / CLASSIC_CONFIG.SCALE));
    }
    expectedScore /= opponents.length;

    // 実際のスコア（相対順位）
    const myPosition = normalizedPositions[player.userId];
    let betterCount = 0,
      worseCount = 0,
      sameCount = 0;

    for (const opponent of opponents) {
      const oppPosition = normalizedPositions[opponent.userId];
      if (oppPosition < myPosition) betterCount++;
      else if (oppPosition > myPosition) worseCount++;
      else sameCount++;
    }

    const actualScore = (worseCount + sameCount * 0.5) / opponents.length;

    return (
      CLASSIC_CONFIG.K_FACTOR *
      CLASSIC_CONFIG.K_MULTIPLIER *
      (actualScore - expectedScore)
    );
  }

  /**
   * レート近傍比較方式（6試合目以降）
   */
  private calculateWithProximityComparison(
    player: ParticipantWithRating,
    sortedByRating: ParticipantWithRating[],
    normalizedPositions: Record<number, number>,
  ): number {
    const ratingRank =
      sortedByRating.findIndex((p) => p.userId === player.userId) + 1;
    const totalPlayers = sortedByRating.length;

    const comparisonTargets = this.selectComparisonTargets(
      ratingRank,
      totalPlayers,
    );
    const comparisonPlayers = comparisonTargets
      .map((rank) => sortedByRating[rank - 1])
      .filter((p) => p !== undefined);

    if (comparisonPlayers.length === 0) return 0;

    const myPosition = normalizedPositions[player.userId];
    let expectedScore = 0;
    let actualScore = 0;

    for (const opponent of comparisonPlayers) {
      const ratingDiff = opponent.currentRating - player.currentRating;
      const expectedWinRate =
        1.0 / (1.0 + Math.pow(10, ratingDiff / CLASSIC_CONFIG.SCALE));

      const oppPosition = normalizedPositions[opponent.userId];
      if (myPosition < oppPosition) {
        actualScore += 1.0;
        expectedScore += expectedWinRate;
      } else if (myPosition === oppPosition) {
        actualScore += expectedWinRate;
        expectedScore += expectedWinRate;
      } else {
        actualScore += 0.0;
        expectedScore += expectedWinRate;
      }
    }

    expectedScore /= comparisonPlayers.length;
    actualScore /= comparisonPlayers.length;

    return (
      CLASSIC_CONFIG.K_FACTOR *
      CLASSIC_CONFIG.K_MULTIPLIER *
      (actualScore - expectedScore)
    );
  }

  /**
   * 比較対象のランクを選択
   */
  private selectComparisonTargets(
    myRank: number,
    totalPlayers: number,
  ): number[] {
    let targets: number[];

    if (myRank === 1) {
      targets = [2, 3, 4, 5, 6, 7];
    } else if (myRank === 2) {
      targets = [1, 3, 4, 5, 6, 7];
    } else if (myRank === 3) {
      targets = [1, 2, 4, 5, 6, 7];
    } else if (myRank === totalPlayers) {
      targets = [];
      for (let i = myRank - 6; i < myRank; i++) {
        targets.push(i);
      }
    } else if (myRank === totalPlayers - 1) {
      targets = [];
      for (let i = myRank - 5; i < myRank; i++) {
        targets.push(i);
      }
      targets.push(myRank + 1);
    } else if (myRank === totalPlayers - 2) {
      targets = [];
      for (let i = myRank - 3; i < myRank; i++) {
        targets.push(i);
      }
      targets.push(myRank + 1);
      targets.push(myRank + 2);
    } else {
      targets = [
        myRank - 3,
        myRank - 2,
        myRank - 1,
        myRank + 1,
        myRank + 2,
        myRank + 3,
      ];
    }

    return targets.filter((t) => t >= 1 && t <= totalPlayers);
  }

  /**
   * 順位ボーナスを適用
   */
  private applyPositionBonuses(
    rawChanges: Record<number, number>,
    participants: ParticipantWithRating[],
  ): void {
    // Step 1: ボーナス追加（実際の順位でチェック）
    for (const p of participants) {
      if (CLASSIC_CONFIG.POSITION_BONUS[p.position]) {
        rawChanges[p.userId] += CLASSIC_CONFIG.POSITION_BONUS[p.position];
      }
    }

    // Step 2: 最低保証確認
    const adjustmentsNeeded: Record<number, number> = {};

    for (const p of participants) {
      const minGuarantee = CLASSIC_CONFIG.MIN_GUARANTEE[p.position];

      if (minGuarantee !== undefined) {
        const currentChange = rawChanges[p.userId];
        if (currentChange < minGuarantee) {
          adjustmentsNeeded[p.userId] = minGuarantee - currentChange;
        }
      }
    }

    // Step 3: ゼロサム調整（4位以下から回収）
    const totalBonus = Object.values(CLASSIC_CONFIG.POSITION_BONUS).reduce(
      (a, b) => a + b,
      0,
    );
    const totalShortage = Object.values(adjustmentsNeeded).reduce(
      (a, b) => a + b,
      0,
    );
    const totalAdjustment = totalBonus + totalShortage;

    if (totalAdjustment > 0) {
      const nonTop3Players = participants.filter(
        (p) => !CLASSIC_CONFIG.POSITION_BONUS[p.position],
      );

      if (nonTop3Players.length > 0) {
        const perPlayerReduction = totalAdjustment / nonTop3Players.length;
        for (const p of nonTop3Players) {
          rawChanges[p.userId] -= perPlayerReduction;
        }

        for (const oderId of Object.keys(adjustmentsNeeded)) {
          rawChanges[parseInt(oderId, 10)] += adjustmentsNeeded[parseInt(oderId, 10)];
        }
      }
    }
  }

  /**
   * ゼロサム調整
   */
  private enforceZeroSum(rawChanges: Record<number, number>): void {
    const total = Object.values(rawChanges).reduce((a, b) => a + b, 0);
    const playerCount = Object.keys(rawChanges).length;

    if (Math.abs(total) > 0.01 && playerCount > 0) {
      const avgAdjustment = total / playerCount;
      for (const userId of Object.keys(rawChanges)) {
        rawChanges[parseInt(userId, 10)] -= avgAdjustment;
      }
    }
  }

  /**
   * 最大変動キャップ
   */
  private capMaxChange(rawChanges: Record<number, number>): void {
    const maxAbsChange = Math.max(
      ...Object.values(rawChanges).map((v) => Math.abs(v)),
    );

    if (maxAbsChange > CLASSIC_CONFIG.MAX_RATING_CHANGE) {
      const scaleFactor = CLASSIC_CONFIG.MAX_RATING_CHANGE / maxAbsChange;
      for (const userId of Object.keys(rawChanges)) {
        rawChanges[parseInt(userId, 10)] *= scaleFactor;
      }
    }
  }

  /**
   * RatingChange配列を構築
   */
  private buildRatingChanges(
    participants: ParticipantWithRating[],
    rawChanges: Record<number, number>,
  ): RatingChange[] {
    const changes: RatingChange[] = [];

    for (const p of participants) {
      const delta = rawChanges[p.userId];
      const newInternalRating = p.currentRating + delta;
      const newGamesPlayed = p.gamesPlayed + 1;

      const newConvergencePoints = this.calculateNewConvergencePoints(
        p.currentConvergencePoints,
        p.position,
      );

      const newDisplayRating = this.calculateDisplayRating(
        p.currentRating,
        delta,
        newConvergencePoints,
      );

      changes.push({
        userId: p.userId,
        participantId: p.participantId,
        oldInternalRating: p.currentRating,
        newInternalRating: newInternalRating,
        internalRatingChange: delta,
        oldSeasonHigh: p.currentSeasonHigh,
        newSeasonHigh: Math.max(p.currentSeasonHigh, newInternalRating),
        oldDisplayRating: p.currentDisplayRating,
        newDisplayRating: newDisplayRating,
        oldGamesPlayed: p.gamesPlayed,
        newGamesPlayed: newGamesPlayed,
        oldConvergencePoints: p.currentConvergencePoints,
        newConvergencePoints: newConvergencePoints,
      });
    }

    return changes;
  }

  /**
   * 順位に応じた収束ポイントを計算
   */
  private calculateNewConvergencePoints(
    currentPoints: number,
    position: number,
  ): number {
    // 順位に応じたポイント（高順位ほど高い）
    const pointsEarned = Math.max(0.35, 1.0 - (position - 1) * 0.04);
    return currentPoints + pointsEarned;
  }

  /**
   * 表示レート計算（収束ポイント方式）
   */
  private calculateDisplayRating(
    oldInternalRating: number,
    delta: number,
    convergencePoints: number,
  ): number {
    let convergenceMultiplier: number;

    if (convergencePoints < 20) {
      convergenceMultiplier = Math.sin(0.08 * convergencePoints);
    } else {
      convergenceMultiplier = 1.0;
    }

    const displayRating = oldInternalRating * convergenceMultiplier + delta;

    return Math.max(0, Math.ceil(displayRating));
  }
}
