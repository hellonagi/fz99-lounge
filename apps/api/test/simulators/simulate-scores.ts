#!/usr/bin/env ts-node

/**
 * Simulate score submissions for F-ZERO 99
 * Uses API endpoints with JWT authentication for realistic testing
 *
 * Generates unique positions per race across all users to avoid conflicts.
 */

import { PrismaClient, EventCategory } from '@prisma/client';
import { faker } from '@faker-js/faker';
import axios from 'axios';
import * as jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

const API_URL = process.env.API_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_for_testing_only';

const F99_MACHINES = [
  'Blue Falcon',
  'Golden Fox',
  'Wild Goose',
  'Fire Stingray',
];

interface RaceResult {
  raceNumber: number;
  position?: number;
  isEliminated: boolean;
}

interface UserScore {
  user: any;
  machine: string;
  assistEnabled: boolean;
  raceResults: RaceResult[];
}

interface SimulationOptions {
  mode?: 'gradual' | 'fast' | 'burst';
  count?: number;
  category?: string;
  season?: number;
  match?: number;
  useLatest?: boolean;
  submitAll?: boolean;
}

class ScoreSimulator {
  private game: any = null;
  private users: any[] = [];

  async findLatestInProgressGame() {
    console.log(`Finding latest IN_PROGRESS game...`);

    const game = await prisma.game.findFirst({
      where: {
        match: {
          status: 'IN_PROGRESS',
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
          },
        },
      },
    });

    if (!game) {
      throw new Error('No IN_PROGRESS game found. Please start a match first.');
    }

    this.game = game;

    // Get fake users who are match participants but haven't submitted game scores yet
    const submittedUserIds = new Set(game.participants.map((p: any) => p.userId));
    this.users = game.match.participants
      .filter((p: any) => p.user.isFake && !submittedUserIds.has(p.userId))
      .map((p: any) => ({
        ...p.user,
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

    const category = game.match.season?.event?.category || 'Unknown';
    const seasonNumber = game.match.season?.seasonNumber || 'Unknown';
    const matchNumber = game.match.matchNumber || 'Unknown';

    console.log(`Found IN_PROGRESS game: ${category} Season ${seasonNumber}, Match ${matchNumber}`);
    console.log(`   Game ID: ${game.id}`);
    console.log(`   ${game.participants.length} scores submitted, ${this.users.length} fake users waiting`);

    return game;
  }

  async findGameByCategorySeasonMatch(category: string, season: number, match: number) {
    console.log(`Finding game for ${category} Season ${season}, Match ${match}...`);

    const eventCategory = category.toUpperCase() as EventCategory;

    const game = await prisma.game.findFirst({
      where: {
        match: {
          matchNumber: match,
          season: {
            seasonNumber: season,
            event: {
              category: eventCategory,
            },
          },
        },
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
          },
        },
      },
    });

    if (!game) {
      throw new Error(`Game not found for ${category} Season ${season}, Match ${match}`);
    }

    this.game = game;

    // Get fake users who are match participants but haven't submitted game scores yet
    const submittedUserIds = new Set(game.participants.map((p: any) => p.userId));
    this.users = game.match.participants
      .filter((p: any) => p.user.isFake && !submittedUserIds.has(p.userId))
      .map((p: any) => ({
        ...p.user,
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

    console.log(`Found game with ${game.participants.length} scores submitted`);
    console.log(`   ${this.users.length} fake users waiting to submit scores`);

    return game;
  }

  private get isGpMode(): boolean {
    return this.game?.match?.season?.event?.category === 'GP';
  }

  private get raceCount(): number {
    return this.isGpMode ? 5 : 3;
  }

  // Per-race max positions and elimination thresholds
  private get raceMaxPositions(): number[] {
    return this.isGpMode ? [99, 80, 60, 40, 20] : [20, 16, 12];
  }
  private get eliminationThresholds(): (number | null)[] {
    return this.isGpMode ? [81, 61, 41, 21, null] : [17, 13, 9];
  }

  /**
   * Generate all user scores at once with unique positions per race.
   * Simulates a realistic race: each race has unique positions,
   * eliminated players don't participate in subsequent races.
   */
  generateAllScores(users: any[]): UserScore[] {
    const userCount = users.length;
    const scores: UserScore[] = users.map(user => ({
      user,
      machine: faker.helpers.arrayElement(F99_MACHINES),
      assistEnabled: faker.datatype.boolean(0.15),
      raceResults: [],
    }));

    // Track which users are still alive (by index)
    let aliveIndices = Array.from({ length: userCount }, (_, i) => i);

    for (let race = 1; race <= this.raceCount; race++) {
      const raceMax = this.raceMaxPositions[race - 1];
      const threshold = this.eliminationThresholds[race - 1];

      // Shuffle alive users for random position assignment
      const shuffled = [...aliveIndices].sort(() => Math.random() - 0.5);
      const aliveCount = shuffled.length;

      // Determine how many get eliminated this race
      let eliminatedCount = 0;
      if (threshold !== null) {
        // Eliminate ~20-30% of alive users, but respect position limits
        const maxSurvivors = threshold - 1; // positions 1..threshold-1 survive
        eliminatedCount = Math.max(0, aliveCount - maxSurvivors);
        if (eliminatedCount === 0 && aliveCount > maxSurvivors) {
          eliminatedCount = aliveCount - maxSurvivors;
        }
        // Add some randomness: eliminate a few extra sometimes
        const extraElim = Math.floor(Math.random() * Math.min(3, maxSurvivors));
        eliminatedCount = Math.min(aliveCount - 1, eliminatedCount + extraElim);
      }

      const survivorCount = aliveCount - eliminatedCount;

      // Assign unique positions to survivors (1..maxSurvival)
      const maxSurvival = threshold ? threshold - 1 : raceMax;
      const survivorPositions = this.pickUniquePositions(survivorCount, 1, maxSurvival);

      // Assign unique positions to eliminated (threshold..raceMax)
      let eliminatedPositions: number[] = [];
      if (eliminatedCount > 0 && threshold !== null) {
        eliminatedPositions = this.pickUniquePositions(eliminatedCount, threshold, raceMax);
      }

      const eliminatedIndices = new Set<number>();

      // Assign survivor positions
      for (let i = 0; i < survivorCount; i++) {
        const userIdx = shuffled[i];
        scores[userIdx].raceResults.push({
          raceNumber: race,
          position: survivorPositions[i],
          isEliminated: false,
        });
      }

      // Assign eliminated positions
      for (let i = 0; i < eliminatedCount; i++) {
        const userIdx = shuffled[survivorCount + i];
        scores[userIdx].raceResults.push({
          raceNumber: race,
          position: eliminatedPositions[i],
          isEliminated: true,
        });
        eliminatedIndices.add(userIdx);
      }

      // Update alive list
      aliveIndices = aliveIndices.filter(idx => !eliminatedIndices.has(idx));
    }

    return scores;
  }

  /**
   * Pick `count` unique random positions from [min..max].
   * If count > range, some positions will be duplicated (same-rank tie).
   */
  private pickUniquePositions(count: number, min: number, max: number): number[] {
    const range = max - min + 1;
    if (count <= range) {
      // Enough unique positions available
      const all = Array.from({ length: range }, (_, i) => min + i);
      // Fisher-Yates shuffle
      for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [all[i], all[j]] = [all[j], all[i]];
      }
      return all.slice(0, count);
    } else {
      // More users than positions - allow ties (use all positions, then repeat)
      const positions: number[] = [];
      const all = Array.from({ length: range }, (_, i) => min + i);
      // First fill with all unique positions
      positions.push(...all);
      // Remaining users get random positions (ties)
      for (let i = range; i < count; i++) {
        positions.push(faker.number.int({ min, max }));
      }
      // Shuffle the whole thing
      for (let i = positions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [positions[i], positions[j]] = [positions[j], positions[i]];
      }
      return positions;
    }
  }

  calculateTotalPoints(raceResults: RaceResult[]): number {
    let total = 0;
    for (const race of raceResults) {
      if (race.position) {
        if (this.isGpMode) {
          if (race.position === 1) total += 200;
          else if (race.position === 2) total += 196;
          else total += 200 - race.position * 2;
        } else {
          total += 105 - (race.position * 5);
        }
      }
    }
    return total;
  }

  async submitScore(userScore: UserScore) {
    const { user, machine, assistEnabled, raceResults } = userScore;
    const category = this.game.match.season?.event?.category?.toLowerCase() || 'classic';
    const season = this.game.match.season?.seasonNumber;
    const match = this.game.match.matchNumber;

    try {
      const response = await axios.post(
        `${API_URL}/api/games/${category}/${season}/${match}/score`,
        { machine, assistEnabled, raceResults },
        {
          headers: {
            Authorization: `Bearer ${user.token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const displayName = user.displayName || user.discordId;
      const lastRace = raceResults[raceResults.length - 1];
      const dnfText = lastRace?.isEliminated
        ? `DNF R${lastRace.raceNumber}`
        : this.calculateTotalPoints(raceResults) + ' pts';
      console.log(
        `   ${displayName}: ${dnfText} | ${machine}${assistEnabled ? ' +Assist' : ''}`
      );

      return response.data;
    } catch (error: any) {
      const displayName = user.displayName || user.discordId;
      console.error(
        `   [ERROR] ${displayName} failed:`,
        error.response?.data?.message || error.message
      );
      throw error;
    }
  }

  async simulateGradual(delayMs: number = 2000) {
    const modeLabel = this.isGpMode ? 'GP' : 'CLASSIC';
    console.log(`\nStarting ${modeLabel} score submissions (${this.raceCount} races)...`);
    console.log(`   ${this.users.length} fake users, ${delayMs}ms delay\n`);

    if (this.users.length === 0) {
      console.log('No fake users waiting to submit scores!');
      return;
    }

    const allScores = this.generateAllScores(this.users);

    // Shuffle submission order
    const shuffled = [...allScores].sort(() => Math.random() - 0.5);

    for (let i = 0; i < shuffled.length; i++) {
      await this.submitScore(shuffled[i]);
      if (i < shuffled.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  async simulateBurst() {
    console.log(`\nStarting BURST score submissions...`);
    console.log(`   ${this.users.length} fake users simultaneously\n`);

    if (this.users.length === 0) {
      console.log('No fake users waiting to submit scores!');
      return;
    }

    const allScores = this.generateAllScores(this.users);
    const promises = allScores.map(score => this.submitScore(score));
    await Promise.allSettled(promises);
  }

  async run(options: SimulationOptions = {}) {
    const {
      mode = 'gradual',
      category = 'classic',
      season = 1,
      match = 1,
      useLatest = false,
    } = options;

    console.log('F-ZERO 99 Score Simulator');
    console.log('========================\n');

    try {
      if (useLatest) {
        await this.findLatestInProgressGame();
      } else {
        await this.findGameByCategorySeasonMatch(category, season, match);
      }

      switch (mode) {
        case 'gradual':
          await this.simulateGradual(2000);
          break;
        case 'fast':
          await this.simulateGradual(500);
          break;
        case 'burst':
          await this.simulateBurst();
          break;
      }

      // Display final rankings
      console.log('\nFinal Rankings:');
      console.log('==============');
      await this.displayFinalRankings();

      const cat = this.game.match.season?.event?.category?.toLowerCase() || category;
      const seasonNum = this.game.match.season?.seasonNumber || season;
      const matchNum = this.game.match.matchNumber || match;

      console.log(`\nSimulation complete!`);
      console.log(`View at: http://localhost:3001/matches/${cat}/${seasonNum}/${matchNum}`);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      await prisma.$disconnect();
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
          },
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

    let currentRank = 1;
    let prevElim: number | null | undefined = undefined;
    let prevScore: number | null = null;
    let sameRankCount = 0;

    sorted.forEach((p) => {
      const displayName = p.user.displayName || p.user.discordId;
      const score = p.totalScore ?? 0;
      const elim = p.eliminatedAtRace;

      let isTie = false;
      if (prevElim !== undefined) {
        if (elim !== null && elim === prevElim) {
          isTie = true;
        } else if (elim === null && prevElim === null && score === prevScore) {
          isTie = true;
        }
      }

      if (isTie) {
        sameRankCount++;
      } else {
        currentRank += sameRankCount;
        sameRankCount = 1;
      }

      prevElim = elim;
      prevScore = score;

      const scoreText = elim !== null ? `DNF R${elim}` : `${score} pts`;
      const assistText = p.assistEnabled ? ' [ASSIST]' : '';

      console.log(
        `   #${String(currentRank).padStart(2)} | ${scoreText.padStart(12)} | ${displayName.padEnd(15)} | ${p.machine}${assistText}`
      );
    });
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const useLatest = args.includes('--latest');
  const mode = (args.find(arg => ['gradual', 'fast', 'burst'].includes(arg)) as 'gradual' | 'fast' | 'burst') || 'gradual';

  const simulator = new ScoreSimulator();
  simulator.run({ mode, useLatest }).catch(console.error);
}

export { ScoreSimulator };
