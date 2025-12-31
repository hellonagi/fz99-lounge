import { PrismaClient, UserRole, League } from '@prisma/client';

const prisma = new PrismaClient();

// トラックデータ（通常コース）
const normalTracks: { id: number; name: string; league: League; bannerPath: string }[] = [
  // KNIGHT League (ID 1-5)
  { id: 1, name: 'Mute City I', league: 'KNIGHT', bannerPath: '/banners/tr01_mutecity1.png' },
  { id: 2, name: 'Big Blue', league: 'KNIGHT', bannerPath: '/banners/tr02_bigblue.png' },
  { id: 3, name: 'Sand Ocean', league: 'KNIGHT', bannerPath: '/banners/tr03_sandocean.png' },
  { id: 4, name: 'Death Wind I', league: 'KNIGHT', bannerPath: '/banners/tr04_deathwind1.png' },
  { id: 5, name: 'Silence', league: 'KNIGHT', bannerPath: '/banners/tr05_silence.png' },
  // QUEEN League (ID 6-10)
  { id: 6, name: 'Mute City II', league: 'QUEEN', bannerPath: '/banners/tr06_mutecity2.png' },
  { id: 7, name: 'Port Town I', league: 'QUEEN', bannerPath: '/banners/tr07_porttown1.png' },
  { id: 8, name: 'Red Canyon I', league: 'QUEEN', bannerPath: '/banners/tr08_redcanyon1.png' },
  { id: 9, name: 'White Land I', league: 'QUEEN', bannerPath: '/banners/tr09_whiteland1.png' },
  { id: 10, name: 'White Land II', league: 'QUEEN', bannerPath: '/banners/tr10_whiteland2.png' },
  // KING League (ID 11-15)
  { id: 11, name: 'Mute City III', league: 'KING', bannerPath: '/banners/tr11_mutecity3.png' },
  { id: 12, name: 'Death Wind II', league: 'KING', bannerPath: '/banners/tr12_deathwind2.png' },
  { id: 13, name: 'Port Town II', league: 'KING', bannerPath: '/banners/tr13_porttown2.png' },
  { id: 14, name: 'Red Canyon II', league: 'KING', bannerPath: '/banners/tr14_redcanyon2.png' },
  { id: 15, name: 'Fire Field', league: 'KING', bannerPath: '/banners/tr15_firefield.png' },
  // ACE League (ID 16-20)
  { id: 16, name: 'Mute City IV', league: 'ACE', bannerPath: '/banners/tr16_mutecity4.png' },
  { id: 17, name: 'Sand Storm I', league: 'ACE', bannerPath: '/banners/tr17_sandstorm1.png' },
  { id: 18, name: 'Big Blue II', league: 'ACE', bannerPath: '/banners/tr18_bigblue2.png' },
  { id: 19, name: 'Sand Storm II', league: 'ACE', bannerPath: '/banners/tr19_sandstorm2.png' },
  { id: 20, name: 'Silence II', league: 'ACE', bannerPath: '/banners/tr20_silence2.png' },
];

// Mystery Knight League (ID 51-55)
const mysteryTracks: { id: number; name: string; league: League; bannerPath: string }[] = [
  { id: 51, name: '??? - Mute City', league: 'MYSTERY_KNIGHT', bannerPath: '/banners/tr51_mystery_mutecity.png' },
  { id: 52, name: '??? - Big Blue', league: 'MYSTERY_KNIGHT', bannerPath: '/banners/tr52_mystery_bigblue.png' },
  { id: 53, name: '??? - Sand Ocean', league: 'MYSTERY_KNIGHT', bannerPath: '/banners/tr53_mystery_sandocean.png' },
  { id: 54, name: '??? - Death Wind', league: 'MYSTERY_KNIGHT', bannerPath: '/banners/tr54_mystery_deathwind.png' },
  { id: 55, name: '??? - Silence', league: 'MYSTERY_KNIGHT', bannerPath: '/banners/tr55_mystery_silence.png' },
];

// ミラートラックを生成（ID 101-120）
const mirrorTracks = normalTracks.map((track) => ({
  id: track.id + 100,
  name: track.name,
  league: `MIRROR_${track.league}` as League,
  bannerPath: track.bannerPath, // 同じバナーを使用
  mirrorOfId: track.id,
}));

// CLASSICトラックを生成（ID 201-220）- 元のリーグを保持
const classicTracks = normalTracks.map((track) => ({
  id: track.id + 200,
  name: track.name,
  league: track.league, // 元のリーグを保持（色分け用）
  bannerPath: track.bannerPath, // 同じバナーを使用
}));

async function main() {
  const env = process.env.NODE_ENV || 'development';
  const isProduction = env === 'production' || env === 'staging';

  console.log(`Seeding database... (env: ${env})`);
  if (isProduction) {
    console.log('Production/Staging mode: Skipping fake users');
  }

  // イベント作成（GP と CLASSIC）- categoryでupsert
  const gpEvent = await prisma.event.upsert({
    where: { category: 'GP' },
    update: {},
    create: {
      category: 'GP',
      name: 'GP',
      description: 'Grand Prix mode event',
    },
  });

  const classicEvent = await prisma.event.upsert({
    where: { category: 'CLASSIC' },
    update: {},
    create: {
      category: 'CLASSIC',
      name: 'CLASSIC',
      description: 'Classic mode event',
    },
  });

  // シーズン作成 - eventId_seasonNumber複合キーでupsert
  await prisma.season.upsert({
    where: {
      eventId_seasonNumber: {
        eventId: gpEvent.id,
        seasonNumber: 1,
      },
    },
    update: {},
    create: {
      eventId: gpEvent.id,
      seasonNumber: 1,
      startDate: new Date(),
      isActive: true,
      description: 'GP Season 1',
    },
  });

  await prisma.season.upsert({
    where: {
      eventId_seasonNumber: {
        eventId: classicEvent.id,
        seasonNumber: 1,
      },
    },
    update: {},
    create: {
      eventId: classicEvent.id,
      seasonNumber: 1,
      startDate: new Date(),
      isActive: true,
      description: 'CLASSIC Season 1',
    },
  });

  // トラック作成（通常コース）
  for (const track of normalTracks) {
    await prisma.track.upsert({
      where: { id: track.id },
      update: {
        name: track.name,
        league: track.league,
        bannerPath: track.bannerPath,
      },
      create: {
        id: track.id,
        name: track.name,
        league: track.league,
        bannerPath: track.bannerPath,
      },
    });
  }

  // トラック作成（ミラーコース）
  for (const track of mirrorTracks) {
    await prisma.track.upsert({
      where: { id: track.id },
      update: {
        name: track.name,
        league: track.league,
        bannerPath: track.bannerPath,
        mirrorOfId: track.mirrorOfId,
      },
      create: {
        id: track.id,
        name: track.name,
        league: track.league,
        bannerPath: track.bannerPath,
        mirrorOfId: track.mirrorOfId,
      },
    });
  }

  // トラック作成（CLASSICコース）
  for (const track of classicTracks) {
    await prisma.track.upsert({
      where: { id: track.id },
      update: {
        name: track.name,
        league: track.league,
        bannerPath: track.bannerPath,
      },
      create: {
        id: track.id,
        name: track.name,
        league: track.league,
        bannerPath: track.bannerPath,
      },
    });
  }

  // トラック作成（Mysteryコース）
  for (const track of mysteryTracks) {
    await prisma.track.upsert({
      where: { id: track.id },
      update: {
        name: track.name,
        league: track.league,
        bannerPath: track.bannerPath,
      },
      create: {
        id: track.id,
        name: track.name,
        league: track.league,
        bannerPath: track.bannerPath,
      },
    });
  }
  console.log(`Created ${normalTracks.length + mirrorTracks.length + classicTracks.length + mysteryTracks.length} tracks (${normalTracks.length} GP + ${mirrorTracks.length} mirror + ${classicTracks.length} classic + ${mysteryTracks.length} mystery)`);

  // Fake ユーザー作成（開発環境のみ）
  if (!isProduction) {
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

    console.log(`Created ${users.length} fake test users`);
  }

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
