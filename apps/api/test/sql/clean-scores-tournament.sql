-- トーナメント指定ラウンドのスコア・スクショをクリア
-- Usage: psql -v round=1

-- 1. race_results を削除
WITH target_game AS (
  SELECT g.id FROM games g
  JOIN matches m ON g."matchId" = m.id
  JOIN seasons s ON m."seasonId" = s.id
  JOIN events e ON s."eventId" = e.id
  WHERE e.category = 'TOURNAMENT'
    AND m."matchNumber" = :round
  ORDER BY s."seasonNumber" DESC LIMIT 1
)
DELETE FROM race_results WHERE "gameParticipantId" IN (
  SELECT id FROM game_participants WHERE "gameId" IN (SELECT id FROM target_game)
);

-- 2. スクショ削除
WITH target_game AS (
  SELECT g.id FROM games g
  JOIN matches m ON g."matchId" = m.id
  JOIN seasons s ON m."seasonId" = s.id
  JOIN events e ON s."eventId" = e.id
  WHERE e.category = 'TOURNAMENT'
    AND m."matchNumber" = :round
  ORDER BY s."seasonNumber" DESC LIMIT 1
)
DELETE FROM game_screenshot_submissions WHERE "gameId" IN (SELECT id FROM target_game);

WITH target_game AS (
  SELECT g.id FROM games g
  JOIN matches m ON g."matchId" = m.id
  JOIN seasons s ON m."seasonId" = s.id
  JOIN events e ON s."eventId" = e.id
  WHERE e.category = 'TOURNAMENT'
    AND m."matchNumber" = :round
  ORDER BY s."seasonNumber" DESC LIMIT 1
)
DELETE FROM result_screenshots WHERE "gameId" IN (SELECT id FROM target_game);

-- 3. game_participants を削除
WITH target_game AS (
  SELECT g.id FROM games g
  JOIN matches m ON g."matchId" = m.id
  JOIN seasons s ON m."seasonId" = s.id
  JOIN events e ON s."eventId" = e.id
  WHERE e.category = 'TOURNAMENT'
    AND m."matchNumber" = :round
  ORDER BY s."seasonNumber" DESC LIMIT 1
)
DELETE FROM game_participants
WHERE "gameId" IN (SELECT id FROM target_game);
