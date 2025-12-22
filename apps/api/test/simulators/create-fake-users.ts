import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

function generateFakeDiscordId(): string {
  // Discord IDs are 17-19 digits, use shorter format to avoid DB issues
  return faker.string.numeric(17);
}

async function createFakeUsers(count: number) {
  console.log(`Creating ${count} fake users...`);

  let created = 0;
  let skipped = 0;

  for (let i = 0; i < count; i++) {
    const firstName = faker.person.firstName();
    const displayName = `${firstName.slice(0, 8)}${faker.string.numeric(2)}`; // Max 10 chars
    const discordId = generateFakeDiscordId();
    const username = faker.internet.username({ firstName }).toLowerCase().slice(0, 32);

    try {
      const user = await prisma.user.create({
        data: {
          discordId,
          username,
          displayName,
          isFake: true,
          profile: {
            create: {
              country: faker.location.countryCode('alpha-2'),
            },
          },
        },
        include: { profile: true },
      });
      created++;
      console.log(`  [${created}] Created: ${displayName} (ID: ${user.id}, Country: ${user.profile?.country})`);
    } catch (error: any) {
      if (error.code === 'P2002') {
        skipped++;
        i--; // Retry with different data
      } else {
        console.error(`  Error creating ${displayName}:`, error.message);
      }
    }
  }

  console.log(`\nDone! Created: ${created}, Skipped: ${skipped}`);
}

async function showStats() {
  const totalFake = await prisma.user.count({ where: { isFake: true } });
  const totalReal = await prisma.user.count({ where: { isFake: false } });

  console.log('\n=== Fake User Statistics ===');
  console.log(`Fake users: ${totalFake}`);
  console.log(`Real users: ${totalReal}`);
  console.log(`Total: ${totalFake + totalReal}`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--stats')) {
    await showStats();
    return;
  }

  const countArg = args.find(arg => arg.startsWith('--count='));
  const count = countArg ? parseInt(countArg.split('=')[1], 10) : 40;

  if (isNaN(count) || count <= 0) {
    console.error('Usage: --count=<number> or --stats');
    process.exit(1);
  }

  await createFakeUsers(count);
  await showStats();
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
