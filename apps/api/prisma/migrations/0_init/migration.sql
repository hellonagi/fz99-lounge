-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PLAYER', 'MODERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'WARNED', 'SUSPENDED', 'BANNED', 'DELETED');

-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('GP', 'CLASSIC', 'TOURNAMENT');

-- CreateEnum
CREATE TYPE "InGameMode" AS ENUM ('GRAND_PRIX', 'MINI_PRIX', 'TEAM_BATTLE', 'CLASSIC_MINI_PRIX', 'PRO', 'CLASSIC', 'NINETY_NINE');

-- CreateEnum
CREATE TYPE "League" AS ENUM ('KNIGHT', 'QUEEN', 'KING', 'ACE', 'MIRROR_KNIGHT', 'MIRROR_QUEEN', 'MIRROR_KING', 'MIRROR_ACE', 'MYSTERY_KNIGHT', 'CLASSIC_MINI');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('WAITING', 'IN_PROGRESS', 'COMPLETED', 'FINALIZED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ResultStatus" AS ENUM ('UNSUBMITTED', 'PENDING', 'VERIFIED', 'REJECTED', 'DISPUTED', 'INVALIDATED');

-- CreateEnum
CREATE TYPE "ResultReliability" AS ENUM ('VERIFIED', 'PARTIAL', 'UNVERIFIED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "StreamPlatform" AS ENUM ('YOUTUBE', 'TWITCH');

-- CreateEnum
CREATE TYPE "BanSeverity" AS ENUM ('WARNING', 'TEMP_BAN', 'PERM_BAN');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('PENDING', 'INVESTIGATING', 'ACCEPTED', 'REJECTED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ScreenshotType" AS ENUM ('INDIVIDUAL', 'INDIVIDUAL_1', 'INDIVIDUAL_2', 'FINAL_SCORE', 'FINAL_SCORE_1', 'FINAL_SCORE_2');

-- CreateEnum
CREATE TYPE "PenaltyType" AS ENUM ('FALSE_REPORT', 'NO_SUBMISSION', 'LATE_SUBMISSION');

-- CreateTable
CREATE TABLE "tracks" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "league" "League" NOT NULL,
    "bannerPath" TEXT NOT NULL,
    "mirrorOfId" INTEGER,

    CONSTRAINT "tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "discordId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" VARCHAR(10),
    "displayNameLastChangedAt" TIMESTAMP(3),
    "avatarHash" TEXT,
    "email" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'PLAYER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "suspendedUntil" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "isFake" BOOLEAN NOT NULL DEFAULT false,
    "youtubeUrl" TEXT,
    "twitchUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    "penaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "trustScore" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "country" VARCHAR(2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_season_stats" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "internalRating" DOUBLE PRECISION NOT NULL DEFAULT 2750,
    "displayRating" INTEGER NOT NULL DEFAULT 0,
    "convergencePoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "seasonHighRating" INTEGER NOT NULL DEFAULT 0,
    "totalMatches" INTEGER NOT NULL DEFAULT 0,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "totalPositions" INTEGER NOT NULL DEFAULT 0,
    "firstPlaces" INTEGER NOT NULL DEFAULT 0,
    "secondPlaces" INTEGER NOT NULL DEFAULT 0,
    "thirdPlaces" INTEGER NOT NULL DEFAULT 0,
    "survivedCount" INTEGER NOT NULL DEFAULT 0,
    "assistUsedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_season_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rating_histories" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "matchId" INTEGER NOT NULL,
    "internalRating" DOUBLE PRECISION NOT NULL,
    "displayRating" INTEGER NOT NULL,
    "convergencePoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rating_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_login_history" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "ipVersion" TEXT,
    "userAgent" TEXT,
    "country" TEXT,
    "city" TEXT,
    "timezone" TEXT,
    "isVpn" BOOLEAN NOT NULL DEFAULT false,
    "isProxy" BOOLEAN NOT NULL DEFAULT false,
    "isTor" BOOLEAN NOT NULL DEFAULT false,
    "loginMethod" TEXT NOT NULL DEFAULT 'discord',
    "deviceType" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "loginAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_login_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" SERIAL NOT NULL,
    "category" "EventCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_configs" (
    "id" SERIAL NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "totalRounds" INTEGER NOT NULL,
    "leagues" JSONB NOT NULL,
    "minPlayers" INTEGER NOT NULL DEFAULT 40,
    "maxPlayers" INTEGER NOT NULL DEFAULT 99,
    "registrationStart" TIMESTAMP(3) NOT NULL,
    "registrationEnd" TIMESTAMP(3) NOT NULL,
    "intervalMinutes" INTEGER NOT NULL DEFAULT 10,
    "editWindowMinutes" INTEGER NOT NULL DEFAULT 10,
    "disputeDays" INTEGER NOT NULL DEFAULT 7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournament_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" SERIAL NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "matchNumber" INTEGER NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'WAITING',
    "minPlayers" INTEGER NOT NULL DEFAULT 4,
    "maxPlayers" INTEGER NOT NULL DEFAULT 20,
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "actualStart" TIMESTAMP(3),
    "deadline" TIMESTAMP(3) NOT NULL,
    "createdBy" INTEGER,
    "notes" TEXT,
    "minMmr" INTEGER,
    "maxMmr" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_participants" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hasWithdrawn" BOOLEAN NOT NULL DEFAULT false,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "finalRank" INTEGER,
    "lastUpdatedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),

    CONSTRAINT "match_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "games" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "gameNumber" INTEGER NOT NULL,
    "inGameMode" "InGameMode" NOT NULL,
    "leagueType" "League" NOT NULL,
    "passcode" VARCHAR(4) NOT NULL,
    "passcodePublishedAt" TIMESTAMP(3),
    "passcodeVersion" INTEGER NOT NULL DEFAULT 1,
    "discordChannelId" VARCHAR(20),
    "tracks" JSONB,
    "resultReliability" "ResultReliability" NOT NULL DEFAULT 'UNVERIFIED',
    "reliabilityReason" TEXT,
    "hasFirstPlaceScreenshot" BOOLEAN NOT NULL DEFAULT false,
    "hasStreamEvidence" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" INTEGER,
    "startedAt" TIMESTAMP(3),

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_participants" (
    "id" SERIAL NOT NULL,
    "gameId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "machine" TEXT NOT NULL,
    "assistEnabled" BOOLEAN NOT NULL DEFAULT false,
    "status" "ResultStatus" NOT NULL DEFAULT 'UNSUBMITTED',
    "submittedAt" TIMESTAMP(3),
    "totalScore" INTEGER,
    "eliminatedAtRace" INTEGER,
    "verifiedBy" INTEGER,
    "verifiedAt" TIMESTAMP(3),
    "rejectedBy" INTEGER,
    "rejectedAt" TIMESTAMP(3),
    "screenshotRequested" BOOLEAN NOT NULL DEFAULT false,
    "screenshotRequestedBy" INTEGER,
    "screenshotRequestedAt" TIMESTAMP(3),

    CONSTRAINT "game_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "race_results" (
    "id" SERIAL NOT NULL,
    "gameParticipantId" INTEGER NOT NULL,
    "raceNumber" INTEGER NOT NULL,
    "position" INTEGER,
    "points" INTEGER,
    "isEliminated" BOOLEAN NOT NULL DEFAULT false,
    "isDisconnected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "race_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_streams" (
    "id" SERIAL NOT NULL,
    "matchParticipantId" INTEGER NOT NULL,
    "platform" "StreamPlatform" NOT NULL,
    "streamUrl" TEXT NOT NULL,
    "isLive" BOOLEAN NOT NULL DEFAULT false,
    "thumbnailUrl" TEXT,
    "viewerCount" INTEGER,
    "streamTitle" TEXT,
    "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_streams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "split_votes" (
    "id" SERIAL NOT NULL,
    "gameId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "passcodeVersion" INTEGER NOT NULL,
    "votedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "split_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_screenshot_submissions" (
    "id" SERIAL NOT NULL,
    "gameId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "type" "ScreenshotType" NOT NULL DEFAULT 'INDIVIDUAL',
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedBy" INTEGER,
    "verifiedAt" TIMESTAMP(3),
    "isRejected" BOOLEAN NOT NULL DEFAULT false,
    "rejectedBy" INTEGER,
    "rejectedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_screenshot_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "result_screenshots" (
    "id" SERIAL NOT NULL,
    "gameId" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "selectedBy" INTEGER NOT NULL,
    "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "result_screenshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "result_disputes" (
    "id" SERIAL NOT NULL,
    "gameId" INTEGER NOT NULL,
    "reporterId" INTEGER NOT NULL,
    "targetUserId" INTEGER NOT NULL,
    "claimedPoints" INTEGER NOT NULL,
    "evidenceUrl" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'PENDING',
    "resolution" TEXT,
    "resolvedBy" INTEGER,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "result_disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ban_records" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "severity" "BanSeverity" NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "evidence" JSONB,
    "moderatorId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "targetBanId" INTEGER,

    CONSTRAINT "ban_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "penalty_records" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "gameId" INTEGER,
    "disputeId" INTEGER,
    "type" "PenaltyType" NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "penalty_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discord_bot_config" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discord_bot_config_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_discordId_key" ON "users"("discordId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_discordId_idx" ON "users"("discordId");

-- CreateIndex
CREATE INDEX "users_displayName_idx" ON "users"("displayName");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_userId_key" ON "profiles"("userId");

-- CreateIndex
CREATE INDEX "user_season_stats_seasonId_displayRating_idx" ON "user_season_stats"("seasonId", "displayRating");

-- CreateIndex
CREATE INDEX "user_season_stats_userId_idx" ON "user_season_stats"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_season_stats_userId_seasonId_key" ON "user_season_stats"("userId", "seasonId");

-- CreateIndex
CREATE INDEX "rating_histories_userId_createdAt_idx" ON "rating_histories"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "rating_histories_matchId_idx" ON "rating_histories"("matchId");

-- CreateIndex
CREATE INDEX "user_login_history_userId_ipAddress_idx" ON "user_login_history"("userId", "ipAddress");

-- CreateIndex
CREATE INDEX "user_login_history_ipAddress_idx" ON "user_login_history"("ipAddress");

-- CreateIndex
CREATE INDEX "user_login_history_loginAt_idx" ON "user_login_history"("loginAt");

-- CreateIndex
CREATE UNIQUE INDEX "events_category_key" ON "events"("category");

-- CreateIndex
CREATE INDEX "seasons_eventId_idx" ON "seasons"("eventId");

-- CreateIndex
CREATE INDEX "seasons_isActive_idx" ON "seasons"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_eventId_seasonNumber_key" ON "seasons"("eventId", "seasonNumber");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_configs_seasonId_key" ON "tournament_configs"("seasonId");

-- CreateIndex
CREATE INDEX "matches_status_idx" ON "matches"("status");

-- CreateIndex
CREATE INDEX "matches_seasonId_idx" ON "matches"("seasonId");

-- CreateIndex
CREATE INDEX "matches_scheduledStart_idx" ON "matches"("scheduledStart");

-- CreateIndex
CREATE UNIQUE INDEX "matches_seasonId_matchNumber_key" ON "matches"("seasonId", "matchNumber");

-- CreateIndex
CREATE INDEX "match_participants_matchId_idx" ON "match_participants"("matchId");

-- CreateIndex
CREATE INDEX "match_participants_userId_idx" ON "match_participants"("userId");

-- CreateIndex
CREATE INDEX "match_participants_matchId_totalPoints_idx" ON "match_participants"("matchId", "totalPoints");

-- CreateIndex
CREATE INDEX "match_participants_matchId_hasWithdrawn_idx" ON "match_participants"("matchId", "hasWithdrawn");

-- CreateIndex
CREATE UNIQUE INDEX "match_participants_matchId_userId_key" ON "match_participants"("matchId", "userId");

-- CreateIndex
CREATE INDEX "games_inGameMode_idx" ON "games"("inGameMode");

-- CreateIndex
CREATE INDEX "games_passcode_idx" ON "games"("passcode");

-- CreateIndex
CREATE INDEX "games_matchId_idx" ON "games"("matchId");

-- CreateIndex
CREATE INDEX "games_startedAt_idx" ON "games"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "games_matchId_gameNumber_key" ON "games"("matchId", "gameNumber");

-- CreateIndex
CREATE INDEX "game_participants_gameId_idx" ON "game_participants"("gameId");

-- CreateIndex
CREATE INDEX "game_participants_userId_idx" ON "game_participants"("userId");

-- CreateIndex
CREATE INDEX "game_participants_status_idx" ON "game_participants"("status");

-- CreateIndex
CREATE UNIQUE INDEX "game_participants_gameId_userId_key" ON "game_participants"("gameId", "userId");

-- CreateIndex
CREATE INDEX "race_results_gameParticipantId_idx" ON "race_results"("gameParticipantId");

-- CreateIndex
CREATE UNIQUE INDEX "race_results_gameParticipantId_raceNumber_key" ON "race_results"("gameParticipantId", "raceNumber");

-- CreateIndex
CREATE INDEX "match_streams_matchParticipantId_idx" ON "match_streams"("matchParticipantId");

-- CreateIndex
CREATE INDEX "match_streams_lastCheckedAt_idx" ON "match_streams"("lastCheckedAt");

-- CreateIndex
CREATE UNIQUE INDEX "match_streams_matchParticipantId_platform_key" ON "match_streams"("matchParticipantId", "platform");

-- CreateIndex
CREATE INDEX "split_votes_gameId_passcodeVersion_idx" ON "split_votes"("gameId", "passcodeVersion");

-- CreateIndex
CREATE UNIQUE INDEX "split_votes_gameId_userId_passcodeVersion_key" ON "split_votes"("gameId", "userId", "passcodeVersion");

-- CreateIndex
CREATE INDEX "game_screenshot_submissions_gameId_uploadedAt_idx" ON "game_screenshot_submissions"("gameId", "uploadedAt");

-- CreateIndex
CREATE INDEX "game_screenshot_submissions_gameId_type_idx" ON "game_screenshot_submissions"("gameId", "type");

-- CreateIndex
CREATE INDEX "game_screenshot_submissions_gameId_userId_type_idx" ON "game_screenshot_submissions"("gameId", "userId", "type");

-- CreateIndex
CREATE INDEX "game_screenshot_submissions_isSelected_uploadedAt_idx" ON "game_screenshot_submissions"("isSelected", "uploadedAt");

-- CreateIndex
CREATE INDEX "game_screenshot_submissions_type_isVerified_deletedAt_idx" ON "game_screenshot_submissions"("type", "isVerified", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "result_screenshots_gameId_key" ON "result_screenshots"("gameId");

-- CreateIndex
CREATE INDEX "result_disputes_gameId_idx" ON "result_disputes"("gameId");

-- CreateIndex
CREATE INDEX "result_disputes_status_idx" ON "result_disputes"("status");

-- CreateIndex
CREATE INDEX "result_disputes_createdAt_idx" ON "result_disputes"("createdAt");

-- CreateIndex
CREATE INDEX "ban_records_userId_createdAt_idx" ON "ban_records"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ban_records_moderatorId_idx" ON "ban_records"("moderatorId");

-- CreateIndex
CREATE INDEX "ban_records_expiresAt_idx" ON "ban_records"("expiresAt");

-- CreateIndex
CREATE INDEX "penalty_records_userId_idx" ON "penalty_records"("userId");

-- CreateIndex
CREATE INDEX "penalty_records_createdAt_idx" ON "penalty_records"("createdAt");

-- CreateIndex
CREATE INDEX "push_subscriptions_userId_idx" ON "push_subscriptions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_userId_endpoint_key" ON "push_subscriptions"("userId", "endpoint");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_season_stats" ADD CONSTRAINT "user_season_stats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_season_stats" ADD CONSTRAINT "user_season_stats_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rating_histories" ADD CONSTRAINT "rating_histories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rating_histories" ADD CONSTRAINT "rating_histories_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_login_history" ADD CONSTRAINT "user_login_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_configs" ADD CONSTRAINT "tournament_configs_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_participants" ADD CONSTRAINT "game_participants_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_participants" ADD CONSTRAINT "game_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "race_results" ADD CONSTRAINT "race_results_gameParticipantId_fkey" FOREIGN KEY ("gameParticipantId") REFERENCES "game_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_streams" ADD CONSTRAINT "match_streams_matchParticipantId_fkey" FOREIGN KEY ("matchParticipantId") REFERENCES "match_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "split_votes" ADD CONSTRAINT "split_votes_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "split_votes" ADD CONSTRAINT "split_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_screenshot_submissions" ADD CONSTRAINT "game_screenshot_submissions_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_screenshot_submissions" ADD CONSTRAINT "game_screenshot_submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_screenshots" ADD CONSTRAINT "result_screenshots_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_screenshots" ADD CONSTRAINT "result_screenshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_screenshots" ADD CONSTRAINT "result_screenshots_selectedBy_fkey" FOREIGN KEY ("selectedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_disputes" ADD CONSTRAINT "result_disputes_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_disputes" ADD CONSTRAINT "result_disputes_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_disputes" ADD CONSTRAINT "result_disputes_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ban_records" ADD CONSTRAINT "ban_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ban_records" ADD CONSTRAINT "ban_records_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalty_records" ADD CONSTRAINT "penalty_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

