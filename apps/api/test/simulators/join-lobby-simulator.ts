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

async function joinMatch(count: number, delay: number) {
  // Find WAITING match
  const match = await prisma.match.findFirst({
    where: { status: MatchStatus.WAITING },
    orderBy: { scheduledStart: 'asc' },
    include: { participants: true },
  });

  if (!match) {
    console.error('No WAITING match found');
    return;
  }

  console.log(`Found match ID: ${match.id}`);
  console.log(`Current players: ${match.participants.length}/${match.maxPlayers}`);
  console.log(`Joining ${count} fake users via API (WebSocket events will fire)...\n`);

  // Get fake users who are not already in this match
  const existingUserIds = match.participants.map(p => p.userId);
  const fakeUsers = await prisma.user.findMany({
    where: {
      isFake: true,
      id: { notIn: existingUserIds },
    },
    take: count,
  });

  if (fakeUsers.length === 0) {
    console.error('No available fake users. Run: make sim-fake-users');
    return;
  }

  if (fakeUsers.length < count) {
    console.log(`Warning: Only ${fakeUsers.length} fake users available\n`);
  }

  let joined = 0;
  for (const user of fakeUsers) {
    try {
      const token = generateToken(user);
      await axios.post(
        `${API_URL}/matches/${match.id}/join`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      joined++;
      console.log(`  [${joined}] ${user.displayName} joined`);
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message;
      if (msg.includes('full')) {
        console.log(`Match is full`);
        break;
      }
      console.error(`  Error (${user.displayName}): ${msg}`);
    }

    if (delay > 0) {
      await sleep(delay);
    }
  }

  const finalCount = await prisma.matchParticipant.count({
    where: { matchId: match.id },
  });

  console.log(`\nDone! ${joined} users joined.`);
  console.log(`Match players: ${finalCount}/${match.maxPlayers}`);
}

async function main() {
  const args = process.argv.slice(2);

  const countArg = args.find(arg => arg.startsWith('--count='));
  const delayArg = args.find(arg => arg.startsWith('--delay='));

  const count = countArg ? parseInt(countArg.split('=')[1], 10) : 20;
  const delay = delayArg ? parseInt(delayArg.split('=')[1], 10) : 500;

  await joinMatch(count, delay);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
