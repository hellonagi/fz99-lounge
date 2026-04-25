-- トーナメントを募集前の状態にリセット
-- Usage: psql -v season=1
-- 最新のTOURNAMENTシーズンの全データを削除し、tournament_configをDRAFTに戻す

BEGIN;

-- 1. matches を削除 (CASCADE: match_participants, games, game_participants, race_results,
--    game_screenshot_submissions, result_screenshots, result_disputes, split_votes, match_streams, rating_histories)
DELETE FROM matches
WHERE "seasonId" IN (
  SELECT s.id FROM seasons s
  JOIN events e ON s."eventId" = e.id
  WHERE e.category = 'TOURNAMENT' AND s."seasonNumber" = :season
);

-- 2. user_season_stats を削除
DELETE FROM user_season_stats
WHERE "seasonId" IN (
  SELECT s.id FROM seasons s
  JOIN events e ON s."eventId" = e.id
  WHERE e.category = 'TOURNAMENT' AND s."seasonNumber" = :season
);

-- 3. tournament_config を REGISTRATION_CLOSED に戻す (参加登録は保持)
UPDATE tournament_configs SET status = 'REGISTRATION_OPEN'
WHERE id IN (
  SELECT tc.id FROM tournament_configs tc
  JOIN seasons s ON tc."seasonId" = s.id
  JOIN events e ON s."eventId" = e.id
  WHERE e.category = 'TOURNAMENT' AND s."seasonNumber" = :season
);

COMMIT;
