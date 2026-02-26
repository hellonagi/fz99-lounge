-- 最新IN_PROGRESS試合のスコア・スクショをクリア
WITH latest_game AS (
  SELECT g.id FROM games g
  JOIN matches m ON g."matchId" = m.id
  WHERE m.status = 'IN_PROGRESS'
  ORDER BY g."startedAt" DESC LIMIT 1
)
DELETE FROM race_results WHERE "gameParticipantId" IN (
  SELECT id FROM game_participants WHERE "gameId" IN (SELECT id FROM latest_game)
);

WITH latest_game AS (
  SELECT g.id FROM games g
  JOIN matches m ON g."matchId" = m.id
  WHERE m.status = 'IN_PROGRESS'
  ORDER BY g."startedAt" DESC LIMIT 1
)
DELETE FROM game_screenshot_submissions WHERE "gameId" IN (SELECT id FROM latest_game);

WITH latest_game AS (
  SELECT g.id FROM games g
  JOIN matches m ON g."matchId" = m.id
  WHERE m.status = 'IN_PROGRESS'
  ORDER BY g."startedAt" DESC LIMIT 1
)
DELETE FROM result_screenshots WHERE "gameId" IN (SELECT id FROM latest_game);

WITH latest_game AS (
  SELECT g.id FROM games g
  JOIN matches m ON g."matchId" = m.id
  WHERE m.status = 'IN_PROGRESS'
  ORDER BY g."startedAt" DESC LIMIT 1
)
DELETE FROM game_participants WHERE "gameId" IN (SELECT id FROM latest_game);
