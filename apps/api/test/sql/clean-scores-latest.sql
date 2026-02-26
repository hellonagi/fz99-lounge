-- 最新IN_PROGRESS試合のスコア・スクショをクリア
-- チーム戦の場合はteamIndex/isExcludedを保持し、スコア関連のみリセットする

-- 1. race_results を削除
WITH latest_game AS (
  SELECT g.id FROM games g
  JOIN matches m ON g."matchId" = m.id
  WHERE m.status = 'IN_PROGRESS'
  ORDER BY g."startedAt" DESC LIMIT 1
)
DELETE FROM race_results WHERE "gameParticipantId" IN (
  SELECT id FROM game_participants WHERE "gameId" IN (SELECT id FROM latest_game)
);

-- 2. スクショ削除
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

-- 3. チーム戦: teamIndex付きの参加者はスコアリセットのみ（チーム割り当て保持）
WITH latest_game AS (
  SELECT g.id FROM games g
  JOIN matches m ON g."matchId" = m.id
  WHERE m.status = 'IN_PROGRESS'
  ORDER BY g."startedAt" DESC LIMIT 1
)
UPDATE game_participants SET
  machine = '',
  "assistEnabled" = false,
  status = 'UNSUBMITTED',
  "submittedAt" = NULL,
  "totalScore" = NULL,
  "eliminatedAtRace" = NULL,
  "verifiedBy" = NULL,
  "verifiedAt" = NULL,
  "rejectedBy" = NULL,
  "rejectedAt" = NULL,
  "screenshotRequested" = false,
  "screenshotRequestedBy" = NULL,
  "screenshotRequestedAt" = NULL
WHERE "gameId" IN (SELECT id FROM latest_game)
  AND ("teamIndex" IS NOT NULL OR "isExcluded" = true);

-- 4. 非チーム戦: teamIndex無しの参加者は従来通り削除
WITH latest_game AS (
  SELECT g.id FROM games g
  JOIN matches m ON g."matchId" = m.id
  WHERE m.status = 'IN_PROGRESS'
  ORDER BY g."startedAt" DESC LIMIT 1
)
DELETE FROM game_participants
WHERE "gameId" IN (SELECT id FROM latest_game)
  AND "teamIndex" IS NULL
  AND "isExcluded" = false;
