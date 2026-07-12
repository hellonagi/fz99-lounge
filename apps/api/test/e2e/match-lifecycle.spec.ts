import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import { Job } from 'bull';
import Redis from 'ioredis';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { MatchesProcessor } from '../../src/matches/matches.processor';

/**
 * 試合ライフサイクル e2e: 作成 → 参加 → 開始
 *
 * compose.test.yaml のテスト用Postgres(5433)/Redis(6380)を使う。
 * 実行前に: docker compose -f compose.test.yaml up -d
 */
describe('Match lifecycle (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let seasonId: number;

  /** テストDBにユーザーを作り、jwtクッキー用トークンを返す */
  async function createUser(
    username: string,
    role: 'ADMIN' | 'PLAYER' = 'PLAYER',
  ): Promise<{ id: number; token: string }> {
    const maxProfile = await prisma.user.aggregate({
      _max: { profileNumber: true },
    });
    const user = await prisma.user.create({
      data: {
        discordId: `test-${username}`,
        username,
        displayName: username.slice(0, 10),
        role,
        status: 'ACTIVE',
        profileNumber: (maxProfile._max.profileNumber ?? 0) + 1,
      },
    });
    const token = jwt.sign(
      { sub: user.id, discordId: user.discordId, username: user.username },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' },
    );
    return { id: user.id, token };
  }

  beforeAll(async () => {
    // アプリ起動と同時に前回実行の期限切れBullジョブが発火し、下のTRUNCATEと
    // 衝突するため、起動前にテストRedis(専用インスタンス)を丸ごと空にする
    const redis = new Redis(process.env.REDIS_URL!);
    await redis.flushall();
    redis.disconnect();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    app.setGlobalPrefix('api');
    await app.init();

    prisma = app.get(PrismaService);

    // DBもFK順にCASCADEで一括TRUNCATEして既知の空状態から始める
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE users, events, seasons, matches RESTART IDENTITY CASCADE',
    );

    // 最小seed: CLASSICイベント + アクティブシーズン + 管理者
    const event = await prisma.event.create({
      data: { category: 'CLASSIC', name: 'Classic Test Event' },
    });
    const season = await prisma.season.create({
      data: {
        eventId: event.id,
        seasonNumber: 1,
        isActive: true,
        startDate: new Date(),
      },
    });
    seasonId = season.id;

    // 12人未満のCLASSICマッチは開始時にUnratedシーズン(seasonNumber=-1)へ移動する
    await prisma.season.create({
      data: {
        eventId: event.id,
        seasonNumber: -1,
        isActive: false,
        startDate: new Date(),
      },
    });

    const admin = await createUser('testadmin', 'ADMIN');
    adminToken = admin.token;
  });

  afterAll(async () => {
    await app.close();
  });

  /** 管理者APIで試合を作成してレスポンスbodyを返す */
  async function createMatch(
    overrides: Record<string, unknown> = {},
  ): Promise<{ id: number; matchNumber: number }> {
    const res = await request(app.getHttpServer())
      .post('/api/matches')
      .set('Cookie', `jwt=${adminToken}`)
      .send({
        seasonId,
        inGameMode: 'CLASSIC_MINI_PRIX',
        scheduledStart: new Date(Date.now() + 5 * 60_000).toISOString(),
        minPlayers: 4,
        maxPlayers: 20,
        ...overrides,
      })
      .expect(201);
    return res.body;
  }

  describe('match creation', () => {
    it('creates a WAITING match with a match number when an admin posts /api/matches', async () => {
      const scheduledStart = new Date(Date.now() + 5 * 60_000).toISOString();

      const res = await request(app.getHttpServer())
        .post('/api/matches')
        .set('Cookie', `jwt=${adminToken}`)
        .send({
          seasonId,
          inGameMode: 'CLASSIC_MINI_PRIX',
          scheduledStart,
          minPlayers: 4,
          maxPlayers: 20,
        })
        .expect(201);

      expect(res.body.status).toBe('WAITING');
      expect(res.body.matchNumber).toBeGreaterThan(0);
      expect(res.body.seasonId).toBe(seasonId);

      // DBにも同じ状態で永続化されている
      const dbMatch = await prisma.match.findUnique({
        where: { id: res.body.id },
      });
      expect(dbMatch).not.toBeNull();
      expect(dbMatch!.status).toBe('WAITING');
      expect(new Date(dbMatch!.scheduledStart).toISOString()).toBe(
        scheduledStart,
      );
    });
  });

  describe('joining a match', () => {
    it('lets 4 players join, tracks the count, and rejects duplicate joins', async () => {
      const match = await createMatch();

      // profileNumber採番が読み取り→書き込みのためレースする。逐次作成する
      const players: Array<{ id: number; token: string }> = [];
      for (const n of [1, 2, 3, 4]) {
        players.push(await createUser(`joiner${n}`));
      }

      // 4人が順番にjoin → 全員201
      for (const player of players) {
        await request(app.getHttpServer())
          .post(`/api/matches/${match.id}/join`)
          .set('Cookie', `jwt=${player.token}`)
          .expect(201);
      }

      // DB上で参加者が4人になっている
      const count = await prisma.matchParticipant.count({
        where: { matchId: match.id },
      });
      expect(count).toBe(4);

      // 同じユーザーの二重joinは400で拒否され、参加者数は変わらない
      const dup = await request(app.getHttpServer())
        .post(`/api/matches/${match.id}/join`)
        .set('Cookie', `jwt=${players[0].token}`)
        .expect(400);
      expect(dup.body.message).toBe('Already in match');

      const countAfter = await prisma.matchParticipant.count({
        where: { matchId: match.id },
      });
      expect(countAfter).toBe(4);
    });
  });

  describe('match start', () => {
    it('starts a filled match: IN_PROGRESS, game with passcode, unrated season move', async () => {
      const match = await createMatch();
      for (const n of [1, 2, 3, 4]) {
        const player = await createUser(`starter${n}`);
        await request(app.getHttpServer())
          .post(`/api/matches/${match.id}/join`)
          .set('Cookie', `jwt=${player.token}`)
          .expect(201);
      }

      // Bullの遅延ジョブを実時間で待たず、開始ハンドラを直接実行する
      const processor = app.get(MatchesProcessor);
      await processor.handleStartMatch({
        data: { matchId: match.id },
      } as Job<{ matchId: number }>);

      const started = await prisma.match.findUnique({
        where: { id: match.id },
        include: { games: true, season: true },
      });

      // 試合が開始状態になっている
      expect(started!.status).toBe('IN_PROGRESS');
      expect(started!.actualStart).not.toBeNull();

      // 4人 < 12人(CLASSICのrated下限)なのでUnratedシーズンへ移動、isRated=false
      expect(started!.isRated).toBe(false);
      expect(started!.season.seasonNumber).toBe(-1);
      expect(started!.matchNumber).toBeGreaterThan(0);

      // ゲームが生成され、4桁パスコードが発行済み
      expect(started!.games).toHaveLength(1);
      const game = started!.games[0];
      expect(game.passcode).toMatch(/^\d{4}$/);
      expect(game.startedAt).not.toBeNull();
      expect(game.passcodePublishedAt).not.toBeNull();
    });

    it('cancels an under-filled match at start time instead of starting it', async () => {
      const match = await createMatch(); // minPlayers: 4
      for (const n of [1, 2]) {
        const player = await createUser(`underfill${n}`);
        await request(app.getHttpServer())
          .post(`/api/matches/${match.id}/join`)
          .set('Cookie', `jwt=${player.token}`)
          .expect(201);
      }

      const processor = app.get(MatchesProcessor);
      await processor.handleStartMatch({
        data: { matchId: match.id },
      } as Job<{ matchId: number }>);

      const cancelled = await prisma.match.findUnique({
        where: { id: match.id },
        include: { games: true },
      });

      // 開始されず自動キャンセル、matchNumberは外れて再利用可能になる
      expect(cancelled!.status).toBe('CANCELLED');
      expect(cancelled!.matchNumber).toBeNull();
      expect(cancelled!.actualStart).toBeNull();

      // ゲーム行は作成時に先行生成されるが、パスコード未発行・未開始のまま
      expect(cancelled!.games).toHaveLength(1);
      expect(cancelled!.games[0].passcode).toBe('');
      expect(cancelled!.games[0].startedAt).toBeNull();
      expect(cancelled!.games[0].passcodePublishedAt).toBeNull();
    });
  });
});
