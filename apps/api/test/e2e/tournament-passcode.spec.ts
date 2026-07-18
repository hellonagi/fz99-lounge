import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import type { Queue } from 'bull';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import Redis from 'ioredis';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * 大会パスコードカウントダウン e2e
 *
 * Masters #1 で「進行が予定より遅れるとパスコードが出せない」問題が起きたため、
 * 運営が対象GP・リーグ・パスコードを明示指定して start-countdown を叩けば
 * フェーズや時刻に関係なく必ず「押下→60秒後にDiscord公開」が予約されることを検証する。
 */
describe('Tournament passcode countdown (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tournamentsQueue: Queue;
  let adminToken: string;
  let tournamentId: number;
  let game1Id: number;
  let match1Id: number;
  let match2Id: number;

  beforeAll(async () => {
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
    tournamentsQueue = app.get<Queue>(getQueueToken('tournaments'));

    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE users, events, seasons, matches, tournament_configs RESTART IDENTITY CASCADE',
    );

    // 管理者
    const admin = await prisma.user.create({
      data: {
        discordId: 'test-tournament-admin',
        username: 'tadmin',
        displayName: 'tadmin',
        role: 'ADMIN',
        status: 'ACTIVE',
        profileNumber: 1,
      },
    });
    adminToken = jwt.sign(
      { sub: admin.id, discordId: admin.discordId, username: admin.username },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' },
    );

    // 進行中の大会: GP1がIN_PROGRESS(パスコード未公開)、GP2がWAITING
    const event = await prisma.event.create({
      data: { category: 'TOURNAMENT', name: 'TOURNAMENT' },
    });
    const season = await prisma.season.create({
      data: { eventId: event.id, seasonNumber: 1, startDate: new Date() },
    });

    const config = await prisma.tournamentConfig.create({
      data: {
        seasonId: season.id,
        name: 'Test Masters',
        tournamentNumber: 1,
        status: 'IN_PROGRESS',
        rounds: [
          { roundNumber: 1, inGameMode: 'GRAND_PRIX', league: 'KNIGHT' },
          { roundNumber: 2, inGameMode: 'GRAND_PRIX', league: 'QUEEN' },
        ],
        totalRounds: 2,
        tournamentDate: new Date(),
        registrationStart: new Date(Date.now() - 2 * 86_400_000),
        registrationEnd: new Date(Date.now() - 86_400_000),
        minPlayers: 2,
        maxPlayers: 99,
      },
    });
    tournamentId = config.id;

    const match1 = await prisma.match.create({
      data: {
        seasonId: season.id,
        matchNumber: 1,
        status: 'IN_PROGRESS',
        minPlayers: 2,
        maxPlayers: 99,
        scheduledStart: new Date(),
        deadline: new Date(Date.now() + 3_600_000),
        games: {
          create: {
            gameNumber: 1,
            inGameMode: 'GRAND_PRIX',
            leagueType: 'KNIGHT',
            passcode: '1111',
          },
        },
      },
      include: { games: true },
    });
    match1Id = match1.id;
    game1Id = match1.games[0].id;

    const match2 = await prisma.match.create({
      data: {
        seasonId: season.id,
        matchNumber: 2,
        status: 'WAITING',
        minPlayers: 2,
        maxPlayers: 99,
        scheduledStart: new Date(Date.now() + 1_800_000),
        deadline: new Date(Date.now() + 5_400_000),
        games: {
          create: { gameNumber: 1, inGameMode: 'GRAND_PRIX', passcode: '2222' },
        },
      },
    });
    match2Id = match2.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('starts a 60s countdown with operator-specified round, league and passcode', async () => {
    const before = Date.now();

    await request(app.getHttpServer())
      .post(`/api/tournaments/${tournamentId}/start-countdown`)
      .set('Cookie', `jwt=${adminToken}`)
      .send({ matchNumber: 1, league: 'QUEEN', passcode: '4321' })
      .expect(201);

    // 指定した値がそのまま反映される
    const game = await prisma.game.findUnique({ where: { id: game1Id } });
    expect(game!.passcode).toBe('4321');
    expect(game!.leagueType).toBe('QUEEN');

    // 公開予定は「今から60秒後」(それ以外のタイミングで公開されない)
    const revealTime = new Date(game!.passcodeRevealTime!).getTime();
    expect(revealTime).toBeGreaterThan(before);
    expect(revealTime).toBeLessThanOrEqual(Date.now() + 60_000);
    expect(revealTime).toBeGreaterThanOrEqual(before + 55_000);

    // config.rounds のリーグ表記も同期される
    const config = await prisma.tournamentConfig.findUnique({
      where: { id: tournamentId },
    });
    const rounds = config!.rounds as Array<{
      roundNumber: number;
      league?: string;
    }>;
    expect(rounds.find((r) => r.roundNumber === 1)!.league).toBe('QUEEN');

    // Discord公開はBull遅延ジョブとして予約される(API再起動でも消えない)
    const delayed = await tournamentsQueue.getDelayed();
    expect(
      delayed.some(
        (j) =>
          j.name === 'passcode-reveal' &&
          (j.data as { gameId: number }).gameId === game1Id,
      ),
    ).toBe(true);
  });

  it('re-fires the same round after hide without advancing to the next round', async () => {
    // Masters #1 のシナリオ: 公開→hide後にもう一度同じGPで出し直したい
    await prisma.game.update({
      where: { id: game1Id },
      data: { passcodeRevealTime: new Date(0) },
    });

    await request(app.getHttpServer())
      .post(`/api/tournaments/${tournamentId}/start-countdown`)
      .set('Cookie', `jwt=${adminToken}`)
      .send({ matchNumber: 1, passcode: '5678' })
      .expect(201);

    // 同じラウンドのまま新しいカウントダウンが始まる(勝手に次ラウンドへ進まない)
    const match1 = await prisma.match.findUnique({ where: { id: match1Id } });
    const match2 = await prisma.match.findUnique({ where: { id: match2Id } });
    expect(match1!.status).toBe('IN_PROGRESS');
    expect(match2!.status).toBe('WAITING');

    const game = await prisma.game.findUnique({ where: { id: game1Id } });
    expect(game!.passcode).toBe('5678');
    expect(new Date(game!.passcodeRevealTime!).getTime()).toBeGreaterThan(
      Date.now(),
    );
  });

  it('rejects a non-4-digit passcode', async () => {
    await request(app.getHttpServer())
      .post(`/api/tournaments/${tournamentId}/start-countdown`)
      .set('Cookie', `jwt=${adminToken}`)
      .send({ matchNumber: 1, passcode: '12a4' })
      .expect(400);
  });

  it('fires GPs in any order: an unrevealed live GP returns to WAITING, not COMPLETED', async () => {
    // 前提: GP1がIN_PROGRESSでカウントダウン中(未公開)。ここでGP2を発火する
    await request(app.getHttpServer())
      .post(`/api/tournaments/${tournamentId}/start-countdown`)
      .set('Cookie', `jwt=${adminToken}`)
      .send({ matchNumber: 2, passcode: '9999' })
      .expect(201);

    // GP1は未公開なのでWAITINGへ戻り(COMPLETEDにされない)、予約もリセットされる
    let match1 = await prisma.match.findUnique({ where: { id: match1Id } });
    let match2 = await prisma.match.findUnique({ where: { id: match2Id } });
    expect(match1!.status).toBe('WAITING');
    expect(match2!.status).toBe('IN_PROGRESS');
    const game1 = await prisma.game.findUnique({ where: { id: game1Id } });
    expect(game1!.passcodeRevealTime).toBeNull();

    // 戻ったGP1をあらためて発火できる(順序の縛りなし)
    await request(app.getHttpServer())
      .post(`/api/tournaments/${tournamentId}/start-countdown`)
      .set('Cookie', `jwt=${adminToken}`)
      .send({ matchNumber: 1, passcode: '1234' })
      .expect(201);

    match1 = await prisma.match.findUnique({ where: { id: match1Id } });
    match2 = await prisma.match.findUnique({ where: { id: match2Id } });
    expect(match1!.status).toBe('IN_PROGRESS');
    expect(match2!.status).toBe('WAITING');
  });

  it('recovers from RESULTS_PENDING and reopens a COMPLETED GP', async () => {
    // 最終GP後の詰みシナリオ: 大会がRESULTS_PENDING、全GPがCOMPLETED
    await prisma.tournamentConfig.update({
      where: { id: tournamentId },
      data: { status: 'RESULTS_PENDING' },
    });
    await prisma.match.updateMany({
      where: { id: { in: [match1Id, match2Id] } },
      data: { status: 'COMPLETED' },
    });

    await request(app.getHttpServer())
      .post(`/api/tournaments/${tournamentId}/start-countdown`)
      .set('Cookie', `jwt=${adminToken}`)
      .send({ matchNumber: 2, passcode: '7777' })
      .expect(201);

    // 大会はIN_PROGRESSへ戻り、COMPLETEDだったGP2が再オープンされる
    const config = await prisma.tournamentConfig.findUnique({
      where: { id: tournamentId },
    });
    expect(config!.status).toBe('IN_PROGRESS');

    const match2 = await prisma.match.findUnique({ where: { id: match2Id } });
    expect(match2!.status).toBe('IN_PROGRESS');
    // 他のCOMPLETED GPには触らない
    const match1 = await prisma.match.findUnique({ where: { id: match1Id } });
    expect(match1!.status).toBe('COMPLETED');
  });

  it('hides passcodes from non-moderator API responses', async () => {
    // 公開経路はDiscordのみ: 一般向けの大会詳細にはpasscodeを含めない
    const publicRes = await request(app.getHttpServer())
      .get(`/api/tournaments/${tournamentId}`)
      .expect(200);
    const publicGames = publicRes.body.season.matches.flatMap(
      (m: { games: Array<Record<string, unknown>> }) => m.games,
    );
    expect(publicGames.length).toBeGreaterThan(0);
    for (const game of publicGames) {
      expect(game).not.toHaveProperty('passcode');
    }

    // ADMIN/MODERATORには運営フォームのプリフィル用に含める
    const adminRes = await request(app.getHttpServer())
      .get(`/api/tournaments/${tournamentId}`)
      .set('Cookie', `jwt=${adminToken}`)
      .expect(200);
    const adminGames = adminRes.body.season.matches.flatMap(
      (m: { games: Array<Record<string, unknown>> }) => m.games,
    );
    expect(
      adminGames.some(
        (g: Record<string, unknown>) => typeof g.passcode === 'string',
      ),
    ).toBe(true);
  });
});
