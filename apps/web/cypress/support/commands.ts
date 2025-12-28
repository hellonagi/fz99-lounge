/// <reference types="cypress" />

// シードで作成されるテストユーザー（seed.tsと同期）
const TEST_USERS = {
  // admin は displayName なし（プロフィール設定モーダルをテストするため）
  admin: { id: 1, discordId: 'admin-001', username: 'test_admin', displayName: null as string | null, role: 'ADMIN' },
  mod1: { id: 2, discordId: 'mod-001', username: 'test_mod_1', displayName: 'Mod1', role: 'MODERATOR' },
  mod2: { id: 3, discordId: 'mod-002', username: 'test_mod_2', displayName: 'Mod2', role: 'MODERATOR' },
  mod3: { id: 4, discordId: 'mod-003', username: 'test_mod_3', displayName: 'Mod3', role: 'MODERATOR' },
  // プレイヤー（5〜30）
  ...Object.fromEntries(
    Array.from({ length: 26 }, (_, i) => [
      `player${i + 1}`,
      {
        id: i + 5,
        discordId: `player-${String(i + 1).padStart(3, '0')}`,
        username: `test_player_${i + 1}`,
        displayName: `Player${i + 1}`,
        role: 'PLAYER',
      },
    ])
  ),
};

type TestUserKey = keyof typeof TEST_USERS;

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * データベースをリセットしてシードデータを投入
       */
      resetDb(): Chainable<void>;

      /**
       * テストユーザーとしてログイン
       * @param userKey - テストユーザーのキー (admin, mod1, player1, etc.)
       */
      login(userKey: TestUserKey): Chainable<void>;

      /**
       * 管理者としてログイン
       */
      loginAsAdmin(): Chainable<void>;

      /**
       * モデレーターとしてログイン
       */
      loginAsModerator(): Chainable<void>;

      /**
       * 一般プレイヤーとしてログイン
       */
      loginAsPlayer(): Chainable<void>;

      /**
       * ログアウト
       */
      logout(): Chainable<void>;
    }
  }
}

// DBリセット
Cypress.Commands.add('resetDb', () => {
  cy.task('resetDb');
});

// テストユーザーとしてログイン
// JWT Cookie + localStorage (Zustand auth-storage) を設定
Cypress.Commands.add('login', (userKey: TestUserKey) => {
  const user = TEST_USERS[userKey];

  cy.task('generateTestAuth', {
    id: user.id,
    discordId: user.discordId,
    username: user.username,
  }).then((token) => {
    cy.setCookie('jwt', token as string, {
      path: '/',
    });
  });

  // displayNameがnullの場合はAPIから最新のプロフィールを取得
  // これによりMatch 1ではモーダルが表示され、Match 2以降ではDBのdisplayNameが使われる
  if (user.displayName === null) {
    cy.task('getUserProfile', { userKey }).then((profile: any) => {
      cy.window().then((win) => {
        const authStorage = {
          state: {
            user: profile,
            isAuthenticated: true,
          },
          version: 0,
        };
        win.localStorage.setItem('auth-storage', JSON.stringify(authStorage));
      });
    });
  } else {
    // displayNameがある場合はTEST_USERSのデータを使用
    cy.window().then((win) => {
      const authStorage = {
        state: {
          user: {
            id: user.id,
            discordId: user.discordId,
            username: user.username,
            displayName: user.displayName,
            role: user.role,
          },
          isAuthenticated: true,
        },
        version: 0,
      };
      win.localStorage.setItem('auth-storage', JSON.stringify(authStorage));
    });
  }
});

// ショートカット: 管理者ログイン
Cypress.Commands.add('loginAsAdmin', () => {
  cy.login('admin');
});

// ショートカット: モデレーターログイン
Cypress.Commands.add('loginAsModerator', () => {
  cy.login('mod1');
});

// ショートカット: プレイヤーログイン
Cypress.Commands.add('loginAsPlayer', () => {
  cy.login('player1');
});

// ログアウト
Cypress.Commands.add('logout', () => {
  cy.clearCookie('jwt');
  cy.window().then((win) => {
    win.localStorage.removeItem('auth-storage');
  });
});

export {};
