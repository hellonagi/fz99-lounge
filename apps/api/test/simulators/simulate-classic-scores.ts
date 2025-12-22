#!/usr/bin/env ts-node

/**
 * Simulate CLASSIC mode score submissions with realistic race progression
 * - Race1: 16 players, positions 1-16, bottom 4 eliminated
 * - Race2: 12 players, positions 1-12, bottom 4 eliminated
 * - Race3: 8 players, positions 1-8, bottom 4 eliminated
 * - No duplicate positions per race
 * - Considers real user submissions
 */

import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';
import axios from 'axios';
import * as jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

const API_URL = process.env.API_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_for_testing_only';

const F99_MACHINES = ['Blue Falcon', 'Golden Fox', 'Wild Goose', 'Fire Stingray'];

interface RaceResult {
  raceNumber: number;
  position?: number | null;
  isEliminated: boolean;
}

interface UserWithToken {
  id: number;
  discordId: string;
  displayName: string | null;
  isFake: boolean;
  token: string;
}

interface RaceAssignment {
  user: UserWithToken;
  raceResults: RaceResult[];
}

class ClassicScoreSimulator {
  private game: any = null;
  private fakeUsers: UserWithToken[] = [];
  private realUserSubmissions: Map<number, RaceResult[]> = new Map(); // userId -> raceResults

  async findInProgressClassicGame() {
    console.log(`\n🔍 Finding IN_PROGRESS CLASSIC game...`);

    const game = await prisma.game.findFirst({
      where: {
        match: {
          status: 'IN_PROGRESS',
          season: {
            event: {
              category: 'CLASSIC',
            },
          },
        },
      },
      orderBy: {
        startedAt: 'desc',
      },
      include: {
        match: {
          include: {
            participants: {
              include: {
                user: true,
              },
            },
            season: {
              include: {
                event: true,
              },
            },
          },
        },
        participants: {
          include: {
            user: true,
            raceResults: true,
          },
        },
      },
    });

    if (!game) {
      throw new Error('No IN_PROGRESS CLASSIC game found. Please start a CLASSIC match first.');
    }

    const category = game.match.season?.event?.category;
    if (category !== 'CLASSIC') {
      throw new Error(`Game category is ${category}, not CLASSIC.`);
    }

    this.game = game;

    // Collect real user submissions (already submitted scores)
    for (const participant of game.participants) {
      if (!participant.user.isFake) {
        this.realUserSubmissions.set(participant.userId, participant.raceResults);
      }
    }

    // Get fake users who are match participants but haven't submitted game scores yet
    const submittedUserIds = new Set(game.participants.map((p: any) => p.userId));
    this.fakeUsers = game.match.participants
      .filter((p: any) => p.user.isFake && !submittedUserIds.has(p.userId))
      .map((p: any) => ({
        id: p.user.id,
        discordId: p.user.discordId,
        displayName: p.user.displayName,
        isFake: true,
        token: jwt.sign(
          {
            sub: p.user.id,
            discordId: p.user.discordId,
            role: 'PLAYER',
          },
          JWT_SECRET,
          { expiresIn: '1h' }
        ),
      }));

    const seasonNumber = game.match.season?.seasonNumber || 'Unknown';
    const matchNumber = game.match.matchNumber || 'Unknown';

    console.log(`✅ Found CLASSIC game: Season ${seasonNumber}, Match ${matchNumber}`);
    console.log(`   Game ID: ${game.id}`);
    console.log(`   Total match participants: ${game.match.participants.length}`);
    console.log(`   Already submitted: ${game.participants.length}`);
    console.log(`   Real users submitted: ${this.realUserSubmissions.size}`);
    console.log(`   Fake users waiting: ${this.fakeUsers.length}`);

    return game;
  }

  /**
   * Generate race assignments for all fake users
   * Ensures no duplicate positions per race
   * Considers real user submissions
   */
  generateRaceAssignments(): RaceAssignment[] {
    const totalParticipants = this.game.match.participants.length;
    const fakeCount = this.fakeUsers.length;

    console.log(`\n📋 Generating race assignments for ${fakeCount} fake users...`);

    // Get positions already taken by real users for each race
    const takenPositions: Map<number, Set<number>> = new Map([
      [1, new Set()],
      [2, new Set()],
      [3, new Set()],
    ]);

    // Also track which real users are eliminated at which race
    const realUserEliminations: Map<number, number | null> = new Map(); // userId -> eliminatedAtRace

    for (const [userId, raceResults] of this.realUserSubmissions) {
      let eliminatedAt: number | null = null;
      for (const result of raceResults) {
        if (result.isEliminated) {
          eliminatedAt = result.raceNumber;
          break;
        }
        if (result.position) {
          takenPositions.get(result.raceNumber)?.add(result.position);
        }
      }
      realUserEliminations.set(userId, eliminatedAt);
    }

    console.log(`   Race 1 taken positions: ${Array.from(takenPositions.get(1) || []).sort((a, b) => a - b).join(', ') || 'none'}`);
    console.log(`   Race 2 taken positions: ${Array.from(takenPositions.get(2) || []).sort((a, b) => a - b).join(', ') || 'none'}`);
    console.log(`   Race 3 taken positions: ${Array.from(takenPositions.get(3) || []).sort((a, b) => a - b).join(', ') || 'none'}`);

    // Calculate how many fake users need to be eliminated at each race
    // Total 16 players: Race1 eliminates 4, Race2 eliminates 4, Race3 eliminates 4, 4 survive
    const realUsersEliminatedAt1 = Array.from(realUserEliminations.values()).filter(r => r === 1).length;
    const realUsersEliminatedAt2 = Array.from(realUserEliminations.values()).filter(r => r === 2).length;
    const realUsersEliminatedAt3 = Array.from(realUserEliminations.values()).filter(r => r === 3).length;
    const realUsersSurvived = Array.from(realUserEliminations.values()).filter(r => r === null).length;

    const fakeToEliminateAt1 = Math.max(0, 4 - realUsersEliminatedAt1);
    const fakeToEliminateAt2 = Math.max(0, 4 - realUsersEliminatedAt2);
    const fakeToEliminateAt3 = Math.max(0, 4 - realUsersEliminatedAt3);
    const fakeToSurvive = fakeCount - fakeToEliminateAt1 - fakeToEliminateAt2 - fakeToEliminateAt3;

    console.log(`\n   Elimination distribution:`);
    console.log(`   - Race 1: ${fakeToEliminateAt1} fake users (+ ${realUsersEliminatedAt1} real)`);
    console.log(`   - Race 2: ${fakeToEliminateAt2} fake users (+ ${realUsersEliminatedAt2} real)`);
    console.log(`   - Race 3: ${fakeToEliminateAt3} fake users (+ ${realUsersEliminatedAt3} real)`);
    console.log(`   - Survive: ${fakeToSurvive} fake users (+ ${realUsersSurvived} real)`);

    // Shuffle fake users
    const shuffledFakeUsers = [...this.fakeUsers].sort(() => Math.random() - 0.5);

    // Assign elimination fate to each fake user
    const assignments: RaceAssignment[] = [];
    let idx = 0;

    // Users eliminated at Race 1 (positions 13-16)
    const race1EliminatedUsers = shuffledFakeUsers.slice(idx, idx + fakeToEliminateAt1);
    idx += fakeToEliminateAt1;

    // Users eliminated at Race 2 (positions 9-12 in race 2)
    const race2EliminatedUsers = shuffledFakeUsers.slice(idx, idx + fakeToEliminateAt2);
    idx += fakeToEliminateAt2;

    // Users eliminated at Race 3 (positions 5-8 in race 3)
    const race3EliminatedUsers = shuffledFakeUsers.slice(idx, idx + fakeToEliminateAt3);
    idx += fakeToEliminateAt3;

    // Survivors
    const survivorUsers = shuffledFakeUsers.slice(idx);

    // Helper to get available positions
    const getAvailablePositions = (raceNum: number, min: number, max: number): number[] => {
      const taken = takenPositions.get(raceNum) || new Set();
      const available: number[] = [];
      for (let i = min; i <= max; i++) {
        if (!taken.has(i)) available.push(i);
      }
      return available;
    };

    // Helper to pick and mark position as taken
    const pickPosition = (raceNum: number, available: number[]): number => {
      const idx = Math.floor(Math.random() * available.length);
      const pos = available[idx];
      available.splice(idx, 1);
      takenPositions.get(raceNum)?.add(pos);
      return pos;
    };

    // Generate assignments for Race 1 eliminated users
    const race1BottomPositions = getAvailablePositions(1, 13, 16);
    for (const user of race1EliminatedUsers) {
      const pos = pickPosition(1, race1BottomPositions);
      assignments.push({
        user,
        raceResults: [
          { raceNumber: 1, position: pos, isEliminated: true },
          { raceNumber: 2, isEliminated: true },
          { raceNumber: 3, isEliminated: true },
        ],
      });
    }

    // Generate assignments for Race 2 eliminated users
    const race1MidHighPositions = getAvailablePositions(1, 1, 12);
    const race2BottomPositions = getAvailablePositions(2, 9, 12);
    for (const user of race2EliminatedUsers) {
      const pos1 = pickPosition(1, race1MidHighPositions);
      const pos2 = pickPosition(2, race2BottomPositions);
      assignments.push({
        user,
        raceResults: [
          { raceNumber: 1, position: pos1, isEliminated: false },
          { raceNumber: 2, position: pos2, isEliminated: true },
          { raceNumber: 3, isEliminated: true },
        ],
      });
    }

    // Generate assignments for Race 3 eliminated users
    const race2MidHighPositions = getAvailablePositions(2, 1, 8);
    const race3BottomPositions = getAvailablePositions(3, 5, 8);
    for (const user of race3EliminatedUsers) {
      const pos1 = pickPosition(1, getAvailablePositions(1, 1, 12));
      const pos2 = pickPosition(2, race2MidHighPositions);
      const pos3 = pickPosition(3, race3BottomPositions);
      assignments.push({
        user,
        raceResults: [
          { raceNumber: 1, position: pos1, isEliminated: false },
          { raceNumber: 2, position: pos2, isEliminated: false },
          { raceNumber: 3, position: pos3, isEliminated: true },
        ],
      });
    }

    // Generate assignments for survivors
    const race3TopPositions = getAvailablePositions(3, 1, 4);
    for (const user of survivorUsers) {
      const pos1 = pickPosition(1, getAvailablePositions(1, 1, 12));
      const pos2 = pickPosition(2, getAvailablePositions(2, 1, 8));
      const pos3 = pickPosition(3, race3TopPositions);
      assignments.push({
        user,
        raceResults: [
          { raceNumber: 1, position: pos1, isEliminated: false },
          { raceNumber: 2, position: pos2, isEliminated: false },
          { raceNumber: 3, position: pos3, isEliminated: false },
        ],
      });
    }

    return assignments;
  }

  async submitScore(user: UserWithToken, raceResults: RaceResult[]) {
    const machine = faker.helpers.arrayElement(F99_MACHINES);
    const assistEnabled = faker.datatype.boolean(0.15);

    const category = 'classic';
    const season = this.game.match.season?.seasonNumber;
    const match = this.game.match.matchNumber;

    try {
      const response = await axios.post(
        `${API_URL}/api/games/${category}/${season}/${match}/score`,
        {
          machine,
          assistEnabled,
          raceResults,
        },
        {
          headers: {
            Authorization: `Bearer ${user.token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const displayName = user.displayName || user.discordId;
      const resultText = this.formatRaceResults(raceResults);
      console.log(`   📤 ${displayName}: ${resultText} | ${machine}${assistEnabled ? ' +Assist' : ''}`);

      return response.data;
    } catch (error: any) {
      const displayName = user.displayName || user.discordId;
      console.error(
        `   ❌ ${displayName} failed to submit:`,
        error.response?.data?.message || error.message
      );
      throw error;
    }
  }

  formatRaceResults(raceResults: RaceResult[]): string {
    const parts: string[] = [];
    for (const r of raceResults) {
      if (r.isEliminated && !r.position) {
        parts.push('-');
      } else if (r.isEliminated) {
        parts.push(`${r.position}*`);
      } else {
        parts.push(`${r.position}`);
      }
    }
    return `[${parts.join(', ')}]`;
  }

  calculateTotalPoints(raceResults: RaceResult[]): number {
    let total = 0;
    for (const race of raceResults) {
      if (!race.isEliminated && race.position) {
        // Assuming 1st = 100, 2nd = 95, ... 20th = 5
        total += 105 - race.position * 5;
      } else if (race.isEliminated && race.position) {
        // Eliminated but has position (e.g., Race 1 elimination)
        total += 105 - race.position * 5;
      }
    }
    return total;
  }

  async simulate(delayMs: number = 1000) {
    const assignments = this.generateRaceAssignments();

    console.log(`\n🎮 Starting CLASSIC score submissions...`);
    console.log(`   ${assignments.length} fake users, ${delayMs}ms delay\n`);

    if (assignments.length === 0) {
      console.log('⚠️  No fake users waiting to submit scores!');
      return;
    }

    // Shuffle submission order
    const shuffledAssignments = [...assignments].sort(() => Math.random() - 0.5);

    for (let i = 0; i < shuffledAssignments.length; i++) {
      const { user, raceResults } = shuffledAssignments[i];
      await this.submitScore(user, raceResults);

      if (i < shuffledAssignments.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  async displayFinalRankings() {
    if (!this.game) return;

    const participants = await prisma.gameParticipant.findMany({
      where: {
        gameId: this.game.id,
      },
      orderBy: [
        { totalScore: 'desc' },
        { eliminatedAtRace: 'desc' },
      ],
      include: {
        user: {
          select: {
            displayName: true,
            discordId: true,
            isFake: true,
          },
        },
        raceResults: {
          orderBy: { raceNumber: 'asc' },
        },
      },
    });

    // Sort: Non-DNF by score, then DNF race 3, then DNF race 2, then DNF race 1
    const sorted = [...participants].sort((a, b) => {
      const aElim = a.eliminatedAtRace;
      const bElim = b.eliminatedAtRace;

      if (aElim === null && bElim === null) {
        return (b.totalScore ?? 0) - (a.totalScore ?? 0);
      }
      if (aElim === null) return -1;
      if (bElim === null) return 1;
      return bElim - aElim;
    });

    console.log('\n📊 Final Rankings:');
    console.log('==================');

    let rank = 1;
    for (const p of sorted) {
      const displayName = p.user.displayName || p.user.discordId;
      const fakeTag = p.user.isFake ? '' : ' [REAL]';
      const elim = p.eliminatedAtRace;
      const scoreText = elim !== null ? `DNF R${elim}` : `${p.totalScore ?? 0} pts`;

      const races = p.raceResults.map(r => {
        if (r.isEliminated && !r.position) return '-';
        if (r.isEliminated) return `${r.position}*`;
        return `${r.position}`;
      }).join(', ');

      console.log(
        `   #${String(rank).padStart(2)} | ${scoreText.padStart(8)} | [${races.padEnd(10)}] | ${displayName}${fakeTag}`
      );
      rank++;
    }
  }

  async run() {
    console.log('🏁 F-ZERO 99 CLASSIC Score Simulator');
    console.log('=====================================');

    try {
      await this.findInProgressClassicGame();
      await this.simulate(1000);
      await this.displayFinalRankings();

      const season = this.game.match.season?.seasonNumber;
      const match = this.game.match.matchNumber;

      console.log(`\n✅ Simulation complete!`);
      console.log(`📊 View at: http://localhost:3001/matches/classic/${season}/${match}`);
    } catch (error: any) {
      console.error('❌ Error:', error.message || error);
    } finally {
      await prisma.$disconnect();
    }
  }
}

// CLI execution
if (require.main === module) {
  const simulator = new ClassicScoreSimulator();
  simulator.run().catch(console.error);
}

export { ClassicScoreSimulator };
