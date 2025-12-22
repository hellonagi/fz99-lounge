#!/usr/bin/env ts-node

/**
 * Debug Rating Calculation
 *
 * Simulates the rating calculation to debug issues
 */

// ==================== CLASSIC MODE CONSTANTS ====================

const CLASSIC_CONFIG = {
  K_FACTOR: 10000,
  K_MULTIPLIER: 0.01,
  SCALE: 1000,
  INITIAL_RATING: 2750,
  PLACEMENT_GAMES: 20,
  INITIAL_COMPARISON_GAMES: 5,
  COMPARISON_RANGE: 3,
  POSITION_BONUS: { 1: 20, 2: 10, 3: 5 } as Record<number, number>,
  MIN_GUARANTEE: { 1: 10, 2: 5, 3: 2 } as Record<number, number>,
  MAX_RATING_CHANGE: 200,
};

interface Player {
  id: string;
  position: number;
  currentRating: number;
  gamesPlayed: number;
}

function normalizePosition(pos: number): number {
  if (pos >= 13 && pos <= 16) return 13;
  if (pos >= 17 && pos <= 20) return 17;
  return pos;
}

function calculateWithAllComparison(
  player: Player,
  allPlayers: Player[],
  normalizedPositions: Record<string, number>
): number {
  const opponents = allPlayers.filter(p => p.id !== player.id);

  if (opponents.length === 0) return 0;

  // 期待スコア
  let expectedScore = 0;
  for (const opponent of opponents) {
    const ratingDiff = opponent.currentRating - player.currentRating;
    expectedScore += 1.0 / (1.0 + Math.pow(10, ratingDiff / CLASSIC_CONFIG.SCALE));
  }
  expectedScore /= opponents.length;

  // 実際のスコア
  // oppPosition > myPosition = 相手が下位 = 自分が勝った
  const myPosition = normalizedPositions[player.id];
  let betterCount = 0,  // 相手が自分より上位（自分が負けた）
    worseCount = 0,     // 相手が自分より下位（自分が勝った）
    sameCount = 0;

  for (const opponent of opponents) {
    const oppPosition = normalizedPositions[opponent.id];
    if (oppPosition < myPosition) betterCount++;      // 相手が上位 = 自分が負けた
    else if (oppPosition > myPosition) worseCount++;  // 相手が下位 = 自分が勝った
    else sameCount++;
  }

  const actualScore = (worseCount + sameCount * 0.5) / opponents.length;

  console.log(`  Player ${player.id} (pos=${player.position}):`);
  console.log(`    expectedScore = ${expectedScore.toFixed(4)}`);
  console.log(`    actualScore = ${actualScore.toFixed(4)} (better=${betterCount}, worse=${worseCount}, same=${sameCount})`);
  console.log(`    delta (before zerosum) = ${(CLASSIC_CONFIG.K_FACTOR * CLASSIC_CONFIG.K_MULTIPLIER * (actualScore - expectedScore)).toFixed(2)}`);

  return CLASSIC_CONFIG.K_FACTOR * CLASSIC_CONFIG.K_MULTIPLIER * (actualScore - expectedScore);
}

function enforceZeroSum(rawChanges: Record<string, number>): void {
  const total = Object.values(rawChanges).reduce((a, b) => a + b, 0);
  const playerCount = Object.keys(rawChanges).length;

  console.log(`\nZeroSum: total before = ${total.toFixed(2)}`);

  if (Math.abs(total) > 0.01 && playerCount > 0) {
    const avgAdjustment = total / playerCount;
    for (const userId of Object.keys(rawChanges)) {
      rawChanges[userId] -= avgAdjustment;
    }
  }
}

function capMaxChange(rawChanges: Record<string, number>): void {
  const maxAbsChange = Math.max(...Object.values(rawChanges).map(v => Math.abs(v)));

  console.log(`\nCap: maxAbsChange = ${maxAbsChange.toFixed(2)}, limit = ${CLASSIC_CONFIG.MAX_RATING_CHANGE}`);

  if (maxAbsChange > CLASSIC_CONFIG.MAX_RATING_CHANGE) {
    const scaleFactor = CLASSIC_CONFIG.MAX_RATING_CHANGE / maxAbsChange;
    console.log(`  Scaling by ${scaleFactor.toFixed(4)}`);
    for (const userId of Object.keys(rawChanges)) {
      rawChanges[userId] *= scaleFactor;
    }
  }
}

function applyPositionBonuses(
  rawChanges: Record<string, number>,
  players: Player[]
): void {
  console.log(`\nPosition Bonuses:`);

  // Step 1: ボーナス追加
  for (const p of players) {
    if (CLASSIC_CONFIG.POSITION_BONUS[p.position]) {
      const bonus = CLASSIC_CONFIG.POSITION_BONUS[p.position];
      rawChanges[p.id] += bonus;
      console.log(`  Player ${p.id} (pos=${p.position}): +${bonus} bonus`);
    }
  }

  // Step 2: 最低保証確認
  const adjustmentsNeeded: Record<string, number> = {};

  for (const p of players) {
    const minGuarantee = CLASSIC_CONFIG.MIN_GUARANTEE[p.position];
    if (minGuarantee !== undefined) {
      const currentChange = rawChanges[p.id];
      if (currentChange < minGuarantee) {
        adjustmentsNeeded[p.id] = minGuarantee - currentChange;
        console.log(`  Player ${p.id} needs guarantee adjustment: +${adjustmentsNeeded[p.id].toFixed(2)}`);
      }
    }
  }

  // Step 3: ゼロサム調整
  const totalBonus = Object.values(CLASSIC_CONFIG.POSITION_BONUS).reduce((a, b) => a + b, 0);
  const totalShortage = Object.values(adjustmentsNeeded).reduce((a, b) => a + b, 0);
  const totalAdjustment = totalBonus + totalShortage;

  console.log(`  totalBonus = ${totalBonus}, totalShortage = ${totalShortage.toFixed(2)}, totalAdjustment = ${totalAdjustment.toFixed(2)}`);

  if (totalAdjustment > 0) {
    const nonTop3Players = players.filter(p => !CLASSIC_CONFIG.POSITION_BONUS[p.position]);

    if (nonTop3Players.length > 0) {
      const perPlayerReduction = totalAdjustment / nonTop3Players.length;
      console.log(`  Reducing ${nonTop3Players.length} non-top3 players by ${perPlayerReduction.toFixed(2)} each`);

      for (const p of nonTop3Players) {
        rawChanges[p.id] -= perPlayerReduction;
      }

      for (const id of Object.keys(adjustmentsNeeded)) {
        rawChanges[id] += adjustmentsNeeded[id];
      }
    }
  }
}

function simulateMatch(numPlayers: number): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Simulating ${numPlayers}-player match with all players at initial rating`);
  console.log(`${'='.repeat(60)}\n`);

  // Create players
  const players: Player[] = [];
  for (let i = 1; i <= numPlayers; i++) {
    players.push({
      id: `player_${i}`,
      position: i,
      currentRating: CLASSIC_CONFIG.INITIAL_RATING,
      gamesPlayed: 0, // First game
    });
  }

  // Normalize positions
  const normalizedPositions: Record<string, number> = {};
  for (const p of players) {
    normalizedPositions[p.id] = normalizePosition(p.position);
  }

  // Calculate raw changes
  console.log('Raw rating changes (before zerosum):');
  const rawChanges: Record<string, number> = {};
  for (const player of players) {
    rawChanges[player.id] = calculateWithAllComparison(player, players, normalizedPositions);
  }

  // Apply zerosum
  enforceZeroSum(rawChanges);

  // Cap max change
  capMaxChange(rawChanges);

  // Apply bonuses
  applyPositionBonuses(rawChanges, players);

  // Print final results
  console.log(`\n${'='.repeat(60)}`);
  console.log('Final Rating Changes:');
  console.log(`${'='.repeat(60)}`);

  for (const p of players) {
    const change = rawChanges[p.id];
    const newRating = p.currentRating + change;
    console.log(`  ${p.id} (pos=${p.position}): ${change >= 0 ? '+' : ''}${change.toFixed(2)} → ${newRating.toFixed(2)}`);
  }

  // Verify zerosum
  const totalChange = Object.values(rawChanges).reduce((a, b) => a + b, 0);
  console.log(`\nTotal change (should be ~0): ${totalChange.toFixed(4)}`);
}

// Run simulations
simulateMatch(20);
simulateMatch(12);
