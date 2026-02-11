#!/usr/bin/env ts-node

/**
 * Simulate TEAM_CLASSIC mode score submissions with realistic race progression
 * - Same race mechanics as CLASSIC (Race1: 1-20, Race2: 1-16, Race3: 1-12)
 * - Players are assigned to teams (teamIndex)
 * - Team scores are calculated from individual scores
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
  teamIndex: number | null;
  isExcluded: boolean;
}

interface RaceAssignment {
  user: UserWithToken;
  raceResults: RaceResult[];
}

class TeamClassicScoreSimulator {
  private game: any = null;
  private fakeUsers: UserWithToken[] = [];
  private realUserSubmissions: Map<number, RaceResult[]> = new Map();

  async findInProgressTeamClassicGame() {
    console.log(`\n🔍 Finding IN_PROGRESS TEAM_CLASSIC game...`);

    const game = await prisma.game.findFirst({
      where: {
        match: {
          status: 'IN_PROGRESS',
          season: {
            event: {
              category: 'TEAM_CLASSIC',
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
      throw new Error('No IN_PROGRESS TEAM_CLASSIC game found. Please start a TEAM_CLASSIC match first.');
    }

    const category = game.match.season?.event?.category;
    if (category !== 'TEAM_CLASSIC') {
      throw new Error(`Game category is ${category}, not TEAM_CLASSIC.`);
    }

    this.game = game;

    // Collect real user submissions (already submitted scores)
    for (const participant of game.participants) {
      if (!participant.user.isFake) {
        this.realUserSubmissions.set(participant.userId, participant.raceResults);
      }
    }

    // Get fake users who are match participants but haven't submitted game scores yet
    // In TEAM_CLASSIC, GameParticipant records are created during team assignment
    // so we check for actual race results (not just GameParticipant existence)
    const submittedUserIds = new Set(
      game.participants
        .filter((p: any) => p.raceResults && p.raceResults.length > 0)
        .map((p: any) => p.userId),
    );

    // Create a map of gameParticipant info (teamIndex, isExcluded) for each user
    const gameParticipantMap = new Map<number, { teamIndex: number | null; isExcluded: boolean }>();
    for (const gp of game.participants) {
      gameParticipantMap.set(gp.userId, {
        teamIndex: gp.teamIndex,
        isExcluded: gp.isExcluded,
      });
    }

    this.fakeUsers = game.match.participants
      .filter((p: any) => p.user.isFake && !submittedUserIds.has(p.userId))
      .map((p: any) => {
        // Check if there's already a game participant for this user (for teamIndex info)
        const gpInfo = gameParticipantMap.get(p.userId);
        return {
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
          teamIndex: gpInfo?.teamIndex ?? null,
          isExcluded: gpInfo?.isExcluded ?? false,
        };
      });

    const seasonNumber = game.match.season?.seasonNumber || 'Unknown';
    const matchNumber = game.match.matchNumber || 'Unknown';
    const teamConfig = game.teamConfig || 'Unknown';

    console.log(`✅ Found TEAM_CLASSIC game: Season ${seasonNumber}, Match ${matchNumber}`);
    console.log(`   Game ID: ${game.id}`);
    console.log(`   Team Config: ${teamConfig}`);
    console.log(`   Total match participants: ${game.match.participants.length}`);
    console.log(`   Already submitted: ${game.participants.length}`);
    console.log(`   Real users submitted: ${this.realUserSubmissions.size}`);
    console.log(`   Fake users waiting: ${this.fakeUsers.length}`);

    // Show team distribution
    const teamCounts = new Map<number, number>();
    for (const gp of game.participants) {
      if (gp.teamIndex !== null) {
        teamCounts.set(gp.teamIndex, (teamCounts.get(gp.teamIndex) || 0) + 1);
      }
    }
    if (teamCounts.size > 0) {
      const teamInfo = Array.from(teamCounts.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([idx, count]) => `Team ${idx}: ${count}`)
        .join(', ');
      console.log(`   Team distribution: ${teamInfo}`);
    }

    return game;
  }

  /**
   * Generate race assignments for all fake users
   */
  generateRaceAssignments(): RaceAssignment[] {
    const totalParticipants = this.game.match.participants.length;
    const fakeCount = this.fakeUsers.length;

    console.log(`\n📋 Generating race assignments for ${fakeCount} fake users (${totalParticipants} total participants)...`);

    // Fixed position ranges for CLASSIC mode
    const race1Max = 20;
    const race1DnfMin = 17;
    const race2Max = 16;
    const race2DnfMin = 13;
    const race3Max = 12;
    const race3DnfMin = 9;

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

    // Calculate distribution
    const race1DnfSlots = getAvailablePositions(1, race1DnfMin, race1Max).length;
    const race2DnfSlots = getAvailablePositions(2, race2DnfMin, race2Max).length;
    const race3DnfSlots = getAvailablePositions(3, race3DnfMin, race3Max).length;

    let fakeToEliminateAt1 = Math.min(race1DnfSlots, 4);
    let fakeToEliminateAt2 = Math.min(race2DnfSlots, 4);
    let fakeToEliminateAt3 = Math.min(race3DnfSlots, 4);
    let fakeToSurvive = fakeCount - fakeToEliminateAt1 - fakeToEliminateAt2 - fakeToEliminateAt3;

    if (fakeToSurvive < 0) {
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

    // Race 1 DNF users
    const r1DnfPositions = getAvailablePositions(1, race1DnfMin, race1Max);
    for (let i = 0; i < fakeToEliminateAt1 && userIdx < shuffledFakeUsers.length; i++) {
      const user = shuffledFakeUsers[userIdx++];
      const pos1 = pickPosition(1, r1DnfPositions);
      assignments.push({
        user,
        raceResults: [
          { raceNumber: 1, position: pos1, isEliminated: true },
          { raceNumber: 2, position: null, isEliminated: false },
          { raceNumber: 3, position: null, isEliminated: false },
        ],
      });
    }

    // Race 2 DNF users
    const r2DnfPositions = getAvailablePositions(2, race2DnfMin, race2Max);
    for (let i = 0; i < fakeToEliminateAt2 && userIdx < shuffledFakeUsers.length; i++) {
      const user = shuffledFakeUsers[userIdx++];
      const pos1 = pickPosition(1, getAvailablePositions(1, 1, race1DnfMin - 1));
      const pos2 = pickPosition(2, r2DnfPositions);
      assignments.push({
        user,
        raceResults: [
          { raceNumber: 1, position: pos1, isEliminated: false },
          { raceNumber: 2, position: pos2, isEliminated: true },
          { raceNumber: 3, position: null, isEliminated: false },
        ],
      });
    }

    // Race 3 DNF users
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
          { raceNumber: 3, position: pos3, isEliminated: true },
        ],
      });
    }

    // Survivors
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

    const category = 'team-classic';
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
      const teamTag = user.teamIndex !== null ? ` [Team ${user.teamIndex}]` : '';
      console.log(`   📤 ${displayName}${teamTag}: ${resultText} | ${machine}${assistEnabled ? ' +Assist' : ''}`);

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
        parts.push(`${r.position}*`);
      } else {
        parts.push(`${r.position}`);
      }
    }
    return `[${parts.join(', ')}]`;
  }

  async simulate(delayMs: number = 1000) {
    const assignments = this.generateRaceAssignments();

    console.log(`\n🎮 Starting TEAM_CLASSIC score submissions...`);
    console.log(`   ${assignments.length} fake users, ${delayMs}ms delay\n`);

    if (assignments.length === 0) {
      console.log('⚠️  No fake users waiting to submit scores!');
      return;
    }

    const shuffledAssignments = [...assignments].sort(() => Math.random() - 0.5);

    for (let i = 0; i < shuffledAssignments.length; i++) {
      const { user, raceResults } = shuffledAssignments[i];
      await this.submitScore(user, raceResults);

      if (i < shuffledAssignments.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  async submitScreenshot(user: UserWithToken, type: 'INDIVIDUAL' | 'FINAL_SCORE'): Promise<boolean> {
    if (!fs.existsSync(TEST_IMAGE_PATH)) {
      console.log(`   ⚠️  Test image not found: ${TEST_IMAGE_PATH}`);
      return false;
    }

    try {
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
      if (error.response?.status === 409 || error.response?.data?.message?.includes('already')) {
        return true;
      }
      console.error(`   ❌ Screenshot failed for ${user.displayName || user.discordId}:`, error.response?.data?.message || error.message);
      return false;
    }
  }

  async simulateScreenshots(delayMs: number = 300) {
    console.log(`\n📸 Submitting screenshots...`);

    const participants = await prisma.gameParticipant.findMany({
      where: { gameId: this.game.id },
      orderBy: { totalScore: 'desc' },
      include: { user: true },
    });

    if (participants.length === 0) {
      console.log('   ⚠️  No participants to submit screenshots for');
      return;
    }

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
        teamIndex: p.teamIndex,
        isExcluded: p.isExcluded,
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
        teamIndex: firstPlace.teamIndex,
        isExcluded: firstPlace.isExcluded,
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

    // Group by team
    const teamMap = new Map<number, typeof participants>();
    const excludedOrNoTeam: typeof participants = [];

    for (const p of participants) {
      if (p.isExcluded || p.teamIndex === null) {
        excludedOrNoTeam.push(p);
      } else {
        if (!teamMap.has(p.teamIndex)) {
          teamMap.set(p.teamIndex, []);
        }
        teamMap.get(p.teamIndex)!.push(p);
      }
    }

    // Calculate team scores
    const teamScores = Array.from(teamMap.entries()).map(([teamIndex, members]) => {
      const totalScore = members.reduce((sum, m) => sum + (m.totalScore ?? 0), 0);
      return { teamIndex, totalScore, members };
    }).sort((a, b) => b.totalScore - a.totalScore);

    console.log('\n📊 Team Rankings:');
    console.log('==================');

    for (let i = 0; i < teamScores.length; i++) {
      const team = teamScores[i];
      console.log(`\n🏅 #${i + 1} Team ${team.teamIndex} - ${team.totalScore} pts`);

      // Sort members by score
      const sortedMembers = [...team.members].sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0));
      for (const p of sortedMembers) {
        const displayName = p.user.displayName || p.user.discordId;
        const fakeTag = p.user.isFake ? '' : ' [REAL]';
        const score = p.totalScore ?? 0;
        const races = p.raceResults.map(r => {
          if (r.position === null) return '-';
          if (r.isEliminated) return `${r.position}*`;
          return `${r.position}`;
        }).join(', ');

        console.log(`      ${String(score).padStart(3)} pts | [${races.padEnd(12)}] | ${displayName}${fakeTag}`);
      }
    }

    if (excludedOrNoTeam.length > 0) {
      console.log('\n❌ Excluded/No Team:');
      for (const p of excludedOrNoTeam) {
        const displayName = p.user.displayName || p.user.discordId;
        console.log(`      ${displayName}`);
      }
    }

    // Individual rankings
    console.log('\n📊 Individual Rankings (by Total Score):');
    console.log('=========================================');

    const sorted = [...participants].sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0));
    let rank = 1;
    let prevScore: number | null = null;
    let displayRank = 1;

    for (const p of sorted) {
      const displayName = p.user.displayName || p.user.discordId;
      const fakeTag = p.user.isFake ? '' : ' [REAL]';
      const score = p.totalScore ?? 0;
      const elim = p.eliminatedAtRace;
      const dnfTag = elim !== null ? ` (DNF R${elim})` : '';
      const teamTag = p.teamIndex !== null ? ` [T${p.teamIndex}]` : p.isExcluded ? ' [EX]' : '';

      if (prevScore !== null && score === prevScore) {
        // Same rank
      } else {
        displayRank = rank;
      }

      const races = p.raceResults.map(r => {
        if (r.position === null) return '-';
        if (r.isEliminated) return `${r.position}*`;
        return `${r.position}`;
      }).join(', ');

      console.log(
        `   #${String(displayRank).padStart(2)} | ${String(score).padStart(3)} pts | [${races.padEnd(12)}] | ${displayName}${teamTag}${dnfTag}${fakeTag}`
      );

      prevScore = score;
      rank++;
    }
  }

  async run() {
    console.log('🏁 F-ZERO 99 TEAM_CLASSIC Score Simulator');
    console.log('==========================================');

    try {
      await this.findInProgressTeamClassicGame();
      await this.simulate(1000);
      await this.simulateScreenshots(300);
      await this.displayFinalRankings();

      const season = this.game.match.season?.seasonNumber;
      const match = this.game.match.matchNumber;

      console.log(`\n✅ Simulation complete!`);
      console.log(`📊 View at: http://localhost:3001/matches/team-classic/${season}/${match}`);
    } catch (error: any) {
      console.error('❌ Error:', error.message || error);
    } finally {
      await prisma.$disconnect();
    }
  }
}

// CLI execution
if (require.main === module) {
  const simulator = new TeamClassicScoreSimulator();
  simulator.run().catch(console.error);
}

export { TeamClassicScoreSimulator };
