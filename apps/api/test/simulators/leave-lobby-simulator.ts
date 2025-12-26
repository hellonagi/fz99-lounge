import { PrismaClient, MatchStatus } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import axios from 'axios';

const prisma = new PrismaClient();

const API_URL = process.env.API_URL || 'http://localhost:3000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function generateToken(user: { id: number; discordId: string; username: string }) {
  return jwt.sign(
    { sub: user.id, discordId: user.discordId, username: user.username },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function leaveMatch(count: number, delay: number, all: boolean) {
  // Find WAITING match with fake participants
  const match = await prisma.match.findFirst({
    where: { status: MatchStatus.WAITING },
    orderBy: { scheduledStart: 'asc' },
    include: {
      participants: {
        include: { user: true },
        where: { user: { isFake: true } },
      },
    },
  });

  if (!match) {
    console.error('No WAITING match found');
    return;
  }

  const fakeParticipants = match.participants;

  if (fakeParticipants.length === 0) {
    console.error('No fake users in this match');
    return;
  }

  const targetCount = all ? fakeParticipants.length : Math.min(count, fakeParticipants.length);

  console.log(`Found match ID: ${match.id}`);
  console.log(`Fake users in match: ${fakeParticipants.length}`);
  console.log(`Removing ${targetCount} fake users via API...\n`);

  let left = 0;
  for (let i = 0; i < targetCount; i++) {
    const participant = fakeParticipants[i];
    const user = participant.user;

    try {
      const token = generateToken(user);
      await axios.post(
        `${API_URL}/matches/${match.id}/leave`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      left++;
      console.log(`  [${left}] ${user.displayName} left`);
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message;
      console.error(`  Error (${user.displayName}): ${msg}`);
    }

    if (delay > 0 && i < targetCount - 1) {
      await sleep(delay);
    }
  }

  const finalCount = await prisma.matchParticipant.count({
    where: { matchId: match.id },
  });

  console.log(`\nDone! ${left} users left.`);
  console.log(`Match players: ${finalCount}/${match.maxPlayers}`);
}

async function main() {
  const args = process.argv.slice(2);

  const countArg = args.find(arg => arg.startsWith('--count='));
  const delayArg = args.find(arg => arg.startsWith('--delay='));
  const all = args.includes('--all');

  const count = countArg ? parseInt(countArg.split('=')[1], 10) : 20;
  const delay = delayArg ? parseInt(delayArg.split('=')[1], 10) : 500;

  await leaveMatch(count, delay, all);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
