/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
import { defineConfig } from 'cypress';
import { execSync } from 'child_process';
import * as jwt from 'jsonwebtoken';

// 環境変数から取得（.envと同じ値）
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

// テストユーザー情報（seed.tsと同期）
const TEST_USERS = {
  admin: { id: 1, discordId: 'admin-001', username: 'test_admin' },
  mod1: { id: 2, discordId: 'mod-001', username: 'test_mod_1' },
  mod2: { id: 3, discordId: 'mod-002', username: 'test_mod_2' },
  mod3: { id: 4, discordId: 'mod-003', username: 'test_mod_3' },
  ...Object.fromEntries(
    Array.from({ length: 26 }, (_, i) => [
      `player${i + 1}`,
      {
        id: i + 5,
        discordId: `player-${String(i + 1).padStart(3, '0')}`,
        username: `test_player_${i + 1}`,
      },
    ])
  ),
};

// JWTトークン生成ヘルパー
function generateToken(userId: number, discordId: string, username: string): string {
  return jwt.sign({ sub: userId, discordId, username }, JWT_SECRET, { expiresIn: '7d' });
}

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3001',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    pageLoadTimeout: 120000,
    experimentalMemoryManagement: true,
    numTestsKeptInMemory: 0,
    setupNodeEvents(on, config) {
      on('task', {
        log(message) {
          console.log(message);
          return null;
        },

        // DBリセット + シード実行
        resetDb() {
          console.log('Resetting database...');
          try {
            execSync(
              'docker exec fz99-lounge-api npx prisma db push --force-reset --accept-data-loss',
              { stdio: 'inherit' }
            );
            execSync(
              'docker exec fz99-lounge-api npx prisma db seed',
              { stdio: 'inherit' }
            );
            console.log('Database reset complete');
            return null;
          } catch (error) {
            console.error('Failed to reset database:', error);
            throw error;
          }
        },

        // JWT生成
        generateTestAuth({ id, discordId, username }: { id: number; discordId: string; username: string }) {
          return generateToken(id, discordId, username);
        },

        // ユーザープロフィールを取得（APIから最新データを取得）
        async getUserProfile({ userKey }: { userKey: string }) {
          const user = TEST_USERS[userKey as keyof typeof TEST_USERS];
          if (!user) throw new Error(`Unknown user: ${userKey}`);

          const token = generateToken(user.id, user.discordId, user.username);
          const url = `${BASE_URL}/api/auth/profile`;
          console.log(`getUserProfile: Fetching ${url} for user ${userKey}`);

          try {
            const res = await fetch(url, {
              headers: {
                Cookie: `jwt=${token}`,
              },
            });

            if (!res.ok) {
              const body = await res.text();
              throw new Error(`Failed to get profile: ${res.status} ${body}`);
            }
            const data = await res.json();
            console.log(`getUserProfile: Got profile for ${userKey}:`, data.displayName);
            return data;
          } catch (error: any) {
            console.error(`getUserProfile: Error fetching profile for ${userKey}:`, error.message);
            throw error;
          }
        },

        // Fakeユーザーをマッチに参加させる
        async fakeUserJoin({ matchId, userKey }: { matchId: number; userKey: string }) {
          const user = TEST_USERS[userKey as keyof typeof TEST_USERS];
          if (!user) throw new Error(`Unknown user: ${userKey}`);

          const token = generateToken(user.id, user.discordId, user.username);
          const res = await fetch(`${BASE_URL}/api/matches/${matchId}/join`, {
            method: 'POST',
            headers: {
              Cookie: `jwt=${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (!res.ok) {
            const body = await res.text();
            throw new Error(`Failed to join match: ${res.status} ${body}`);
          }
          return { success: true, user: userKey };
        },

        // 複数のFakeユーザーを一括でマッチに参加させる
        async fakeUsersJoin({ matchId, userKeys }: { matchId: number; userKeys: string[] }) {
          const results = [];
          for (const userKey of userKeys) {
            const user = TEST_USERS[userKey as keyof typeof TEST_USERS];
            if (!user) throw new Error(`Unknown user: ${userKey}`);

            const token = generateToken(user.id, user.discordId, user.username);
            const res = await fetch(`${BASE_URL}/api/matches/${matchId}/join`, {
              method: 'POST',
              headers: {
                Cookie: `jwt=${token}`,
                'Content-Type': 'application/json',
              },
            });

            if (!res.ok) {
              const body = await res.text();
              console.error(`Failed to join ${userKey}: ${res.status} ${body}`);
            } else {
              results.push(userKey);
            }
          }
          console.log(`${results.length} users joined match ${matchId}`);
          return { success: true, joined: results.length };
        },

        // Fakeユーザーをマッチから退出させる
        async fakeUserLeave({ matchId, userKey }: { matchId: number; userKey: string }) {
          const user = TEST_USERS[userKey as keyof typeof TEST_USERS];
          if (!user) throw new Error(`Unknown user: ${userKey}`);

          const token = generateToken(user.id, user.discordId, user.username);
          const res = await fetch(`${BASE_URL}/api/matches/${matchId}/leave`, {
            method: 'DELETE',
            headers: {
              Cookie: `jwt=${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (!res.ok) {
            const body = await res.text();
            throw new Error(`Failed to leave match: ${res.status} ${body}`);
          }
          return { success: true, user: userKey };
        },

        // スコア投稿（CLASSIC用）
        async submitScore({
          category,
          season,
          match,
          userKey,
          machine,
          assistEnabled,
          raceResults,
        }: {
          category: string;
          season: number;
          match: number;
          userKey: string;
          machine: string;
          assistEnabled: boolean;
          raceResults: Array<{
            raceNumber: number;
            position?: number;
            isEliminated: boolean;
            isDisconnected?: boolean;
          }>;
        }) {
          const user = TEST_USERS[userKey as keyof typeof TEST_USERS];
          if (!user) throw new Error(`Unknown user: ${userKey}`);

          const token = generateToken(user.id, user.discordId, user.username);
          const res = await fetch(
            `${BASE_URL}/api/games/${category}/${season}/${match}/score`,
            {
              method: 'POST',
              headers: {
                Cookie: `jwt=${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ machine, assistEnabled, raceResults }),
            }
          );

          if (!res.ok) {
            const body = await res.text();
            throw new Error(`Failed to submit score for ${userKey}: ${res.status} ${body}`);
          }
          const data = await res.json();
          console.log(`Score submitted for ${userKey}`);
          return { success: true, user: userKey, data };
        },

        // 複数ユーザーのスコアを一括投稿
        async submitScoresForUsers({
          category,
          season,
          match,
          scores,
        }: {
          category: string;
          season: number;
          match: number;
          scores: Array<{
            userKey: string;
            machine: string;
            assistEnabled: boolean;
            raceResults: Array<{
              raceNumber: number;
              position?: number;
              isEliminated: boolean;
              isDisconnected?: boolean;
            }>;
          }>;
        }) {
          const results = [];
          for (const score of scores) {
            const user = TEST_USERS[score.userKey as keyof typeof TEST_USERS];
            if (!user) {
              console.error(`Unknown user: ${score.userKey}`);
              continue;
            }

            const token = generateToken(user.id, user.discordId, user.username);
            const res = await fetch(
              `${BASE_URL}/api/games/${category}/${season}/${match}/score`,
              {
                method: 'POST',
                headers: {
                  Cookie: `jwt=${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  machine: score.machine,
                  assistEnabled: score.assistEnabled,
                  raceResults: score.raceResults,
                }),
              }
            );

            if (!res.ok) {
              const body = await res.text();
              console.error(`Failed to submit score for ${score.userKey}: ${res.status} ${body}`);
            } else {
              results.push(score.userKey);
            }
          }
          console.log(`${results.length} scores submitted`);
          return { success: true, submitted: results.length, users: results };
        },

        // ゲーム情報を取得
        async getGameInfo({
          category,
          season,
          match,
        }: {
          category: string;
          season: number;
          match: number;
        }) {
          const res = await fetch(
            `${BASE_URL}/api/games/${category}/${season}/${match}`
          );
          if (!res.ok) {
            const body = await res.text();
            throw new Error(`Failed to get game info: ${res.status} ${body}`);
          }
          const data = await res.json();
          return data;
        },

        // スクリーンショット一覧取得
        async getScreenshots({ gameId }: { gameId: number }) {
          const res = await fetch(
            `${BASE_URL}/api/screenshots/game/${gameId}/submissions`
          );
          if (!res.ok) {
            const body = await res.text();
            throw new Error(`Failed to get screenshots: ${res.status} ${body}`);
          }
          return await res.json();
        },

        // スクリーンショット検証（モデレーター用）
        async verifyScreenshot({
          submissionId,
          modKey,
        }: {
          submissionId: number;
          modKey: string;
        }) {
          const user = TEST_USERS[modKey as keyof typeof TEST_USERS];
          if (!user) throw new Error(`Unknown user: ${modKey}`);

          const token = generateToken(user.id, user.discordId, user.username);
          const res = await fetch(
            `${BASE_URL}/api/screenshots/${submissionId}/verify`,
            {
              method: 'POST',
              headers: {
                Cookie: `jwt=${token}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (!res.ok) {
            const body = await res.text();
            throw new Error(`Failed to verify screenshot: ${res.status} ${body}`);
          }
          return { success: true, submissionId };
        },

        // スクリーンショット却下（モデレーター用）
        async rejectScreenshot({
          submissionId,
          modKey,
        }: {
          submissionId: number;
          modKey: string;
        }) {
          const user = TEST_USERS[modKey as keyof typeof TEST_USERS];
          if (!user) throw new Error(`Unknown user: ${modKey}`);

          const token = generateToken(user.id, user.discordId, user.username);
          const res = await fetch(
            `${BASE_URL}/api/screenshots/${submissionId}/reject`,
            {
              method: 'POST',
              headers: {
                Cookie: `jwt=${token}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (!res.ok) {
            const body = await res.text();
            throw new Error(`Failed to reject screenshot: ${res.status} ${body}`);
          }
          return { success: true, submissionId };
        },

        // スクリーンショット投稿（API経由）
        async submitScreenshotForUser({
          gameId,
          userKey,
          type,
          filePath,
        }: {
          gameId: number;
          userKey: string;
          type: 'INDIVIDUAL' | 'FINAL_SCORE';
          filePath: string;
        }) {
          const user = TEST_USERS[userKey as keyof typeof TEST_USERS];
          if (!user) throw new Error(`Unknown user: ${userKey}`);

          const token = generateToken(user.id, user.discordId, user.username);

          // Read file from fixture path
          const fs = require('fs');
          const path = require('path');
          const fixturePath = path.resolve(__dirname, 'cypress/fixtures', filePath);
          const fileBuffer = fs.readFileSync(fixturePath);
          const fileName = path.basename(filePath);

          // Create form data with file
          const FormData = require('form-data');
          const nodeFetch = require('node-fetch');
          const formData = new FormData();
          formData.append('gameId', gameId.toString());
          formData.append('type', type);
          formData.append('file', fileBuffer, {
            filename: fileName,
            contentType: 'image/png',
          });

          const res = await nodeFetch(`${BASE_URL}/api/screenshots/submit`, {
            method: 'POST',
            headers: {
              Cookie: `jwt=${token}`,
              ...formData.getHeaders(),
            },
            body: formData,
          });

          if (!res.ok) {
            const body = await res.text();
            throw new Error(`Failed to submit screenshot for ${userKey}: ${res.status} ${body}`);
          }
          const data = await res.json();
          console.log(`Screenshot submitted for ${userKey}`);
          return { success: true, user: userKey, data };
        },

        // 複数ユーザーのスクショを一括投稿
        async submitScreenshotsForAllUsers({
          gameId,
          userKeys,
          type,
          filePath,
        }: {
          gameId: number;
          userKeys: string[];
          type: 'INDIVIDUAL' | 'FINAL_SCORE';
          filePath: string;
        }) {
          const fs = require('fs');
          const path = require('path');
          const FormData = require('form-data');
          const nodeFetch = require('node-fetch');

          const fixturePath = path.resolve(__dirname, 'cypress/fixtures', filePath);
          const fileBuffer = fs.readFileSync(fixturePath);
          const fileName = path.basename(filePath);

          const results = [];
          for (const userKey of userKeys) {
            const user = TEST_USERS[userKey as keyof typeof TEST_USERS];
            if (!user) {
              console.error(`Unknown user: ${userKey}`);
              continue;
            }

            const token = generateToken(user.id, user.discordId, user.username);
            const formData = new FormData();
            formData.append('gameId', gameId.toString());
            formData.append('type', type);
            formData.append('file', fileBuffer, {
              filename: fileName,
              contentType: 'image/png',
            });

            const res = await nodeFetch(`${BASE_URL}/api/screenshots/submit`, {
              method: 'POST',
              headers: {
                Cookie: `jwt=${token}`,
                ...formData.getHeaders(),
              },
              body: formData,
            });

            if (!res.ok) {
              const body = await res.text();
              console.error(`Failed to submit screenshot for ${userKey}: ${res.status} ${body}`);
            } else {
              results.push(userKey);
            }
          }
          console.log(`${results.length} screenshots submitted`);
          return { success: true, submitted: results.length, users: results };
        },

        // ゲームの全スクショを一括VERIFY
        async verifyAllScreenshots({
          gameId,
          modKey,
        }: {
          gameId: number;
          modKey: string;
        }) {
          const user = TEST_USERS[modKey as keyof typeof TEST_USERS];
          if (!user) throw new Error(`Unknown user: ${modKey}`);

          const token = generateToken(user.id, user.discordId, user.username);

          // Get all pending screenshots for this game
          console.log(`Getting screenshots for gameId: ${gameId}`);
          const listRes = await fetch(`${BASE_URL}/api/screenshots/game/${gameId}/submissions`);
          if (!listRes.ok) {
            const body = await listRes.text();
            throw new Error(`Failed to get screenshots: ${listRes.status} ${body}`);
          }
          const screenshots = await listRes.json();
          console.log(`Total screenshots found: ${screenshots.length}`);
          console.log('Screenshot details:', screenshots.map((s: any) => ({
            id: s.id,
            isVerified: s.isVerified,
            isRejected: s.isRejected,
            type: s.type
          })));

          // Filter to only PENDING screenshots (not verified and not rejected)
          const pendingScreenshots = screenshots.filter(
            (s: any) => !s.isVerified && !s.isRejected
          );
          console.log(`PENDING screenshots: ${pendingScreenshots.length}`);

          const results = [];
          for (const screenshot of pendingScreenshots) {
            const res = await fetch(
              `${BASE_URL}/api/screenshots/${screenshot.id}/verify`,
              {
                method: 'POST',
                headers: {
                  Cookie: `jwt=${token}`,
                  'Content-Type': 'application/json',
                },
              }
            );

            if (!res.ok) {
              const body = await res.text();
              console.error(`Failed to verify screenshot ${screenshot.id}: ${res.status} ${body}`);
            } else {
              results.push(screenshot.id);
            }
          }
          console.log(`${results.length} screenshots verified`);
          return { success: true, verified: results.length, ids: results };
        },
      });
      return config;
    },
  },
});
