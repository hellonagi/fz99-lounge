-- 全試合のスコア・スクショをクリア
-- チーム戦の場合はteamIndex/isExcludedを保持し、スコア関連のみリセットする

-- 1. race_results を削除
DELETE FROM race_results;

-- 2. スクショ削除
DELETE FROM game_screenshot_submissions;
DELETE FROM result_screenshots;

-- 3. チーム戦: teamIndex付きの参加者はスコアリセットのみ
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
WHERE "teamIndex" IS NOT NULL OR "isExcluded" = true;

-- 4. 非チーム戦: teamIndex無しの参加者は削除
DELETE FROM game_participants
WHERE "teamIndex" IS NULL AND "isExcluded" = false;
