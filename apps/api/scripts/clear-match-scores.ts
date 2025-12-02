#!/usr/bin/env ts-node

/**
 * Clear score submissions from a match
 * This removes matchParticipants but keeps the match itself
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ClearOptions {
  matchId?: string;
  season?: number;
  game?: number;
  useLatest?: boolean;
}

async function clearMatchScores(options: ClearOptions = {}) {
  const { matchId, season, game, useLatest } = options;

  try {
    let match: any;

    if (matchId) {
      // Clear by match ID
      console.log(`🔍 Finding match by ID: ${matchId}...`);
      match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
          participants: true,
          lobby: {
            include: {
              event: {
                include: { season: true },
              },
            },
          },
        },
      });
    } else if (useLatest) {
      // Clear latest IN_PROGRESS match
      console.log(`🔍 Finding latest IN_PROGRESS match...`);
      match = await prisma.match.findFirst({
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
              event: {
                include: { season: true },
              },
            },
          },
        },
      });
    } else if (season && game) {
      // Clear by season and game
      console.log(`🔍 Finding match for Season ${season}, Game ${game}...`);
      match = await prisma.match.findFirst({
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
              event: {
                include: { season: true },
              },
            },
          },
        },
      });
    } else {
      throw new Error('Please provide either matchId, season+game, or use --latest flag');
    }

    if (!match) {
      throw new Error('Match not found');
    }

    const seasonNum = match.lobby.event?.season?.seasonNumber || 'Unknown';
    const gameNum = match.lobby.gameNumber || 'Unknown';
    const participantCount = match.participants.length;

    console.log(`\n✅ Found match: Season ${seasonNum}, Game ${gameNum}`);
    console.log(`   Match ID: ${match.id}`);
    console.log(`   Current participants: ${participantCount}`);

    if (participantCount === 0) {
      console.log('\n⚠️  No scores to clear - match has no participants');
      return;
    }

    // Delete all match participants
    console.log(`\n🗑️  Clearing ${participantCount} score submissions...`);

    const result = await prisma.matchParticipant.deleteMany({
      where: {
        matchId: match.id,
      },
    });

    console.log(`\n✅ Cleared ${result.count} score submissions!`);
    console.log(`   Match is now ready for new submissions`);
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);

  const useLatest = args.includes('--latest');
  const matchIdIndex = args.indexOf('--match-id');
  const seasonIndex = args.indexOf('--season');
  const gameIndex = args.indexOf('--game');

  const matchId = matchIdIndex !== -1 ? args[matchIdIndex + 1] : undefined;
  const season = seasonIndex !== -1 ? parseInt(args[seasonIndex + 1]) : undefined;
  const game = gameIndex !== -1 ? parseInt(args[gameIndex + 1]) : undefined;

  console.log('🧹 Clear Match Scores');
  console.log('=====================\n');

  clearMatchScores({ matchId, season, game, useLatest }).catch(console.error);
}

export { clearMatchScores };
