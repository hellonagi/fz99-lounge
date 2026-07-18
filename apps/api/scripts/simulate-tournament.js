/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * dev環境用 大会シミュレータ。偽ユーザーを作り、本物のAPIを通してスコアを提出する。
 * ブラウザで大会ページを開いたまま実行すると、WebSocket経由でライブに反映される。
 *
 * 使い方 (apps/api で実行):
 *   node scripts/simulate-tournament.js setup <tournamentId>
 *     → 偽ユーザー作成 + 参加登録投入 (GP30人 / Classic22人、うち5人は両部門)
 *       登録後、管理画面で REGISTRATION_CLOSED にするとマッチ生成が走る
 *   node scripts/simulate-tournament.js scores <tournamentId> <matchNumber> [--fast] [--all]
 *     → そのGPの偽ユーザー参加者全員がスコアを提出 (1.5秒間隔、--fastで間隔なし)
 *       --all で偽ユーザー以外のマッチ参加者にも提出する (dev専用)
 *   node scripts/simulate-tournament.js cleanup
 *     → 偽ユーザー (discordId sim-*) と関連データを全削除
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const API_BASE = process.env.SIM_API_BASE || 'http://localhost:3000/api';
const JWT_SECRET = process.env.JWT_SECRET;
const MACHINES = ['Blue Falcon', 'Golden Fox', 'Wild Goose', 'Fire Stingray'];

const GP_COUNT = 30; // うち先頭10人はOFFLINE登録
const CLASSIC_ONLY_COUNT = 17; // + GP勢から5人が両部門登録 → Classic合計22人 (先着20を超過)
const BOTH_DIVISIONS = 5;

function tokenFor(user) {
  return jwt.sign(
    { sub: user.id, discordId: user.discordId, username: user.username },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

async function api(user, method, url, body) {
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Cookie: `jwt=${tokenFor(user)}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${url} → ${res.status}: ${text}`);
  }
  return res.json().catch(() => null);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 1..max から count 個の相異なる順位を取る (実際のレースと同じく順位は重複しない)
function samplePositions(max, count) {
  const pool = Array.from({ length: max }, (_, i) => i + 1);
  return shuffle(pool).slice(0, count);
}

async function createUser(tag, index, profileNumber) {
  const num = String(index + 1).padStart(2, '0');
  return prisma.user.create({
    data: {
      discordId: `sim-${tag}-${num}`,
      username: `sim_${tag}_${num}`,
      displayName: `Sim${tag.toUpperCase()}${num}`.slice(0, 10),
      role: 'PLAYER',
      status: 'ACTIVE',
      isFake: true,
      profileNumber,
    },
  });
}

async function setup(tournamentId) {
  const config = await prisma.tournamentConfig.findUnique({ where: { id: tournamentId } });
  if (!config) throw new Error(`Tournament ${tournamentId} not found`);

  const existing = await prisma.user.count({ where: { discordId: { startsWith: 'sim-' } } });
  if (existing > 0) throw new Error(`sim users already exist (${existing}). Run cleanup first.`);

  const maxProfile = await prisma.user.aggregate({ _max: { profileNumber: true } });
  let nextProfile = (maxProfile._max.profileNumber ?? 0) + 1;

  const gpUsers = [];
  for (let i = 0; i < GP_COUNT; i++) gpUsers.push(await createUser('gp', i, nextProfile++));
  const classicUsers = [];
  for (let i = 0; i < CLASSIC_ONLY_COUNT; i++) classicUsers.push(await createUser('cl', i, nextProfile++));

  // 登録順が waitlist 判定に効くので registeredAt を1秒ずつずらす
  let regTime = Date.now() - 3600_000;
  const register = (userId, division, mode) =>
    prisma.tournamentRegistration.create({
      data: {
        userId,
        tournamentConfigId: tournamentId,
        division,
        mode,
        registeredAt: new Date((regTime += 1000)),
      },
    });

  for (let i = 0; i < gpUsers.length; i++) {
    await register(gpUsers[i].id, 'GP', i < 10 ? 'OFFLINE' : 'ONLINE');
  }
  // GP勢の先頭5人はClassicにも登録 (両部門 + 重複userIdのテスト)
  for (let i = 0; i < BOTH_DIVISIONS; i++) {
    await register(gpUsers[i].id, 'CLASSIC', 'ONLINE');
  }
  for (const u of classicUsers) {
    await register(u.id, 'CLASSIC', 'ONLINE');
  }

  console.log(`created: GP ${GP_COUNT}人 (OFFLINE 10 / ONLINE 20)`);
  console.log(`         Classic ${BOTH_DIVISIONS + CLASSIC_ONLY_COUNT}人 (先着20超過 → waitlist 2人)`);
  console.log('次: 管理画面で REGISTRATION_CLOSED に遷移するとマッチが生成される');
}

async function scores(tournamentId, matchNumber, fast) {
  const config = await prisma.tournamentConfig.findUnique({
    where: { id: tournamentId },
    include: { season: true },
  });
  if (!config) throw new Error(`Tournament ${tournamentId} not found`);

  const rounds = config.rounds;
  const round = rounds.find((r) => r.roundNumber === matchNumber);
  if (!round) throw new Error(`Round ${matchNumber} not in config`);
  const isGp = ['GRAND_PRIX', 'MIRROR_GRAND_PRIX', 'MINI_PRIX'].includes(round.inGameMode);
  const raceCount = isGp ? 5 : 3;
  const raceMaxPositions = isGp ? [99, 80, 60, 40, 20] : [20, 16, 12];
  const eliminationThresholds = isGp ? [81, 61, 41, 21, null] : [17, 13, 9];

  const includeAll = process.argv.includes('--all');
  const match = await prisma.match.findFirst({
    where: { seasonId: config.seasonId, matchNumber },
    include: {
      participants: {
        include: { user: true },
        ...(includeAll
          ? {}
          : { where: { user: { discordId: { startsWith: 'sim-' } } } }),
      },
    },
  });
  if (!match) throw new Error(`Match ${matchNumber} not found`);
  if (!match.participants.length) throw new Error('No sim participants in this match');

  console.log(`GP${matchNumber} (${round.inGameMode}) に ${match.participants.length}人が提出開始`);

  // 生存者リストを保ちながらレースごとに順位を配る
  let alive = match.participants.map((p) => p.user);
  const results = new Map(alive.map((u) => [u.id, []]));

  for (let race = 1; race <= raceCount; race++) {
    const positions = samplePositions(raceMaxPositions[race - 1], alive.length);
    const threshold = eliminationThresholds[race - 1];
    const next = [];
    alive.forEach((u, idx) => {
      const pos = positions[idx];
      // 3%で切断
      if (Math.random() < 0.03) {
        results.get(u.id).push({ raceNumber: race, isEliminated: false, isDisconnected: true });
        return;
      }
      const out = threshold != null && pos >= threshold;
      results.get(u.id).push({ raceNumber: race, position: pos, isEliminated: out, isDisconnected: false });
      if (!out) next.push(u);
    });
    alive = next;
  }

  for (const p of match.participants) {
    const raceResults = results.get(p.user.id);
    // 途中脱落者の残りレースは空行で埋める
    for (let r = raceResults.length + 1; r <= raceCount; r++) {
      raceResults.push({ raceNumber: r, isEliminated: false, isDisconnected: false });
    }
    const machine = MACHINES[Math.floor(Math.random() * MACHINES.length)];
    try {
      await api(p.user, 'POST', `/games/tournament/${config.season.seasonNumber}/${matchNumber}/score`, {
        machine,
        assistEnabled: false,
        raceResults,
      });
      const summary = raceResults
        .map((r) => (r.isDisconnected ? 'dc' : (r.position ?? '-')))
        .join(' ');
      console.log(`  ${p.user.displayName}: ${summary}`);
    } catch (err) {
      console.error(`  ${p.user.displayName}: FAILED — ${err.message}`);
    }
    if (!fast) await new Promise((res) => setTimeout(res, 1500));
  }
  console.log('done');
}

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { discordId: { startsWith: 'sim-' } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (!ids.length) {
    console.log('no sim users');
    return;
  }
  await prisma.raceResult.deleteMany({
    where: { gameParticipant: { userId: { in: ids } } },
  });
  await prisma.gameParticipant.deleteMany({ where: { userId: { in: ids } } });
  await prisma.matchParticipant.deleteMany({ where: { userId: { in: ids } } });
  await prisma.tournamentRegistration.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  console.log(`deleted ${ids.length} sim users and related data`);
}

async function main() {
  if (!JWT_SECRET) throw new Error('JWT_SECRET not set (check apps/api/.env)');
  const [cmd, arg1, arg2] = process.argv.slice(2);
  const fast = process.argv.includes('--fast');

  if (cmd === 'setup') await setup(parseInt(arg1, 10));
  else if (cmd === 'scores') await scores(parseInt(arg1, 10), parseInt(arg2, 10), fast);
  else if (cmd === 'cleanup') await cleanup();
  else {
    console.log('usage: node scripts/simulate-tournament.js setup <tournamentId>');
    console.log('       node scripts/simulate-tournament.js scores <tournamentId> <matchNumber> [--fast]');
    console.log('       node scripts/simulate-tournament.js cleanup');
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
