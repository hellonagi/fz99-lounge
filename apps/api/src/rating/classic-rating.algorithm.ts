/**
 * ============================================================================
 * Classic Mode Rating Algorithm
 * ============================================================================
 *
 * This file contains the pure rating calculation logic for Classic mode.
 *
 * ## Overview
 *
 * This is a modified multi-player Elo system designed for F-ZERO 99 Classic Mini mode.
 * The key features are:
 *
 * 1. **Two comparison modes**:
 *    - First 5 games: Compare with ALL players (to avoid unfairness when everyone starts at the same rating)
 *    - After 5 games: Compare with nearby-rated players only (for meaningful comparisons)
 *
 * 2. **Zero-sum system**: Total rating change across all players is always 0
 *
 * 3. **Position bonuses**: Top 3 finishers get bonus points
 *
 * 4. **Convergence system**: Display rating gradually approaches internal rating
 *
 * ## Calculation Flow
 *
 * 1. Calculate raw Elo changes (all-comparison or proximity-comparison)
 * 2. Apply position bonuses (+20/+10/+5 for 1st/2nd/3rd)
 * 3. Enforce zero-sum (adjust so total change = 0)
 * 4. Cap maximum change (±200)
 * 5. Calculate convergence points and display rating
 *
 * ============================================================================
 */

import {
  CLASSIC_CONFIG,
  ParticipantWithRating,
  RatingCalculationOptions,
  RatingChange,
} from './classic-rating.constants';

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

/**
 * Calculate rating changes for all participants in a game.
 *
 * @param participants - Array of participants with their current ratings
 * @returns Array of rating changes for each participant
 */
export function calculateRatingChanges(
  participants: ParticipantWithRating[],
  options?: RatingCalculationOptions,
): RatingChange[] {
  // Step 1: Normalize positions (handle DNF groupings)
  const normalizedPositions = normalizePositions(participants);

  // Step 2: Sort by current rating (for proximity comparison)
  const sortedByRating = [...participants].sort(
    (a, b) => b.currentRating - a.currentRating,
  );

  // Step 3: Calculate raw Elo changes for each player
  const rawChanges: Record<number, number> = {};

  for (const player of participants) {
    if (
      options?.alwaysAllComparison ||
      player.gamesPlayed < CLASSIC_CONFIG.INITIAL_COMPARISON_GAMES
    ) {
      // All-player comparison (always for Team Classic, first 5 games for Classic)
      rawChanges[player.userId] = calculateWithAllComparison(
        player,
        participants,
        normalizedPositions,
        options,
      );
    } else {
      // After 5 games: Compare with nearby-rated players for meaningful comparisons
      rawChanges[player.userId] = calculateWithProximityComparison(
        player,
        sortedByRating,
        normalizedPositions,
      );
    }
  }

  // Step 4: Apply position bonuses (1st: +20, 2nd: +10, 3rd: +5)
  if (!options?.skipPositionBonuses) {
    applyPositionBonuses(rawChanges, participants);
  }

  // Step 5: Enforce zero-sum (total change must equal 0)
  enforceZeroSum(rawChanges);

  // Step 6: Cap maximum change at ±200
  capMaxChange(rawChanges);

  // Step 7: Build final rating change objects
  return buildRatingChanges(participants, rawChanges);
}

// ============================================================================
// ELO CALCULATION METHODS
// ============================================================================

/**
 * Calculate rating change using ALL-PLAYER comparison.
 *
 * Used for the first 5 games of each player.
 *
 * Why?
 * - At season start, everyone has the same rating (2750)
 * - With proximity comparison, who you get matched with determines your rating change
 *   (e.g., 6th place comparing with 1-5th loses points, 12th place comparing with 13-17th gains points)
 * - All-player comparison ensures rating changes reflect actual placement fairly
 *
 * Formula:
 * - Expected score = average of Elo expected win rates vs all opponents
 * - Actual score = (players beaten + 0.5 × players tied) / total opponents
 * - Rating change = K × (actual - expected)
 */
function calculateWithAllComparison(
  player: ParticipantWithRating,
  allParticipants: ParticipantWithRating[],
  normalizedPositions: Record<number, number>,
  options?: RatingCalculationOptions,
): number {
  let opponents = allParticipants.filter((p) => p.userId !== player.userId);

  // Exclude same-team members from comparison (Team Classic)
  if (options?.excludeSameTeam && player.teamIndex !== undefined) {
    opponents = opponents.filter((p) => p.teamIndex !== player.teamIndex);
  }

  if (opponents.length === 0) return 0;

  // Calculate expected score using standard Elo formula
  // Expected = 1 / (1 + 10^((opponentRating - myRating) / SCALE))
  let expectedScore = 0;
  for (const opponent of opponents) {
    const ratingDiff = opponent.currentRating - player.currentRating;
    expectedScore +=
      1.0 / (1.0 + Math.pow(10, ratingDiff / CLASSIC_CONFIG.SCALE));
  }
  expectedScore /= opponents.length;

  // Calculate actual score based on positions
  const myPosition = normalizedPositions[player.userId];
  let betterCount = 0,
    worseCount = 0,
    sameCount = 0;

  for (const opponent of opponents) {
    const oppPosition = normalizedPositions[opponent.userId];
    if (oppPosition < myPosition) betterCount++; // opponent finished higher
    else if (oppPosition > myPosition) worseCount++; // opponent finished lower
    else sameCount++; // same position (tie)
  }

  // Actual score: players beaten count as 1, ties count as 0.5
  const actualScore = (worseCount + sameCount * 0.5) / opponents.length;

  // Rating change = K × (actual - expected)
  return (
    CLASSIC_CONFIG.K_FACTOR *
    CLASSIC_CONFIG.K_MULTIPLIER *
    (actualScore - expectedScore)
  );
}

/**
 * Calculate rating change using PROXIMITY comparison.
 *
 * Used after the first 5 games.
 *
 * Why use proximity comparison?
 * - With all-player comparison, randomness is too high and ratings don't spread out properly
 * - Comparing only with similarly-rated players creates meaningful differentiation
 *
 * How it works:
 * - Sort all players by current rating
 * - Compare with the 3 players above and 3 players below in rating rank
 * - Edge cases: If near the top/bottom, shift the comparison window
 */
function calculateWithProximityComparison(
  player: ParticipantWithRating,
  sortedByRating: ParticipantWithRating[],
  normalizedPositions: Record<number, number>,
): number {
  // Find this player's rank by rating (1 = highest rated)
  const ratingRank =
    sortedByRating.findIndex((p) => p.userId === player.userId) + 1;
  const totalPlayers = sortedByRating.length;

  // Select comparison targets (typically ±3 players by rating rank)
  const comparisonTargets = selectComparisonTargets(ratingRank, totalPlayers);
  const comparisonPlayers = comparisonTargets
    .map((rank) => sortedByRating[rank - 1])
    .filter((p) => p !== undefined);

  if (comparisonPlayers.length === 0) return 0;

  const myPosition = normalizedPositions[player.userId];
  let expectedScore = 0;
  let actualScore = 0;

  for (const opponent of comparisonPlayers) {
    // Expected win rate based on rating difference
    const ratingDiff = opponent.currentRating - player.currentRating;
    const expectedWinRate =
      1.0 / (1.0 + Math.pow(10, ratingDiff / CLASSIC_CONFIG.SCALE));

    // Actual result: 1 if I beat them, 0 if they beat me, expected if tied
    const oppPosition = normalizedPositions[opponent.userId];
    if (myPosition < oppPosition) {
      actualScore += 1.0; // I finished higher
      expectedScore += expectedWinRate;
    } else if (myPosition === oppPosition) {
      actualScore += expectedWinRate; // Tie: count as expected
      expectedScore += expectedWinRate;
    } else {
      actualScore += 0.0; // They finished higher
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
 * Select which players to compare with based on rating rank.
 *
 * Default: Compare with 3 players above and 3 players below (6 total)
 * Edge cases:
 * - If ranked 1-3: Can't get 3 above, so get more from below
 * - If ranked near bottom: Can't get 3 below, so get more from above
 */
function selectComparisonTargets(
  myRank: number,
  totalPlayers: number,
): number[] {
  const range = CLASSIC_CONFIG.COMPARISON_RANGE;
  const totalTargets = range * 2;

  const aboveAvailable = myRank - 1;
  const belowAvailable = totalPlayers - myRank;

  // Try to get `range` from each direction
  let above = Math.min(range, aboveAvailable);
  let below = Math.min(range, belowAvailable);

  // If we can't get enough, fill from the other direction
  if (above + below < totalTargets) {
    if (above < range) {
      below = Math.min(totalTargets - above, belowAvailable);
    } else {
      above = Math.min(totalTargets - below, aboveAvailable);
    }
  }

  const targets: number[] = [];
  for (let i = 1; i <= above; i++) {
    targets.push(myRank - i);
  }
  for (let i = 1; i <= below; i++) {
    targets.push(myRank + i);
  }

  return targets;
}

// ============================================================================
// ADJUSTMENTS
// ============================================================================

/**
 * Normalize positions for rating calculation.
 * Handles special cases like DNF (Did Not Finish) groupings.
 */
function normalizePositions(
  participants: ParticipantWithRating[],
): Record<number, number> {
  const normalized: Record<number, number> = {};
  for (const p of participants) {
    normalized[p.userId] = p.position;
  }
  return normalized;
}

/**
 * Apply position bonuses to top 3 finishers.
 *
 * Bonuses: 1st place: +20, 2nd place: +10, 3rd place: +5
 * Minimum guarantees: 1st: +10, 2nd: +5, 3rd: +2
 *
 * Why have bonuses?
 * - Winning should feel rewarding beyond just the Elo calculation
 * - Creates an incentive to compete for top positions
 * - The minimum guarantee prevents a situation where winning gives almost nothing
 */
function applyPositionBonuses(
  rawChanges: Record<number, number>,
  participants: ParticipantWithRating[],
): void {
  for (const p of participants) {
    // Add bonus for top 3
    const bonus = CLASSIC_CONFIG.POSITION_BONUS[p.position] ?? 0;
    rawChanges[p.userId] += bonus;

    // Ensure minimum guarantee for top 3
    const minGuarantee = CLASSIC_CONFIG.MIN_GUARANTEE[p.position];
    if (minGuarantee !== undefined && rawChanges[p.userId] < minGuarantee) {
      rawChanges[p.userId] = minGuarantee;
    }
  }
}

/**
 * Enforce zero-sum: Total rating change must equal 0.
 *
 * Why zero-sum?
 * - Prevents rating inflation over time
 * - Total rating in the system stays constant
 * - Rating is truly a relative measure of skill
 *
 * How: Distribute any excess/deficit equally among all players
 */
function enforceZeroSum(rawChanges: Record<number, number>): void {
  const total = Object.values(rawChanges).reduce((a, b) => a + b, 0);
  const playerCount = Object.keys(rawChanges).length;

  if (Math.abs(total) > 0.01 && playerCount > 0) {
    const avgAdjustment = total / playerCount;
    for (const oderId of Object.keys(rawChanges)) {
      rawChanges[parseInt(oderId, 10)] -= avgAdjustment;
    }
  }
}

/**
 * Cap maximum rating change at ±200.
 *
 * Why cap?
 * - Prevents extreme swings from single games
 * - Protects against outlier results
 * - Makes the system more stable
 *
 * How: If any player would change more than 200, scale all changes proportionally
 */
function capMaxChange(rawChanges: Record<number, number>): void {
  const maxAbsChange = Math.max(
    ...Object.values(rawChanges).map((v) => Math.abs(v)),
  );

  if (maxAbsChange > CLASSIC_CONFIG.MAX_RATING_CHANGE) {
    const scaleFactor = CLASSIC_CONFIG.MAX_RATING_CHANGE / maxAbsChange;
    for (const oderId of Object.keys(rawChanges)) {
      rawChanges[parseInt(oderId, 10)] *= scaleFactor;
    }
  }
}

// ============================================================================
// CONVERGENCE SYSTEM
// ============================================================================

/**
 * Calculate new convergence points based on position.
 *
 * The convergence system controls how quickly display rating approaches
 * internal rating. Higher positions earn more convergence points.
 *
 * Points by position:
 * - 1st: 1.0, 2nd: 0.96, 3rd: 0.92, ... decreasing by 0.04
 * - 13-16th: 0.52 (grouped)
 * - 17-20th: 0.48 (grouped)
 * - 21+: 0.35
 *
 * At 20 convergence points, display rating = internal rating (fully converged)
 */
function calculateNewConvergencePoints(
  currentPoints: number,
  position: number,
): number {
  const convergencePointsByPosition: Record<number, number> = {
    1: 1.0,
    2: 0.96,
    3: 0.92,
    4: 0.88,
    5: 0.84,
    6: 0.8,
    7: 0.76,
    8: 0.72,
    9: 0.68,
    10: 0.64,
    11: 0.6,
    12: 0.56,
    13: 0.52,
    14: 0.52,
    15: 0.52,
    16: 0.52,
    17: 0.48,
    18: 0.48,
    19: 0.48,
    20: 0.48,
  };
  const pointsEarned = convergencePointsByPosition[position] ?? 0.35;
  return currentPoints + pointsEarned;
}

/**
 * Calculate display rating from internal rating.
 *
 * Display rating = Internal rating × Convergence multiplier
 *
 * Similar to Glicko's RD: converges quickly at first, then stabilizes
 *
 * Why use this system?
 * - If we showed internal rating directly, half of players would drop from initial rating
 * - This is demotivating for new players
 * - Display rating starts low and converges to internal rating over time
 * - This way, all players feel their rating is going up as they play
 */
function calculateDisplayRating(
  oldInternalRating: number,
  delta: number,
  convergencePoints: number,
): number {
  let convergenceMultiplier: number;

  if (convergencePoints <= CLASSIC_CONFIG.CONVERGENCE_THRESHOLD) {
    // Sine curve provides smooth acceleration (reaches 1.0 exactly at threshold)
    convergenceMultiplier = Math.sin(
      (Math.PI / (2 * CLASSIC_CONFIG.CONVERGENCE_THRESHOLD)) * convergencePoints,
    );
  } else {
    // Fully converged
    convergenceMultiplier = 1.0;
  }

  const newInternalRating = oldInternalRating + delta;
  const displayRating = newInternalRating * convergenceMultiplier;

  return Math.max(0, Math.ceil(displayRating));
}

// ============================================================================
// OUTPUT BUILDING
// ============================================================================

/**
 * Build the final RatingChange objects with all calculated values.
 */
function buildRatingChanges(
  participants: ParticipantWithRating[],
  rawChanges: Record<number, number>,
): RatingChange[] {
  const changes: RatingChange[] = [];

  for (const p of participants) {
    const delta = rawChanges[p.userId];
    const newInternalRating = p.currentRating + delta;
    const newGamesPlayed = p.gamesPlayed + 1;

    const newConvergencePoints = calculateNewConvergencePoints(
      p.currentConvergencePoints,
      p.position,
    );

    const newDisplayRating = calculateDisplayRating(
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
      newSeasonHigh: Math.max(p.currentSeasonHigh, newDisplayRating),
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
