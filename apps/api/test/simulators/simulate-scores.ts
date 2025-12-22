#!/usr/bin/env ts-node

/**
 * Simulate CLASSIC mode score submissions for F-ZERO 99
 * Uses API endpoints with JWT authentication for realistic testing
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
    console.log(`🔍 Finding latest IN_PROGRESS game...`);

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

    console.log(`✅ Found IN_PROGRESS game: ${category} Season ${seasonNumber}, Match ${matchNumber}`);
    console.log(`   Game ID: ${game.id}`);
    console.log(`   ${game.participants.length} scores submitted, ${this.users.length} fake users waiting`);

    return game;
  }

  async findGameByCategorySeasonMatch(category: string, season: number, match: number) {
    console.log(`🔍 Finding game for ${category} Season ${season}, Match ${match}...`);

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

    console.log(`✅ Found game with ${game.participants.length} scores submitted`);
    console.log(`   ${this.users.length} fake users waiting to submit scores`);

    return game;
  }

  generateClassicScore(dnfRace: number | null = null): { machine: string; assistEnabled: boolean; raceResults: RaceResult[] } {
    const machine = faker.helpers.arrayElement(F99_MACHINES);
    const assistEnabled = faker.datatype.boolean(0.15);

    const raceResults: RaceResult[] = [];

    for (let race = 1; race <= 3; race++) {
      if (dnfRace !== null && race >= dnfRace) {
        // DNF at this race or after
        raceResults.push({
          raceNumber: race,
          position: undefined,
          isEliminated: true,
        });
      } else {
        // Normal race - generate position 1-20
        const position = faker.number.int({ min: 1, max: 20 });
        raceResults.push({
          raceNumber: race,
          position,
          isEliminated: false,
        });
      }
    }

    return { machine, assistEnabled, raceResults };
  }

  async submitScore(user: any, dnfRace: number | null = null) {
    const { machine, assistEnabled, raceResults } = this.generateClassicScore(dnfRace);

    const category = this.game.match.season?.event?.category?.toLowerCase() || 'classic';
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
      const dnfText = dnfRace ? `DNF race ${dnfRace}` : this.calculateTotalPoints(raceResults) + ' pts';
      console.log(
        `   📤 ${displayName}: ${dnfText} | ${machine}${assistEnabled ? ' +Assist' : ''}`
      );

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

  calculateTotalPoints(raceResults: RaceResult[]): number {
    let total = 0;
    for (const race of raceResults) {
      if (!race.isEliminated && race.position) {
        // 1st = 100, 2nd = 95, ... 20th = 5
        total += 105 - (race.position * 5);
      }
    }
    return total;
  }

  async simulateGradual(delayMs: number = 2000) {
    console.log(`\n🎮 Starting CLASSIC score submissions...`);
    console.log(`   ${this.users.length} fake users, ${delayMs}ms delay\n`);

    if (this.users.length === 0) {
      console.log('⚠️  No fake users waiting to submit scores!');
      return;
    }

    // Shuffle users for randomness
    const shuffledUsers = [...this.users].sort(() => Math.random() - 0.5);

    // Assign DNF status: 4 users each for DNF race 1, 2, 3
    const dnfAssignments: (number | null)[] = [];

    // First 4: DNF race 1
    for (let i = 0; i < 4 && i < shuffledUsers.length; i++) {
      dnfAssignments.push(1);
    }
    // Next 4: DNF race 2
    for (let i = 4; i < 8 && i < shuffledUsers.length; i++) {
      dnfAssignments.push(2);
    }
    // Next 4: DNF race 3
    for (let i = 8; i < 12 && i < shuffledUsers.length; i++) {
      dnfAssignments.push(3);
    }
    // Rest: no DNF
    for (let i = 12; i < shuffledUsers.length; i++) {
      dnfAssignments.push(null);
    }

    // Shuffle again to mix DNF and non-DNF submissions
    const combined = shuffledUsers.map((user, i) => ({ user, dnfRace: dnfAssignments[i] }));
    combined.sort(() => Math.random() - 0.5);

    for (let i = 0; i < combined.length; i++) {
      const { user, dnfRace } = combined[i];
      await this.submitScore(user, dnfRace);

      if (i < combined.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  async simulateBurst() {
    console.log(`\n💥 Starting BURST score submissions...`);
    console.log(`   ${this.users.length} fake users simultaneously\n`);

    if (this.users.length === 0) {
      console.log('⚠️  No fake users waiting to submit scores!');
      return;
    }

    // Shuffle and assign DNF
    const shuffledUsers = [...this.users].sort(() => Math.random() - 0.5);
    const dnfAssignments: (number | null)[] = [];

    for (let i = 0; i < 4 && i < shuffledUsers.length; i++) dnfAssignments.push(1);
    for (let i = 4; i < 8 && i < shuffledUsers.length; i++) dnfAssignments.push(2);
    for (let i = 8; i < 12 && i < shuffledUsers.length; i++) dnfAssignments.push(3);
    for (let i = 12; i < shuffledUsers.length; i++) dnfAssignments.push(null);

    const promises = shuffledUsers.map((user, i) => this.submitScore(user, dnfAssignments[i]));
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

    console.log('🏁 F-ZERO 99 CLASSIC Score Simulator');
    console.log('=====================================\n');

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
      console.log('\n📊 Final Rankings:');
      console.log('==================');
      await this.displayFinalRankings();

      const cat = this.game.match.season?.event?.category?.toLowerCase() || category;
      const seasonNum = this.game.match.season?.seasonNumber || season;
      const matchNum = this.game.match.matchNumber || match;

      console.log(`\n✅ Simulation complete!`);
      console.log(`📊 View at: http://localhost:3001/matches/${cat}/${seasonNum}/${matchNum}`);
    } catch (error) {
      console.error('❌ Error:', error);
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

    let currentRank = 1;
    let prevElim: number | null | undefined = undefined;
    let prevScore: number | null = null;
    let sameRankCount = 0;

    sorted.forEach((p) => {
      const displayName = p.user.displayName || p.user.discordId;
      const score = p.totalScore ?? 0;
      const elim = p.eliminatedAtRace;

      // Determine if this is a tie
      let isTie = false;
      if (prevElim !== undefined) {
        if (elim !== null && elim === prevElim) {
          // Same DNF race = tied
          isTie = true;
        } else if (elim === null && prevElim === null && score === prevScore) {
          // Both finished with same score = tied
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

      const scoreText = elim !== null ? `DNF race ${elim}` : `${score} pts`;
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
