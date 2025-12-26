#!/usr/bin/env ts-node

/**
 * Simulate CLASSIC mode score submissions with realistic race progression
 * - Race1: positions 1-20, 17-20位がDNF (4人脱落)
 * - Race2: positions 1-16, 13-16位がDNF (4人脱落)
 * - Race3: positions 1-12, 9-12位がDNF (4人脱落)
 * - DNFでも順位に応じたポイントを獲得
 * - DNF後のレースは position: null (参加していない)
 * - 順位は単純にtotalScore順
 * - スクショ提出もシミュレート
 */

import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';
import axios from 'axios';
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const API_URL = process.env.API_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_for_testing_only';

const F99_MACHINES = ['Blue Falcon', 'Golden Fox', 'Wild Goose', 'Fire Stingray'];

// Test image for screenshot simulation
const TEST_IMAGE_PATH = path.join(__dirname, '../fixtures/test-screenshot.png');

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
   * Race1: 1-20位, 17-20位がDNF
   * Race2: 1-16位, 13-16位がDNF
   * Race3: 1-12位, 9-12位がDNF
   * DNF後のレースはposition: null（参加していない）
   */
  generateRaceAssignments(): RaceAssignment[] {
    const totalParticipants = this.game.match.participants.length;
    const fakeCount = this.fakeUsers.length;

    console.log(`\n📋 Generating race assignments for ${fakeCount} fake users (${totalParticipants} total participants)...`);

    // Fixed position ranges for CLASSIC mode
    const race1Max = 20;
    const race1DnfMin = 17; // 17-20がDNF
    const race2Max = 16;
    const race2DnfMin = 13; // 13-16がDNF
    const race3Max = 12;
    const race3DnfMin = 9; // 9-12がDNF

    console.log(`   Race1: 1-${race1Max} (DNF: ${race1DnfMin}-${race1Max})`);
    console.log(`   Race2: 1-${race2Max} (DNF: ${race2DnfMin}-${race2Max})`);
    console.log(`   Race3: 1-${race3Max} (DNF: ${race3DnfMin}-${race3Max})`);

    // Track taken positions
    const takenPositions: Map<number, Set<number>> = new Map([
      [1, new Set()],
      [2, new Set()],
      [3, new Set()],
    ]);

    // Collect real user submissions
    for (const [, raceResults] of this.realUserSubmissions) {
      for (const result of raceResults) {
        if (result.position) {
          takenPositions.get(result.raceNumber)?.add(result.position);
        }
      }
    }

    console.log(`   Race 1 taken: ${Array.from(takenPositions.get(1) || []).sort((a, b) => a - b).join(', ') || 'none'}`);
    console.log(`   Race 2 taken: ${Array.from(takenPositions.get(2) || []).sort((a, b) => a - b).join(', ') || 'none'}`);
    console.log(`   Race 3 taken: ${Array.from(takenPositions.get(3) || []).sort((a, b) => a - b).join(', ') || 'none'}`);

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
    const pickPosition = (raceNum: number, available: number[]): number | undefined => {
      if (available.length === 0) return undefined;
      const idx = Math.floor(Math.random() * available.length);
      const pos = available[idx];
      available.splice(idx, 1);
      takenPositions.get(raceNum)?.add(pos);
      return pos;
    };

    // Calculate distribution: 4 DNF each race, rest survive
    const race1DnfSlots = getAvailablePositions(1, race1DnfMin, race1Max).length;
    const race2DnfSlots = getAvailablePositions(2, race2DnfMin, race2Max).length;
    const race3DnfSlots = getAvailablePositions(3, race3DnfMin, race3Max).length;
    const surviveSlots = getAvailablePositions(3, 1, race3DnfMin - 1).length;

    let fakeToEliminateAt1 = Math.min(race1DnfSlots, 4);
    let fakeToEliminateAt2 = Math.min(race2DnfSlots, 4);
    let fakeToEliminateAt3 = Math.min(race3DnfSlots, 4);
    let fakeToSurvive = fakeCount - fakeToEliminateAt1 - fakeToEliminateAt2 - fakeToEliminateAt3;

    // Adjust if not enough survivors or too many
    if (fakeToSurvive < 0) {
      // Reduce eliminations
      const excess = -fakeToSurvive;
      fakeToEliminateAt1 = Math.max(0, fakeToEliminateAt1 - Math.ceil(excess / 3));
      fakeToEliminateAt2 = Math.max(0, fakeToEliminateAt2 - Math.ceil(excess / 3));
      fakeToEliminateAt3 = Math.max(0, fakeToEliminateAt3 - Math.ceil(excess / 3));
      fakeToSurvive = fakeCount - fakeToEliminateAt1 - fakeToEliminateAt2 - fakeToEliminateAt3;
    }

    console.log(`\n   Distribution: R1 DNF=${fakeToEliminateAt1}, R2 DNF=${fakeToEliminateAt2}, R3 DNF=${fakeToEliminateAt3}, Survive=${fakeToSurvive}`);

    // Shuffle and assign
    const shuffledFakeUsers = [...this.fakeUsers].sort(() => Math.random() - 0.5);
    const assignments: RaceAssignment[] = [];
    let userIdx = 0;

    // Race 1 DNF users (17-20位)
    // DNF: isEliminated: true を設定、後続レースは position: null
    const r1DnfPositions = getAvailablePositions(1, race1DnfMin, race1Max);
    for (let i = 0; i < fakeToEliminateAt1 && userIdx < shuffledFakeUsers.length; i++) {
      const user = shuffledFakeUsers[userIdx++];
      const pos1 = pickPosition(1, r1DnfPositions);
      assignments.push({
        user,
        raceResults: [
          { raceNumber: 1, position: pos1, isEliminated: true }, // Race 1で脱落
          { raceNumber: 2, position: null, isEliminated: false }, // 参加していない
          { raceNumber: 3, position: null, isEliminated: false }, // 参加していない
        ],
      });
    }

    // Race 2 DNF users (13-16位)
    const r2DnfPositions = getAvailablePositions(2, race2DnfMin, race2Max);
    for (let i = 0; i < fakeToEliminateAt2 && userIdx < shuffledFakeUsers.length; i++) {
      const user = shuffledFakeUsers[userIdx++];
      const pos1 = pickPosition(1, getAvailablePositions(1, 1, race1DnfMin - 1));
      const pos2 = pickPosition(2, r2DnfPositions);
      assignments.push({
        user,
        raceResults: [
          { raceNumber: 1, position: pos1, isEliminated: false },
          { raceNumber: 2, position: pos2, isEliminated: true }, // Race 2で脱落
          { raceNumber: 3, position: null, isEliminated: false }, // 参加していない
        ],
      });
    }

    // Race 3 DNF users (9-12位)
    const r3DnfPositions = getAvailablePositions(3, race3DnfMin, race3Max);
    for (let i = 0; i < fakeToEliminateAt3 && userIdx < shuffledFakeUsers.length; i++) {
      const user = shuffledFakeUsers[userIdx++];
      const pos1 = pickPosition(1, getAvailablePositions(1, 1, race1DnfMin - 1));
      const pos2 = pickPosition(2, getAvailablePositions(2, 1, race2DnfMin - 1));
      const pos3 = pickPosition(3, r3DnfPositions);
      assignments.push({
        user,
        raceResults: [
          { raceNumber: 1, position: pos1, isEliminated: false },
          { raceNumber: 2, position: pos2, isEliminated: false },
          { raceNumber: 3, position: pos3, isEliminated: true }, // Race 3で脱落
        ],
      });
    }

    // Survivors (1-8位)
    for (; userIdx < shuffledFakeUsers.length; userIdx++) {
      const user = shuffledFakeUsers[userIdx];
      const pos1 = pickPosition(1, getAvailablePositions(1, 1, race1DnfMin - 1));
      const pos2 = pickPosition(2, getAvailablePositions(2, 1, race2DnfMin - 1));
      const pos3 = pickPosition(3, getAvailablePositions(3, 1, race3DnfMin - 1));
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
    // DNF positions: R1=17-20, R2=13-16, R3=9-12
    const dnfPositions: Record<number, number[]> = {
      1: [17, 18, 19, 20],
      2: [13, 14, 15, 16],
      3: [9, 10, 11, 12],
    };

    const parts: string[] = [];
    for (const r of raceResults) {
      if (r.position === null || r.position === undefined) {
        parts.push('-');
      } else if (dnfPositions[r.raceNumber]?.includes(r.position)) {
        parts.push(`${r.position}*`); // DNF position
      } else {
        parts.push(`${r.position}`);
      }
    }
    return `[${parts.join(', ')}]`;
  }

  calculateTotalPoints(raceResults: RaceResult[]): number {
    let total = 0;
    for (const race of raceResults) {
      if (race.position) {
        // 順位があればポイントを獲得（DNFでも）
        // 1st = 100, 2nd = 95, ... 20th = 5
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

  /**
   * Submit screenshot for a user
   */
  async submitScreenshot(user: UserWithToken, type: 'INDIVIDUAL' | 'FINAL_SCORE'): Promise<boolean> {
    if (!fs.existsSync(TEST_IMAGE_PATH)) {
      console.log(`   ⚠️  Test image not found: ${TEST_IMAGE_PATH}`);
      return false;
    }

    try {
      // Read file and create FormData
      const fileBuffer = fs.readFileSync(TEST_IMAGE_PATH);
      const blob = new Blob([fileBuffer], { type: 'image/png' });

      const formData = new FormData();
      formData.append('file', blob, 'screenshot.png');
      formData.append('gameId', String(this.game.id));
      formData.append('type', type);

      await axios.post(
        `${API_URL}/api/screenshots/submit`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        }
      );

      return true;
    } catch (error: any) {
      // Ignore duplicate submission errors
      if (error.response?.status === 409 || error.response?.data?.message?.includes('already')) {
        return true;
      }
      console.error(`   ❌ Screenshot failed for ${user.displayName || user.discordId}:`, error.response?.data?.message || error.message);
      return false;
    }
  }

  /**
   * Simulate screenshot submissions for all participants
   */
  async simulateScreenshots(delayMs: number = 300) {
    console.log(`\n📸 Submitting screenshots...`);

    // Get all participants who submitted scores
    const participants = await prisma.gameParticipant.findMany({
      where: { gameId: this.game.id },
      orderBy: { totalScore: 'desc' },
      include: { user: true },
    });

    if (participants.length === 0) {
      console.log('   ⚠️  No participants to submit screenshots for');
      return;
    }

    // Submit INDIVIDUAL screenshots for all
    let successCount = 0;
    for (const p of participants) {
      const userWithToken: UserWithToken = {
        id: p.user.id,
        discordId: p.user.discordId,
        displayName: p.user.displayName,
        isFake: p.user.isFake,
        token: jwt.sign(
          { sub: p.user.id, discordId: p.user.discordId, role: 'PLAYER' },
          JWT_SECRET,
          { expiresIn: '1h' }
        ),
      };

      const success = await this.submitScreenshot(userWithToken, 'INDIVIDUAL');
      if (success) successCount++;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    console.log(`   📷 INDIVIDUAL: ${successCount}/${participants.length} submitted`);

    // Submit FINAL_SCORE for 1st place
    const firstPlace = participants[0];
    if (firstPlace) {
      const userWithToken: UserWithToken = {
        id: firstPlace.user.id,
        discordId: firstPlace.user.discordId,
        displayName: firstPlace.user.displayName,
        isFake: firstPlace.user.isFake,
        token: jwt.sign(
          { sub: firstPlace.user.id, discordId: firstPlace.user.discordId, role: 'PLAYER' },
          JWT_SECRET,
          { expiresIn: '1h' }
        ),
      };

      const success = await this.submitScreenshot(userWithToken, 'FINAL_SCORE');
      if (success) {
        console.log(`   🏆 FINAL_SCORE: ${firstPlace.user.displayName || firstPlace.user.discordId}`);
      }
    }
  }

  async displayFinalRankings() {
    if (!this.game) return;

    const participants = await prisma.gameParticipant.findMany({
      where: {
        gameId: this.game.id,
      },
      orderBy: { totalScore: 'desc' },
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

    // Sort by totalScore only (DNFでもスコアがあるため)
    const sorted = [...participants].sort((a, b) => {
      return (b.totalScore ?? 0) - (a.totalScore ?? 0);
    });

    console.log('\n📊 Final Rankings (by Total Score):');
    console.log('====================================');

    let rank = 1;
    let prevScore: number | null = null;
    let displayRank = 1;

    for (const p of sorted) {
      const displayName = p.user.displayName || p.user.discordId;
      const fakeTag = p.user.isFake ? '' : ' [REAL]';
      const score = p.totalScore ?? 0;
      const elim = p.eliminatedAtRace;
      const dnfTag = elim !== null ? ` (DNF R${elim})` : '';

      // 同スコアは同順位
      if (prevScore !== null && score === prevScore) {
        // 同順位を維持
      } else {
        displayRank = rank;
      }

      const races = p.raceResults.map(r => {
        if (r.position === null) return '-';
        if (r.isEliminated) return `${r.position}*`;
        return `${r.position}`;
      }).join(', ');

      console.log(
        `   #${String(displayRank).padStart(2)} | ${String(score).padStart(3)} pts | [${races.padEnd(12)}] | ${displayName}${dnfTag}${fakeTag}`
      );

      prevScore = score;
      rank++;
    }
  }

  async run() {
    console.log('🏁 F-ZERO 99 CLASSIC Score Simulator');
    console.log('=====================================');

    try {
      await this.findInProgressClassicGame();
      await this.simulate(1000);
      await this.simulateScreenshots(300);
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
