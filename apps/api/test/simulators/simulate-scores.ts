#!/usr/bin/env ts-node

/**
 * Simulate score submissions for F-ZERO 99 match testing
 * Uses API endpoints with JWT authentication for realistic testing
 */

import { PrismaClient } from '@prisma/client';
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

interface SimulationOptions {
  mode?: 'gradual' | 'fast' | 'burst';
  count?: number;
  season?: number;
  game?: number;
  useLatest?: boolean;
}

class ScoreSimulator {
  private matchId: string | null = null;
  private users: any[] = [];
  private lobbyId: string | null = null;
  private match: any = null;

  async findMatch(season: number = 99, game: number = 1) {
    console.log(`🔍 Finding match for Season ${season}, Game ${game}...`);

    const match = await prisma.match.findFirst({
      where: {
        lobby: {
          gameNumber: game,
          event: {
            season: {
              seasonNumber: season,
            },
          },
        },
      },
      include: {
        participants: true,
        lobby: {
          include: {
            participants: {
              include: {
                user: true,
              },
            },
            event: {
              include: {
                season: true,
              },
            },
          },
        },
      },
    });

    if (!match) {
      throw new Error(`Match not found for Season ${season}, Game ${game}`);
    }

    this.matchId = match.id;
    this.lobbyId = match.lobby.id;
    this.match = match;

    // Get users who haven't submitted scores yet and generate JWT tokens
    const submittedUserIds = new Set(match.participants.map(p => p.userId));
    this.users = match.lobby.participants
      .map(p => p.user)
      .filter(u => !submittedUserIds.has(u.id))
      .map(user => ({
        ...user,
        token: jwt.sign(
          {
            sub: user.id,
            username: user.username,
            role: 'PLAYER',
            email: user.email,
          },
          JWT_SECRET,
          { expiresIn: '1h' }
        ),
      }));

    console.log(`✅ Found match with ${match.participants.length} scores submitted`);
    console.log(`   ${this.users.length} users waiting to submit scores`);

    return match;
  }

  async findLatestInProgressMatch() {
    console.log(`🔍 Finding latest IN_PROGRESS match...`);

    const match = await prisma.match.findFirst({
      where: {
        lobby: {
          status: 'IN_PROGRESS',
        },
      },
      orderBy: {
        startedAt: 'desc',
      },
      include: {
        participants: true,
        lobby: {
          include: {
            participants: {
              include: {
                user: true,
              },
            },
            event: {
              include: {
                season: true,
              },
            },
          },
        },
      },
    });

    if (!match) {
      throw new Error('No IN_PROGRESS match found. Please start a match first.');
    }

    this.matchId = match.id;
    this.lobbyId = match.lobby.id;
    this.match = match;

    // Get users who haven't submitted scores yet and generate JWT tokens
    const submittedUserIds = new Set(match.participants.map(p => p.userId));
    this.users = match.lobby.participants
      .map(p => p.user)
      .filter(u => !submittedUserIds.has(u.id))
      .map(user => ({
        ...user,
        token: jwt.sign(
          {
            sub: user.id,
            username: user.username,
            role: 'PLAYER',
            email: user.email,
          },
          JWT_SECRET,
          { expiresIn: '1h' }
        ),
      }));

    const season = match.lobby.event?.season?.seasonNumber || 'Unknown';
    const game = match.lobby.gameNumber || 'Unknown';

    console.log(`✅ Found IN_PROGRESS match: Season ${season}, Game ${game}`);
    console.log(`   Match ID: ${match.id}`);
    console.log(`   ${match.participants.length} scores submitted, ${this.users.length} users waiting`);

    return match;
  }

  /**
   * Create fake users and add them to the lobby
   */
  async createAndAddFakeUsers(count: number): Promise<void> {
    if (!this.lobbyId) throw new Error('No lobby selected');

    console.log(`\n👥 Creating ${count} fake users and adding to lobby...`);

    const fakeUsers: any[] = [];

    for (let i = 0; i < count; i++) {
      // Create fake user
      const fakeUser = await prisma.user.create({
        data: {
          discordId: `fake_${faker.string.uuid()}`,
          username: `FakePlayer${faker.number.int({ min: 1000, max: 9999 })}`,
          displayName: faker.person.firstName().substring(0, 10),
          email: `fake_${faker.string.uuid()}@example.com`,
          isFake: true,
        },
      });

      // Add to lobby
      await prisma.lobbyParticipant.create({
        data: {
          lobbyId: this.lobbyId,
          userId: fakeUser.id,
        },
      });

      // Generate JWT token for this user
      const token = jwt.sign(
        {
          sub: fakeUser.id,
          username: fakeUser.username,
          role: 'PLAYER',
          email: fakeUser.email,
        },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      fakeUsers.push({ ...fakeUser, token });
    }

    // Add created fake users to the users list
    this.users.push(...fakeUsers);

    console.log(`✅ Created and added ${count} fake users to lobby`);
  }

  generateRandomScore() {
    // Generate random points with realistic distribution
    // Most scores cluster around certain ranges
    const ranges = [
      { min: 900, max: 1000, weight: 0.05 }, // Top players
      { min: 700, max: 899, weight: 0.15 },  // Strong players
      { min: 400, max: 699, weight: 0.30 },  // Average players
      { min: 100, max: 399, weight: 0.35 },  // Below average
      { min: 0, max: 99, weight: 0.15 },     // Low scores
    ];

    // Select range based on weights
    const random = Math.random();
    let cumulative = 0;
    let selectedRange = ranges[0];

    for (const range of ranges) {
      cumulative += range.weight;
      if (random <= cumulative) {
        selectedRange = range;
        break;
      }
    }

    // Generate points within selected range
    const points = faker.number.int({ min: selectedRange.min, max: selectedRange.max });

    const machine = faker.helpers.arrayElement(F99_MACHINES);
    const assistEnabled = points < 400 ? faker.datatype.boolean(0.3) : faker.datatype.boolean(0.1);

    return { points, machine, assistEnabled };
  }

  async submitScore(user: any, match: any) {
    const { points, machine, assistEnabled } = this.generateRandomScore();

    const season = match.lobby.event?.season?.seasonNumber;
    const game = match.lobby.gameNumber;
    const mode = match.gameMode.toLowerCase();

    try {
      // Submit score via API with JWT authentication
      const response = await axios.post(
        `${API_URL}/api/matches/${mode}/${season}/${game}/score`,
        {
          reportedPoints: points,
          machine,
          assistEnabled,
        },
        {
          headers: {
            Authorization: `Bearer ${user.token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const displayName = user.displayName || user.username;
      console.log(
        `   📤 ${displayName}: ${points}pts | ${machine}${assistEnabled ? ' +Assist' : ''}`
      );

      return response.data;
    } catch (error: any) {
      const displayName = user.displayName || user.username;
      console.error(
        `   ❌ ${displayName} failed to submit:`,
        error.response?.data?.message || error.message
      );
      throw error;
    }
  }


  async simulateGradual(count: number = 10, delayMs: number = 3000) {
    console.log(`\n🎮 Starting GRADUAL score submissions...`);
    console.log(`   Submitting ${count} scores with ${delayMs}ms delay\n`);

    const usersToSubmit = this.users.slice(0, count);

    for (const user of usersToSubmit) {
      await this.submitScore(user, this.match);

      if (usersToSubmit.indexOf(user) < usersToSubmit.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  async simulateBurst(count: number = 30) {
    console.log(`\n💥 Starting BURST score submissions...`);
    console.log(`   Submitting ${count} scores simultaneously\n`);

    const usersToSubmit = this.users.slice(0, count);
    const promises: Promise<any>[] = [];

    for (const user of usersToSubmit) {
      promises.push(this.submitScore(user, this.match));
    }

    await Promise.all(promises);
  }

  async run(options: SimulationOptions = {}) {
    const {
      mode = 'gradual',
      count = mode === 'fast' ? 20 : mode === 'burst' ? 30 : 10,
      season = 99,
      game = 1,
      useLatest = false,
    } = options;

    console.log('🏁 F-ZERO 99 Score Simulator');
    console.log('============================\n');

    try {
      let match: any;

      if (useLatest) {
        match = await this.findLatestInProgressMatch();
      } else {
        match = await this.findMatch(season, game);
      }

      // If not enough users, create fake users
      if (this.users.length < count) {
        const needed = count - this.users.length;
        console.log(`\n⚠️  Only ${this.users.length} users waiting, but ${count} requested`);
        console.log(`   Creating ${needed} fake users to reach target count...`);
        await this.createAndAddFakeUsers(needed);
      } else if (this.users.length === 0) {
        console.log('\n⚠️  All users have already submitted scores!');
        console.log(`   Creating ${count} fake users...`);
        await this.createAndAddFakeUsers(count);
      }

      const actualCount = Math.min(count, this.users.length);

      switch (mode) {
        case 'gradual':
          await this.simulateGradual(actualCount, 3000);
          break;
        case 'fast':
          await this.simulateGradual(actualCount, 1000);
          break;
        case 'burst':
          await this.simulateBurst(actualCount);
          break;
      }

      // Display final rankings
      console.log('\n📊 Final Rankings:');
      console.log('==================');
      await this.displayFinalRankings();

      // Get match details for URL
      const matchSeason = match.lobby.event?.season?.seasonNumber || season;
      const matchGame = match.lobby.gameNumber || game;
      const matchMode = match.gameMode?.toLowerCase() || 'gp';

      console.log(`\n✅ Simulation complete!`);
      console.log(`📊 View at: http://localhost:3001/matches/${matchMode}/${matchSeason}/${matchGame}`);
    } catch (error) {
      console.error('❌ Error:', error);
    } finally {
      await prisma.$disconnect();
    }
  }

  async displayFinalRankings() {
    if (!this.matchId) return;

    // Get all participants with scores, sorted by reported points (highest first)
    const participants = await prisma.matchParticipant.findMany({
      where: {
        matchId: this.matchId,
        reportedPoints: { not: null },
      },
      orderBy: { reportedPoints: 'desc' },
      include: {
        user: {
          select: {
            displayName: true,
            username: true,
          },
        },
      },
    });

    let currentRank = 1;
    let previousPoints: number | null = null;
    let participantsAtSameRank = 0;

    participants.forEach((p) => {
      const displayName = p.user.displayName || p.user.username;
      const points = p.reportedPoints || 0;

      // Handle tied rankings (e.g., #1, #1, #3, #4)
      if (previousPoints !== null && previousPoints !== points) {
        currentRank += participantsAtSameRank;
        participantsAtSameRank = 1;
      } else {
        participantsAtSameRank++;
      }

      previousPoints = points;

      const assistText = p.assistEnabled ? ' [ASSIST]' : '';
      console.log(
        `   #${String(currentRank).padStart(2)} | ${String(points).padStart(4)}pts | ${displayName.padEnd(15)} | ${p.machine}${assistText}`
      );
    });
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const useLatest = args.includes('--latest');
  const mode = (args.find(arg => !arg.startsWith('--')) as 'gradual' | 'fast' | 'burst') || 'gradual';

  const simulator = new ScoreSimulator();
  simulator.run({ mode, useLatest }).catch(console.error);
}

export { ScoreSimulator };