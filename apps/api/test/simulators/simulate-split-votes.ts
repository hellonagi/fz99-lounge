#!/usr/bin/env ts-node

/**
 * Simulate Split Vote for CLASSIC mode
 * - Find IN_PROGRESS CLASSIC game
 * - Cast split votes for fake users (default: 10)
 * - Display vote progress
 */

import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import * as jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

const API_URL = process.env.API_URL || 'http://localhost:3000';
const JWT_SECRET =
  process.env.JWT_SECRET || 'test_jwt_secret_key_for_testing_only';

interface UserWithToken {
  id: number;
  discordId: string;
  displayName: string | null;
  isFake: boolean;
  token: string;
}

class SplitVoteSimulator {
  private game: any = null;
  private fakeUsers: UserWithToken[] = [];
  private category = '';
  private seasonNumber = 0;
  private matchNumber = 0;

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
      },
    });

    if (!game) {
      throw new Error(
        'No IN_PROGRESS CLASSIC game found. Please start a CLASSIC match first.',
      );
    }

    const category = game.match.season?.event?.category;
    if (category !== 'CLASSIC') {
      throw new Error(`Game category is ${category}, not CLASSIC.`);
    }

    this.game = game;
    this.category = 'classic';
    this.seasonNumber = game.match.season?.seasonNumber || 0;
    this.matchNumber = game.match.matchNumber || 0;

    // Get fake users who are match participants
    this.fakeUsers = game.match.participants
      .filter((p: any) => p.user.isFake)
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
          { expiresIn: '1h' },
        ),
      }));

    console.log(
      `✅ Found CLASSIC game: Season ${this.seasonNumber}, Match ${this.matchNumber}`,
    );
    console.log(`   Game ID: ${game.id}`);
    console.log(`   Total participants: ${game.match.participants.length}`);
    console.log(`   Fake users available: ${this.fakeUsers.length}`);

    return game;
  }

  async castSplitVote(user: UserWithToken): Promise<{
    success: boolean;
    currentVotes?: number;
    requiredVotes?: number;
    regenerated?: boolean;
    passcode?: string;
    error?: string;
  }> {
    try {
      const response = await axios.post(
        `${API_URL}/api/games/${this.category}/${this.seasonNumber}/${this.matchNumber}/split-vote`,
        {},
        {
          headers: {
            Authorization: `Bearer ${user.token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return {
        success: true,
        currentVotes: response.data.currentVotes,
        requiredVotes: response.data.requiredVotes,
        regenerated: response.data.regenerated,
        passcode: response.data.passcode,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  async simulate(count: number = 10, delayMs: number = 500) {
    console.log(`\n🗳️  Starting Split Vote simulation...`);
    console.log(`   Voting with ${count} fake users, ${delayMs}ms delay\n`);

    if (this.fakeUsers.length === 0) {
      console.log('⚠️  No fake users available!');
      return;
    }

    const usersToVote = this.fakeUsers.slice(0, count);
    console.log(`   Selected ${usersToVote.length} users to vote\n`);

    for (let i = 0; i < usersToVote.length; i++) {
      const user = usersToVote[i];
      const displayName = user.displayName || user.discordId;
      const result = await this.castSplitVote(user);

      if (result.success) {
        const progress = `${result.currentVotes}/${result.requiredVotes}`;
        const bar = this.progressBar(
          result.currentVotes!,
          result.requiredVotes!,
        );

        if (result.regenerated) {
          console.log(`   🎉 ${displayName}: PASSCODE REGENERATED!`);
          console.log(`      New passcode: ${result.passcode}`);
          console.log(`      Votes reset to 0/${result.requiredVotes}`);
          break; // Stop after regeneration
        } else {
          console.log(`   ✅ ${displayName}: ${progress} ${bar}`);
        }
      } else {
        if (result.error?.includes('already voted')) {
          console.log(`   ⚪ ${displayName}: Already voted`);
        } else {
          console.log(`   ❌ ${displayName}: ${result.error}`);
        }
      }

      if (i < usersToVote.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  progressBar(current: number, required: number): string {
    const width = 20;
    const filled = Math.min(Math.round((current / required) * width), width);
    const empty = width - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
  }

  async run() {
    console.log('🗳️  F-ZERO 99 Split Vote Simulator');
    console.log('===================================');

    try {
      await this.findInProgressClassicGame();
      await this.simulate(10, 500);

      console.log(`\n✅ Simulation complete!`);
      console.log(
        `📊 View at: http://localhost:3001/matches/classic/${this.seasonNumber}/${this.matchNumber}`,
      );
    } catch (error: any) {
      console.error('❌ Error:', error.message || error);
    } finally {
      await prisma.$disconnect();
    }
  }
}

// CLI execution
if (require.main === module) {
  const simulator = new SplitVoteSimulator();
  simulator.run().catch(console.error);
}

export { SplitVoteSimulator };
