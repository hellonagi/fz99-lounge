#!/usr/bin/env ts-node

/**
 * Simulate Split Vote for TOURNAMENT mode
 * - Find IN_PROGRESS TOURNAMENT game (optionally by round number)
 * - Cast split votes for fake users
 * - Display vote progress
 *
 * Usage:
 *   make sim-split-tournament ROUND=1 COUNT=5 DELAY=500
 */

import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import * as jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

const API_URL = process.env.API_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_for_testing_only';

interface UserWithToken {
  id: number;
  discordId: string;
  displayName: string | null;
  isFake: boolean;
  token: string;
}

class TournamentSplitVoteSimulator {
  private game: any = null;
  private users: UserWithToken[] = [];
  private seasonNumber = 0;
  private matchNumber = 0;

  async findTournamentGame() {
    console.log(`\nFinding IN_PROGRESS TOURNAMENT game...`);

    const game = await prisma.game.findFirst({
      where: {
        match: {
          status: 'IN_PROGRESS',
          season: {
            event: {
              category: 'TOURNAMENT',
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
      throw new Error('No IN_PROGRESS TOURNAMENT game found. Start a tournament round first.');
    }

    this.game = game;
    this.seasonNumber = game.match.season?.seasonNumber || 0;
    this.matchNumber = game.match.matchNumber || 0;

    this.users = game.match.participants.map((p: any) => ({
      id: p.user.id,
      discordId: p.user.discordId,
      displayName: p.user.displayName,
      isFake: p.user.isFake,
      token: jwt.sign(
        {
          sub: p.user.id,
          discordId: p.user.discordId,
          role: p.user.role || 'PLAYER',
        },
        JWT_SECRET,
        { expiresIn: '1h' },
      ),
    }));

    console.log(`Found: Season ${this.seasonNumber}, Round ${this.matchNumber}`);
    console.log(`  Game ID: ${game.id}, Passcode version: ${game.passcodeVersion}`);
    console.log(`  Total participants: ${this.users.length}`);

    return game;
  }

  async castSplitVote(user: UserWithToken) {
    try {
      const response = await axios.post(
        `${API_URL}/api/games/tournament/${this.seasonNumber}/${this.matchNumber}/split-vote`,
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

  progressBar(current: number, required: number): string {
    const width = 20;
    const filled = Math.min(Math.round((current / required) * width), width);
    const empty = width - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
  }

  async simulate(count: number, delayMs: number) {
    console.log(`\nStarting split vote simulation...`);
    console.log(`  Voting with ${count} fake users, ${delayMs}ms delay\n`);

    if (this.users.length === 0) {
      console.log('No participants available!');
      return;
    }

    const usersToVote = this.users.slice(0, count);
    console.log(`  Selected ${usersToVote.length} users to vote\n`);

    for (let i = 0; i < usersToVote.length; i++) {
      const user = usersToVote[i];
      const displayName = user.displayName || user.discordId;
      const result = await this.castSplitVote(user);

      if (result.success) {
        const progress = `${result.currentVotes}/${result.requiredVotes}`;
        const bar = this.progressBar(result.currentVotes!, result.requiredVotes!);

        if (result.regenerated) {
          console.log(`  >> ${displayName}: PASSCODE REGENERATED!`);
          console.log(`     New passcode: ${result.passcode}`);
          break;
        } else {
          console.log(`  ${displayName}: ${progress} ${bar}`);
        }
      } else {
        if (result.error?.includes('Already voted')) {
          console.log(`  ${displayName}: Already voted (skipped)`);
        } else {
          console.log(`  ${displayName}: ERROR - ${result.error}`);
        }
      }

      if (i < usersToVote.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  async run(count = 10, delayMs = 500) {
    console.log('F-ZERO 99 Tournament Split Vote Simulator');
    console.log('==========================================');

    try {
      await this.findTournamentGame();
      await this.simulate(count, delayMs);
      console.log(`\nDone!`);
    } catch (error: any) {
      console.error('Error:', error.message || error);
    } finally {
      await prisma.$disconnect();
    }
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);

  const countIdx = args.indexOf('--count');
  const count = countIdx >= 0 ? parseInt(args[countIdx + 1], 10) : 10;

  const delayIdx = args.indexOf('--delay');
  const delay = delayIdx >= 0 ? parseInt(args[delayIdx + 1], 10) : 500;

  const simulator = new TournamentSplitVoteSimulator();
  simulator.run(count, delay).catch(console.error);
}

export { TournamentSplitVoteSimulator };
