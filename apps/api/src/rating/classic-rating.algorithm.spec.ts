import { calculateRatingChanges } from './classic-rating.algorithm';
import {
  CLASSIC_CONFIG,
  ParticipantWithRating,
} from './classic-rating.constants';

/**
 * テスト用参加者ファクトリ。
 * デフォルトは「初期レート・初参加」の参加者で、必要なフィールドだけ上書きする。
 */
function makeParticipant(
  overrides: Partial<ParticipantWithRating> & {
    userId: number;
    position: number;
  },
): ParticipantWithRating {
  return {
    participantId: overrides.userId,
    totalScore: 1000 - overrides.position * 100,
    eliminatedAtRace: null,
    currentRating: CLASSIC_CONFIG.INITIAL_RATING,
    currentSeasonHigh: CLASSIC_CONFIG.INITIAL_RATING,
    gamesPlayed: 0,
    currentDisplayRating: 0,
    currentConvergencePoints: 0,
    ...overrides,
  };
}

describe('calculateRatingChanges', () => {
  describe('zero-sum invariant', () => {
    it('sums internal rating changes to exactly 0 for an equal-rating game', () => {
      const participants = [1, 2, 3, 4].map((userId, i) =>
        makeParticipant({ userId, position: i + 1 }),
      );

      const changes = calculateRatingChanges(participants);

      const total = changes.reduce(
        (sum, c) => sum + c.internalRatingChange,
        0,
      );
      expect(total).toBe(0);
    });
  });

  describe('position monotonicity', () => {
    it('gives strictly larger changes to better finishers, positive for 1st and negative for last', () => {
      const participants = [1, 2, 3, 4].map((userId, i) =>
        makeParticipant({ userId, position: i + 1 }),
      );

      const changes = calculateRatingChanges(participants);
      const byUser = new Map(changes.map((c) => [c.userId, c]));
      const ordered = [1, 2, 3, 4].map(
        (userId) => byUser.get(userId)!.internalRatingChange,
      );

      // 上位ほど変動が大きい(厳密に単調減少)
      expect(ordered[0]).toBeGreaterThan(ordered[1]);
      expect(ordered[1]).toBeGreaterThan(ordered[2]);
      expect(ordered[2]).toBeGreaterThan(ordered[3]);

      // 1位はプラス、最下位はマイナス
      expect(ordered[0]).toBeGreaterThan(0);
      expect(ordered[3]).toBeLessThan(0);
    });
  });

  describe('extreme upsets stay bounded', () => {
    // 注: 生のElo変動は対戦相手平均のため理論上限は実効K(100)+ボーナス20程度で、
    // MAX_RATING_CHANGE(±200)は現在の定数では届かないセーフティネット。
    // ここでは「どんな極端な入力でも有界・ゼロサム維持・番狂わせは大きく動く」を保証する。
    it('keeps every change within ±MAX_RATING_CHANGE and zero-sum in a max-upset game', () => {
      // レート500の選手が、レート5000の7人全員に勝つ大番狂わせ
      const underdog = makeParticipant({
        userId: 1,
        position: 1,
        currentRating: 500,
        currentSeasonHigh: 500,
      });
      const favorites = [2, 3, 4, 5, 6, 7, 8].map((userId, i) =>
        makeParticipant({
          userId,
          position: i + 2,
          currentRating: 5000,
          currentSeasonHigh: 5000,
        }),
      );

      const changes = calculateRatingChanges([underdog, ...favorites]);

      for (const c of changes) {
        expect(Math.abs(c.internalRatingChange)).toBeLessThanOrEqual(
          CLASSIC_CONFIG.MAX_RATING_CHANGE,
        );
      }

      // キャップ未発動なのでゼロサムは維持される
      const total = changes.reduce(
        (sum, c) => sum + c.internalRatingChange,
        0,
      );
      expect(total).toBeCloseTo(0, 6);

      // 大番狂わせの勝者は、同レート戦の勝者より大きく上がる
      const equalGame = calculateRatingChanges(
        [1, 2, 3, 4, 5, 6, 7, 8].map((userId, i) =>
          makeParticipant({ userId, position: i + 1 }),
        ),
      );
      const upsetWinner = changes.find((c) => c.userId === 1)!;
      const equalWinner = equalGame.find((c) => c.userId === 1)!;
      expect(upsetWinner.internalRatingChange).toBeGreaterThan(
        equalWinner.internalRatingChange,
      );
    });
  });

  describe('tied positions', () => {
    it('gives identical changes to tied players and keeps ordering around them', () => {
      // 2位タイが2人いる4人戦(DNFグルーピング後のサービス層出力を模した入力)
      const participants = [
        makeParticipant({ userId: 1, position: 1 }),
        makeParticipant({ userId: 2, position: 2 }),
        makeParticipant({ userId: 3, position: 2 }),
        makeParticipant({ userId: 4, position: 4 }),
      ];

      const changes = calculateRatingChanges(participants);
      const byUser = new Map(
        changes.map((c) => [c.userId, c.internalRatingChange]),
      );

      // タイ同士は完全に同じ変動
      expect(byUser.get(2)).toBe(byUser.get(3));

      // 順序は保たれる: 1位 > 2位タイ > 4位
      expect(byUser.get(1)!).toBeGreaterThan(byUser.get(2)!);
      expect(byUser.get(2)!).toBeGreaterThan(byUser.get(4)!);

      // ゼロサムも維持
      const total = changes.reduce(
        (sum, c) => sum + c.internalRatingChange,
        0,
      );
      expect(total).toBeCloseTo(0, 6);
    });
  });

  describe('comparison mode boundary (INITIAL_COMPARISON_GAMES)', () => {
    // 最下位レート(20人中20位)の選手が1位を取る20人戦。
    // 全体比較なら「19人の格上を全員倒した」扱いで大きく上がり、
    // 近傍比較なら近くの弱い6人としか比較されないため上げ幅は小さい。
    function focusChangeWithGamesPlayed(gamesPlayed: number): number {
      const others = Array.from({ length: 19 }, (_, i) =>
        makeParticipant({
          userId: i + 1,
          position: i + 2, // 2位〜20位(レート順)
          currentRating: 4000 - (i + 1) * 100,
          currentSeasonHigh: 4000 - (i + 1) * 100,
          gamesPlayed: 10,
        }),
      );
      const focus = makeParticipant({
        userId: 20,
        position: 1,
        currentRating: 2100,
        currentSeasonHigh: 2100,
        gamesPlayed,
      });

      const changes = calculateRatingChanges([...others, focus]);
      return changes.find((c) => c.userId === 20)!.internalRatingChange;
    }

    it('switches from all-player to proximity comparison at exactly 5 games played', () => {
      const c3 = focusChangeWithGamesPlayed(3);
      const c4 = focusChangeWithGamesPlayed(4);
      const c5 = focusChangeWithGamesPlayed(5);
      const c6 = focusChangeWithGamesPlayed(6);

      // 4戦以下は同じモード(全体比較)なので結果は一致
      expect(c3).toBeCloseTo(c4, 10);
      // 5戦以上も同じモード(近傍比較)なので結果は一致
      expect(c5).toBeCloseTo(c6, 10);
      // 境界(4→5)でモードが切り替わり、格上総取りの全体比較の方が大きい
      expect(c4).toBeGreaterThan(c5);
    });
  });
});
