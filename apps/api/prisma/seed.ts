import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // イベント作成（GP と CLASSIC）
  const gpEvent = await prisma.event.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      category: 'GP',
      name: 'GP',
      description: 'Grand Prix mode event',
    },
  });

  const classicEvent = await prisma.event.upsert({
    where: { id: 2 },
    update: {},
    create: {
      id: 2,
      category: 'CLASSIC',
      name: 'CLASSIC',
      description: 'Classic mode event',
    },
  });

  // シーズン作成
  await prisma.season.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      eventId: gpEvent.id,
      seasonNumber: 1,
      startDate: new Date(),
      isActive: true,
      description: 'GP Season 1',
    },
  });

  await prisma.season.upsert({
    where: { id: 2 },
    update: {},
    create: {
      id: 2,
      eventId: classicEvent.id,
      seasonNumber: 1,
      startDate: new Date(),
      isActive: true,
      description: 'CLASSIC Season 1',
    },
  });

  // ユーザー作成: 1 ADMIN + 3 MODERATOR + 26 PLAYER = 30名
  const users: {
    discordId: string;
    username: string;
    displayName: string | null;
    country: string | null;
    role: UserRole;
  }[] = [
    // ADMIN (1名) - displayName なし（プロフィール設定モーダルをテストするため）
    { discordId: 'admin-001', username: 'test_admin', displayName: null, country: null, role: 'ADMIN' },
    // MODERATOR (3名)
    { discordId: 'mod-001', username: 'test_mod_1', displayName: 'Mod1', country: 'JP', role: 'MODERATOR' },
    { discordId: 'mod-002', username: 'test_mod_2', displayName: 'Mod2', country: 'US', role: 'MODERATOR' },
    { discordId: 'mod-003', username: 'test_mod_3', displayName: 'Mod3', country: 'GB', role: 'MODERATOR' },
    // PLAYER (26名)
    ...Array.from({ length: 26 }, (_, i) => ({
      discordId: `player-${String(i + 1).padStart(3, '0')}`,
      username: `test_player_${i + 1}`,
      displayName: `Player${i + 1}`,
      country: 'JP',
      role: 'PLAYER' as UserRole,
    })),
  ];

  for (const userData of users) {
    const user = await prisma.user.upsert({
      where: { discordId: userData.discordId },
      update: {},
      create: {
        discordId: userData.discordId,
        username: userData.username,
        displayName: userData.displayName,
        role: userData.role,
        isFake: true,
      },
    });

    // displayName がある場合は Profile も作成（country を設定）
    if (userData.displayName && userData.country) {
      await prisma.profile.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          country: userData.country,
        },
      });
    }
  }

  console.log(`Created ${users.length} test users`);
  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
