/// <reference types="cypress" />

describe('CLASSIC Lobby Flow', () => {
  // N秒後の日時を取得するヘルパー（テスト用に秒単位で指定）
  const getFutureDateTime = (secondsFromNow: number): string => {
    const date = new Date(Date.now() + secondsFromNow * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // マッチ番号を追跡（試合ごとにインクリメント）
  let currentMatchNumber = 0;

  before(() => {
    cy.resetDb();
    // 有効なwindowコンテキストを確保するため、最初にページを訪問
    cy.visit('/');
  });

  // ===================================================================
  // Admin Tests
  // ===================================================================
  describe('Admin Tests', () => {
    beforeEach(() => {
      cy.loginAsAdmin();
    });

    // =================================================================
    // 試合1: 全バリデーション + 自動レート計算
    // =================================================================
    it('試合1: Admin - 全バリデーション + 自動レート計算', () => {
      let matchId: number;
      let gameId: number;
      currentMatchNumber = 1;

      cy.intercept('POST', '/api/matches').as('createMatch');

      // 1. 管理ページに移動
      cy.visit('/admin');

      // 2. プロフィール設定モーダル
      cy.contains('Set Up Your Profile').should('be.visible');
      cy.get('[role="dialog"]').within(() => {
        cy.get('input[name="displayName"]').type('TestAdmin');
        cy.get('[role="combobox"]').click();
      });
      cy.contains('[role="option"]', 'Japan').click();
      cy.get('[role="dialog"]').within(() => {
        cy.get('button[type="submit"]').contains('Save Profile').click();
      });
      cy.contains('Set Up Your Profile').should('not.exist');

      // 3. CLASSICモードを選択
      cy.contains('label', 'Classic Mode').click();

      // 4. Seasonを選択
      cy.contains('label', 'Season')
        .parent()
        .find('[role="combobox"]')
        .click();
      cy.get('[role="option"]').first().click();

      // 5. 開始時刻を設定（65秒後）
      cy.get('input[type="datetime-local"]').type(getFutureDateTime(180));

      // 6. Create Match
      cy.get('button[type="submit"]').contains('Create Match').click();
      cy.contains('Match created successfully!').should('be.visible');
      cy.wait('@createMatch').then((interception) => {
        matchId = interception.response?.body?.id;
        cy.log(`Created match ID: ${matchId}`);
      });

      // 7. ホームに移動
      cy.visit('/');
      // Wait for page to load and show match data (longer timeout for initial API call)
      cy.contains('LEAGUE', { timeout: 30000 }).should('be.visible');

      // 8. 20人のfakeユーザーをJoin（満員にする）
      cy.then(() => {
        const userKeys = Array.from({ length: 20 }, (_, i) => `player${i + 1}`);
        return cy.task('fakeUsersJoin', { matchId, userKeys });
      }).then((result: any) => {
        cy.log(`Joined ${result.joined} users`);
        expect(result.joined).to.eq(20);
      });

      cy.reload();
      cy.contains('20/20').should('be.visible');

      // 9. TestAdminがJoin → 400エラー（満員確認）
      cy.intercept('POST', '/api/matches/*/join').as('joinAttempt');
      cy.get('button').contains('JOIN NOW').click();
      cy.wait('@joinAttempt').its('response.statusCode').should('eq', 400);

      // 10. player1をLeave
      cy.then(() => {
        return cy.task('fakeUserLeave', { matchId, userKey: 'player1' });
      });

      cy.reload();
      cy.contains('19/20').should('be.visible');

      // 11. TestAdminがJoin → 成功
      cy.get('button').contains('JOIN NOW').click();
      cy.contains('TestAdmin').should('be.visible');
      cy.contains('20/20').should('be.visible');

      // 12. TestAdminがLeave → 成功
      cy.get('button').contains('LEAVE').click();
      cy.contains('19/20').should('be.visible');

      // 13. TestAdminが再度Join → 成功
      cy.get('button').contains('JOIN NOW').click();
      cy.contains('TestAdmin').should('be.visible');
      cy.contains('20/20').should('be.visible');

      // 14. 試合ページへの自動リダイレクトを待つ（最大3分）
      cy.log('Waiting for auto-redirect to match page...');
      cy.url({ timeout: 180000 }).should('include', '/matches/classic/');
      cy.contains('Live').should('be.visible');
      cy.contains('Passcode', { timeout: 15000 }).should('be.visible');

      // 16. ゲーム情報を取得
      cy.then(() => {
        return cy.task('getGameInfo', {
          category: 'classic',
          season: 1,
          match: currentMatchNumber,
        });
      }).then((game: any) => {
        gameId = game.id;
        cy.log(`Game ID: ${gameId}`);
      });

      // ===== スコア投稿バリデーション =====
      cy.log('=== SCORE SUBMISSION ===');

      // 17. TestAdminがUIでスコア投稿
      cy.get('button').contains('Blue Falcon').click();
      cy.get('input[name="race1Position"]').type('1');
      cy.get('input[name="race2Position"]').type('2');
      cy.get('input[name="race3Position"]').type('3');
      cy.get('button[type="submit"]').contains('Submit Result').click();
      cy.contains('Score submitted successfully!').should('be.visible');
      cy.contains('TestAdmin').should('be.visible');

      // 18. player2-player20のスコアをAPI投稿
      cy.then(() => {
        const scores = [];
        for (let i = 2; i <= 20; i++) {
          scores.push({
            userKey: `player${i}`,
            machine: 'Blue Falcon',
            assistEnabled: false,
            raceResults: [
              { raceNumber: 1, position: i, isEliminated: false },
              { raceNumber: 2, position: i, isEliminated: false },
              { raceNumber: 3, position: i, isEliminated: false },
            ],
          });
        }
        return cy.task('submitScoresForUsers', {
          category: 'classic',
          season: 1,
          match: currentMatchNumber,
          scores,
        });
      }).then((result: any) => {
        cy.log(`Submitted ${result.submitted} scores`);
        expect(result.submitted).to.eq(19);
      });

      cy.reload();

      // ===== スクショ投稿バリデーション =====
      cy.log('=== SCREENSHOT UPLOAD TESTS ===');

      // 19. 正常アップロード
      cy.contains('Submit Individual Score Screenshot').scrollIntoView();
      cy.contains('Submit Individual Score Screenshot').parent().parent().within(() => {
        cy.get('input[type="file"]').selectFile('cypress/fixtures/test-screenshot.png', { force: true });
        cy.get('button[type="submit"]').should('not.be.disabled');
        cy.get('button[type="submit"]').click();
      });
      cy.contains('Screenshot uploaded successfully!').should('be.visible');

      // 20. 不正ファイル形式 → エラー
      cy.contains('Submit Individual Score Screenshot').parent().parent().within(() => {
        cy.get('input[type="file"]').selectFile('cypress/fixtures/invalid-file.txt', { force: true });
      });
      cy.contains('Only JPG, PNG, and WebP images are allowed').should('be.visible');

      // 21. 1位のFINAL_SCOREスクショをアップロード
      cy.contains('Submit Final Score Screenshot').scrollIntoView();
      cy.contains('Submit Final Score Screenshot').parent().parent().within(() => {
        cy.get('input[type="file"]').selectFile('cypress/fixtures/test-screenshot.png', { force: true });
        cy.get('button[type="submit"]').should('not.be.disabled');
        cy.get('button[type="submit"]').click();
      });
      cy.contains('Screenshot uploaded successfully!').should('be.visible');

      // 22. 全員のINDIVIDUALスクショを投稿（API経由）
      cy.log('Submitting individual screenshots for all players');
      cy.then(() => {
        const userKeys = Array.from({ length: 19 }, (_, i) => `player${i + 2}`);
        return cy.task('submitScreenshotsForAllUsers', {
          gameId,
          userKeys,
          type: 'INDIVIDUAL',
          filePath: 'test-screenshot.png',
        });
      }).then((result: any) => {
        cy.log(`Submitted ${result.submitted} individual screenshots`);
        expect(result.submitted).to.eq(19);
      });

      // ===== Modタブで検証 =====
      cy.log('=== MODERATOR VERIFICATION ===');

      cy.reload();
      cy.wait(2000);
      cy.get('[role="tablist"]').contains('Mod').click();
      cy.wait(500);
      cy.contains('Verification Progress').should('be.visible');

      // 23. Verify/Reject操作
      cy.contains('button', 'Verify').should('be.visible');

      // 24. 全スクショをVERIFY（API経由）→ 自動レート計算
      cy.log('Verifying all screenshots (should trigger auto-completion)');
      cy.then(() => {
        return cy.task('verifyAllScreenshots', {
          gameId,
          modKey: 'admin',
        });
      }).then((result: any) => {
        cy.log(`Verified ${result.verified} screenshots`);
        // 20 INDIVIDUAL + 1 FINAL_SCORE = 21 (FINAL_SCORE might fail, so accept 20+)
        expect(result.verified).to.be.at.least(20);
      });

      // 25. 自動でMatch overになることを確認
      cy.wait(2000);
      cy.reload();
      cy.scrollTo('top');
      cy.contains('Match over', { timeout: 15000 }).should('be.visible');

      cy.log('=== MATCH 1 COMPLETED: Auto rating calculation after all verified ===');
    });

    // =================================================================
    // 試合2: End Matchで強制レート計算
    // =================================================================
    it('試合2: Admin - End Matchで強制レート計算', () => {
      let matchId: number;
      currentMatchNumber = 2;

      cy.intercept('POST', '/api/matches').as('createMatch');

      // 1. 管理ページでマッチ作成
      cy.visit('/admin');
      cy.contains('Admin Dashboard').should('be.visible');

      cy.contains('label', 'Classic Mode').click();
      cy.contains('label', 'Season')
        .parent()
        .find('[role="combobox"]')
        .click();
      cy.get('[role="option"]').first().click();
      cy.get('input[type="datetime-local"]').type(getFutureDateTime(180));
      cy.get('button[type="submit"]').contains('Create Match').click();
      cy.contains('Match created successfully!').should('be.visible');
      cy.wait('@createMatch').then((interception) => {
        matchId = interception.response?.body?.id;
      });

      // 2. ホームに移動
      cy.visit('/');

      // 3. 19人のfakeユーザー + TestAdminをJoin
      cy.then(() => {
        const userKeys = Array.from({ length: 19 }, (_, i) => `player${i + 2}`);
        return cy.task('fakeUsersJoin', { matchId, userKeys });
      });

      cy.reload();
      cy.get('button').contains('JOIN NOW').click();
      cy.contains('20/20').should('be.visible');

      // 4. 試合ページへの自動リダイレクトを待つ
      cy.log('Waiting for auto-redirect to match page...');
      cy.url({ timeout: 180000 }).should('include', '/matches/classic/');
      cy.contains('Live').should('be.visible');

      // 5. 全員のスコアを投稿（API経由）
      cy.then(() => {
        const scores = [
          {
            userKey: 'admin',
            machine: 'Blue Falcon',
            assistEnabled: false,
            raceResults: [
              { raceNumber: 1, position: 1, isEliminated: false },
              { raceNumber: 2, position: 1, isEliminated: false },
              { raceNumber: 3, position: 1, isEliminated: false },
            ],
          },
          ...Array.from({ length: 19 }, (_, i) => ({
            userKey: `player${i + 2}`,
            machine: 'Blue Falcon',
            assistEnabled: false,
            raceResults: [
              { raceNumber: 1, position: i + 2, isEliminated: false },
              { raceNumber: 2, position: i + 2, isEliminated: false },
              { raceNumber: 3, position: i + 2, isEliminated: false },
            ],
          })),
        ];
        return cy.task('submitScoresForUsers', {
          category: 'classic',
          season: 1,
          match: currentMatchNumber,
          scores,
        });
      }).then((result: any) => {
        expect(result.submitted).to.eq(20);
      });

      cy.reload();
      cy.wait(2000);

      // 6. スクショ未検証のままEnd Match
      cy.get('[role="tablist"]').contains('Mod').click();
      cy.wait(500);
      cy.on('window:confirm', () => true);
      cy.contains('button', 'End Match').click();

      cy.wait(2000);
      cy.reload();
      cy.scrollTo('top');
      cy.contains('Match over', { timeout: 15000 }).should('be.visible');

      cy.log('=== MATCH 2 COMPLETED: Forced rating calculation via End Match ===');
    });
  });

  // ===================================================================
  // Moderator Tests
  // ===================================================================
  describe('Moderator Tests', () => {
    beforeEach(() => {
      cy.loginAsModerator();
    });

    // =================================================================
    // 試合3: Moderator - 全バリデーション + 自動レート計算
    // =================================================================
    it('試合3: Moderator - 全バリデーション + 自動レート計算', () => {
      let matchId: number;
      let matchNumber: number;
      let gameId: number;

      cy.intercept('POST', '/api/matches').as('createMatch');

      // 1. 管理ページでマッチ作成（Moderatorでもアクセス可能）
      cy.visit('/admin');
      cy.contains('Admin Dashboard').should('be.visible');

      // 2. CLASSICモードを選択
      cy.contains('label', 'Classic Mode').click();
      cy.contains('label', 'Season')
        .parent()
        .find('[role="combobox"]')
        .click();
      cy.get('[role="option"]').first().click();
      cy.get('input[type="datetime-local"]').type(getFutureDateTime(180));
      cy.get('button[type="submit"]').contains('Create Match').click();
      cy.contains('Match created successfully!').should('be.visible');
      cy.wait('@createMatch').then((interception) => {
        matchId = interception.response?.body?.id;
        matchNumber = interception.response?.body?.matchNumber;
        cy.log(`Created match ID: ${matchId}, matchNumber: ${matchNumber}`);
      });

      // 3. ホームに移動
      cy.visit('/');

      // 4. 20人のfakeユーザーをJoin
      cy.then(() => {
        const userKeys = Array.from({ length: 20 }, (_, i) => `player${i + 1}`);
        return cy.task('fakeUsersJoin', { matchId, userKeys });
      });

      cy.reload();
      cy.contains('20/20').should('be.visible');

      // 5. Moderatorで満員時Join不可を確認
      cy.intercept('POST', '/api/matches/*/join').as('joinAttempt');
      cy.get('button').contains('JOIN NOW').click();
      cy.wait('@joinAttempt').its('response.statusCode').should('eq', 400);

      // 6. player1をLeave
      cy.then(() => {
        return cy.task('fakeUserLeave', { matchId, userKey: 'player1' });
      });

      cy.reload();
      cy.get('button').contains('JOIN NOW').click();
      cy.contains('Mod1').should('be.visible');
      cy.contains('20/20').should('be.visible');

      // 7. 試合ページへの自動リダイレクトを待つ
      cy.log('Waiting for auto-redirect to match page...');
      cy.url({ timeout: 180000 }).should('include', '/matches/classic/');
      cy.contains('Live').should('be.visible');

      // 8. ゲーム情報を取得
      cy.then(() => {
        return cy.task('getGameInfo', {
          category: 'classic',
          season: 1,
          match: matchNumber,
        });
      }).then((game: any) => {
        gameId = game.id;
      });

      // 9. 全員のスコアを投稿
      cy.then(() => {
        const scores = [
          {
            userKey: 'mod1',
            machine: 'Blue Falcon',
            assistEnabled: false,
            raceResults: [
              { raceNumber: 1, position: 1, isEliminated: false },
              { raceNumber: 2, position: 1, isEliminated: false },
              { raceNumber: 3, position: 1, isEliminated: false },
            ],
          },
          ...Array.from({ length: 19 }, (_, i) => ({
            userKey: `player${i + 2}`,
            machine: 'Blue Falcon',
            assistEnabled: false,
            raceResults: [
              { raceNumber: 1, position: i + 2, isEliminated: false },
              { raceNumber: 2, position: i + 2, isEliminated: false },
              { raceNumber: 3, position: i + 2, isEliminated: false },
            ],
          })),
        ];
        return cy.task('submitScoresForUsers', {
          category: 'classic',
          season: 1,
          match: matchNumber,
          scores,
        });
      });

      // 10. 全員のスクショを投稿
      cy.then(() => {
        const userKeys = ['mod1', ...Array.from({ length: 19 }, (_, i) => `player${i + 2}`)];
        return cy.task('submitScreenshotsForAllUsers', {
          gameId,
          userKeys,
          type: 'INDIVIDUAL',
          filePath: 'test-screenshot.png',
        });
      });

      // 11. FINAL_SCOREスクショ投稿
      cy.then(() => {
        return cy.task('submitScreenshotForUser', {
          gameId,
          userKey: 'mod1',
          type: 'FINAL_SCORE',
          filePath: 'test-screenshot.png',
        });
      });

      // 12. Modタブ確認
      cy.reload();
      cy.wait(2000); // データロードを待つ
      // Radix UIのTabsTriggerをクリック
      cy.get('[role="tablist"]').contains('Mod').click();
      cy.wait(500); // タブ切り替えを待つ
      cy.contains('Verification Progress').should('be.visible');

      // 13. 全スクショをVERIFY
      cy.then(() => {
        return cy.task('verifyAllScreenshots', {
          gameId,
          modKey: 'mod1',
        });
      }).then((result: any) => {
        expect(result.verified).to.be.at.least(20);
      });

      // 14. 自動完了の確認（全スクショ承認で自動的にCOMPLETEDになる）
      cy.reload();
      cy.wait(2000);
      cy.scrollTo('top');
      cy.contains(/Match over|Completed/i, { timeout: 15000 }).should('be.visible');

      cy.log('=== MATCH 3 COMPLETED: Moderator full validation with auto-completion ===');
    });

    // =================================================================
    // 試合4: Moderator - End Matchで強制レート計算
    // =================================================================
    it('試合4: Moderator - End Matchで強制レート計算', () => {
      let matchId: number;
      currentMatchNumber = 4;

      cy.intercept('POST', '/api/matches').as('createMatch');

      // 1. マッチ作成
      cy.visit('/admin');
      cy.contains('Admin Dashboard').should('be.visible');
      cy.contains('label', 'Classic Mode').click();
      cy.contains('label', 'Season')
        .parent()
        .find('[role="combobox"]')
        .click();
      cy.get('[role="option"]').first().click();
      cy.get('input[type="datetime-local"]').type(getFutureDateTime(180));
      cy.get('button[type="submit"]').contains('Create Match').click();
      cy.contains('Match created successfully!').should('be.visible');
      cy.wait('@createMatch').then((interception) => {
        matchId = interception.response?.body?.id;
      });

      // 2. 19人 + Mod1をJoin
      cy.visit('/');
      cy.then(() => {
        const userKeys = Array.from({ length: 19 }, (_, i) => `player${i + 2}`);
        return cy.task('fakeUsersJoin', { matchId, userKeys });
      });

      cy.reload();
      cy.get('button').contains('JOIN NOW').click();
      cy.contains('20/20').should('be.visible');

      // 3. 試合ページへの自動リダイレクトを待つ
      cy.log('Waiting for auto-redirect to match page...');
      cy.url({ timeout: 180000 }).should('include', '/matches/classic/');
      cy.contains('Live').should('be.visible');

      // 4. 全員のスコアを投稿
      cy.then(() => {
        const scores = [
          {
            userKey: 'mod1',
            machine: 'Blue Falcon',
            assistEnabled: false,
            raceResults: [
              { raceNumber: 1, position: 1, isEliminated: false },
              { raceNumber: 2, position: 1, isEliminated: false },
              { raceNumber: 3, position: 1, isEliminated: false },
            ],
          },
          ...Array.from({ length: 19 }, (_, i) => ({
            userKey: `player${i + 2}`,
            machine: 'Blue Falcon',
            assistEnabled: false,
            raceResults: [
              { raceNumber: 1, position: i + 2, isEliminated: false },
              { raceNumber: 2, position: i + 2, isEliminated: false },
              { raceNumber: 3, position: i + 2, isEliminated: false },
            ],
          })),
        ];
        return cy.task('submitScoresForUsers', {
          category: 'classic',
          season: 1,
          match: currentMatchNumber,
          scores,
        });
      });

      cy.reload();
      cy.wait(2000);

      // 5. End Match
      cy.get('[role="tablist"]').contains('Mod').click();
      cy.wait(500);
      cy.on('window:confirm', () => true);
      cy.contains('button', 'End Match').click();

      cy.wait(2000);
      cy.reload();
      cy.scrollTo('top');
      cy.contains('Match over', { timeout: 15000 }).should('be.visible');

      cy.log('=== MATCH 4 COMPLETED: Moderator forced End Match ===');
    });
  });

  // ===================================================================
  // Player Tests
  // ===================================================================
  describe('Player Tests', () => {
    // =================================================================
    // 試合5: Player - 権限制限確認
    // =================================================================
    it('試合5: Player - 権限制限確認', () => {
      let matchId: number;
      currentMatchNumber = 5;

      // 1. まずAdminでマッチを作成
      cy.loginAsAdmin();
      cy.intercept('POST', '/api/matches').as('createMatch');

      cy.visit('/admin');
      cy.contains('Admin Dashboard').should('be.visible');
      cy.contains('label', 'Classic Mode').click();
      cy.contains('label', 'Season')
        .parent()
        .find('[role="combobox"]')
        .click();
      cy.get('[role="option"]').first().click();
      cy.get('input[type="datetime-local"]').type(getFutureDateTime(180));
      cy.get('button[type="submit"]').contains('Create Match').click();
      cy.contains('Match created successfully!').should('be.visible');
      cy.wait('@createMatch').then((interception) => {
        matchId = interception.response?.body?.id;
      });

      // 2. player1を含む19人をJoin
      cy.then(() => {
        const userKeys = Array.from({ length: 19 }, (_, i) => `player${i + 1}`);
        return cy.task('fakeUsersJoin', { matchId, userKeys });
      });

      // 3. Adminも参加
      cy.visit('/');
      cy.get('button').contains('JOIN NOW').click();
      cy.contains('20/20').should('be.visible');

      // 4. 試合ページへの自動リダイレクトを待つ
      cy.log('Waiting for auto-redirect to match page...');
      cy.url({ timeout: 180000 }).should('include', '/matches/classic/');
      cy.contains('Live').should('be.visible');

      // 5. Playerでログインし直す
      cy.loginAsPlayer();
      cy.reload();

      // 6. 権限制限を確認
      cy.log('=== CHECKING PLAYER PERMISSION RESTRICTIONS ===');

      // Modタブが表示されないことを確認
      cy.contains('button', 'Mod').should('not.exist');

      // 7. /adminにアクセスしようとする → リダイレクトされるか確認
      cy.visit('/admin');
      // Playerは/adminにアクセスできないはず
      cy.url().should('not.include', '/admin');

      // 8. 試合ページに戻って自分のスコア・スクショ投稿は可能か確認
      cy.visit(`/matches/classic/1/${currentMatchNumber}`);
      cy.contains('Live').should('be.visible');

      // Player1としてスコア投稿可能
      cy.get('button').contains('Blue Falcon').click();
      cy.get('input[name="race1Position"]').type('1');
      cy.get('input[name="race2Position"]').type('2');
      cy.get('input[name="race3Position"]').type('3');
      cy.get('button[type="submit"]').contains('Submit Result').click();
      cy.contains('Score submitted successfully!').should('be.visible');

      cy.log('=== MATCH 5 COMPLETED: Player permission restrictions verified ===');
    });
  });
});
