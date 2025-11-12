-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PLAYER', 'MODERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'WARNED', 'TEMP_BANNED', 'PERM_BANNED', 'DELETED');

-- CreateEnum
CREATE TYPE "GameMode" AS ENUM ('MODE_99', 'CLASSIC', 'TOURNAMENT');

-- CreateEnum
CREATE TYPE "League" AS ENUM ('KNIGHT', 'QUEEN', 'KING', 'ACE', 'MIRROR_KNIGHT', 'MIRROR_QUEEN', 'MIRROR_KING', 'MIRROR_ACE', 'CLASSIC_MINI');

-- CreateEnum
CREATE TYPE "LobbyStatus" AS ENUM ('WAITING', 'READY', 'FULL', 'STARTING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('ONGOING', 'RESULTS_PENDING', 'PROVISIONALLY_CONFIRMED', 'COMPLETED', 'ABORTED');

-- CreateEnum
CREATE TYPE "ResultStatus" AS ENUM ('PENDING', 'SUBMITTED', 'PROVISIONAL', 'DISPUTED', 'FINALIZED');

-- CreateEnum
CREATE TYPE "StreamPlatform" AS ENUM ('YOUTUBE', 'TWITCH');

-- CreateEnum
CREATE TYPE "BanAction" AS ENUM ('BAN', 'UNBAN', 'WARNING', 'MUTE');

-- CreateEnum
CREATE TYPE "BanSeverity" AS ENUM ('WARNING', 'TEMP_BAN', 'PERM_BAN');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('PENDING', 'INVESTIGATING', 'ACCEPTED', 'REJECTED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('UPCOMING', 'REGISTRATION_OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RoundStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" VARCHAR(10) NOT NULL,
    "avatarUrl" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'PLAYER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "youtubeUrl" TEXT,
    "twitchUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    "penaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "suspendedUntil" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_stats_99" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mmr" INTEGER NOT NULL DEFAULT 1500,
    "seasonHighMmr" INTEGER NOT NULL DEFAULT 1500,
    "totalMatches" INTEGER NOT NULL DEFAULT 0,
    "totalWins" INTEGER NOT NULL DEFAULT 0,
    "top3Finishes" INTEGER NOT NULL DEFAULT 0,
    "top10Finishes" INTEGER NOT NULL DEFAULT 0,
    "top30Finishes" INTEGER NOT NULL DEFAULT 0,
    "averagePosition" DOUBLE PRECISION NOT NULL DEFAULT 50.0,
    "totalKos" INTEGER NOT NULL DEFAULT 0,
    "totalEliminated" INTEGER NOT NULL DEFAULT 0,
    "bestPosition" INTEGER NOT NULL DEFAULT 99,
    "bestLapTime" DOUBLE PRECISION,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "favoriteMachine" TEXT,
    "favoriteTrack" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_stats_99_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_stats_classic" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 1500,
    "seasonHighRating" INTEGER NOT NULL DEFAULT 1500,
    "totalMatches" INTEGER NOT NULL DEFAULT 0,
    "totalWins" INTEGER NOT NULL DEFAULT 0,
    "top3Finishes" INTEGER NOT NULL DEFAULT 0,
    "averagePosition" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    "bestPosition" INTEGER NOT NULL DEFAULT 20,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "favoriteMachine" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_stats_classic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" TEXT NOT NULL,
    "gameMode" "GameMode" NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lobbies" (
    "id" TEXT NOT NULL,
    "gameMode" "GameMode" NOT NULL,
    "leagueType" "League",
    "seasonId" TEXT,
    "gameNumber" INTEGER,
    "tournamentId" TEXT,
    "roundNumber" INTEGER,
    "status" "LobbyStatus" NOT NULL DEFAULT 'WAITING',
    "currentPlayers" INTEGER NOT NULL DEFAULT 0,
    "minPlayers" INTEGER NOT NULL DEFAULT 40,
    "maxPlayers" INTEGER NOT NULL DEFAULT 99,
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "countdownStart" TIMESTAMP(3),
    "actualStart" TIMESTAMP(3),
    "createdBy" TEXT,
    "notes" TEXT,
    "minMmr" INTEGER,
    "maxMmr" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lobbies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lobby_queues" (
    "id" TEXT NOT NULL,
    "lobbyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lobby_queues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "lobbyId" TEXT NOT NULL,
    "gameMode" "GameMode" NOT NULL,
    "leagueType" "League" NOT NULL,
    "passcode" VARCHAR(4) NOT NULL,
    "passcodePublishedAt" TIMESTAMP(3),
    "passcodeVersion" INTEGER NOT NULL DEFAULT 1,
    "status" "MatchStatus" NOT NULL DEFAULT 'ONGOING',
    "totalPlayers" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "firstResultSubmittedAt" TIMESTAMP(3),
    "disputeDeadline" TIMESTAMP(3),
    "provisionalConfirmedAt" TIMESTAMP(3),
    "finalConfirmedAt" TIMESTAMP(3),

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_participants" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "machine" TEXT NOT NULL,
    "reportedPosition" INTEGER,
    "provisionalPosition" INTEGER,
    "finalPosition" INTEGER,
    "pointsEarned" INTEGER NOT NULL DEFAULT 0,
    "ratingChange" INTEGER NOT NULL DEFAULT 0,
    "status" "ResultStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3),
    "canEditUntil" TIMESTAMP(3),
    "editCount" INTEGER NOT NULL DEFAULT 0,
    "editHistory" JSONB,
    "provisionalConfirmedAt" TIMESTAMP(3),
    "finalConfirmedAt" TIMESTAMP(3),

    CONSTRAINT "match_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_streams" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
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
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "votedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "split_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "result_screenshots" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "result_screenshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "result_disputes" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "claimedPosition" INTEGER NOT NULL,
    "disputedPosition" INTEGER NOT NULL,
    "evidenceUrl" TEXT,
    "reason" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'PENDING',
    "resolution" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "result_disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournaments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "totalRounds" INTEGER NOT NULL,
    "leagues" JSONB NOT NULL,
    "minPlayers" INTEGER NOT NULL,
    "maxPlayers" INTEGER NOT NULL,
    "status" "TournamentStatus" NOT NULL DEFAULT 'UPCOMING',
    "registrationStart" TIMESTAMP(3) NOT NULL,
    "registrationEnd" TIMESTAMP(3) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "intervalMinutes" INTEGER NOT NULL DEFAULT 10,
    "editWindowMinutes" INTEGER NOT NULL DEFAULT 10,
    "disputeDays" INTEGER NOT NULL DEFAULT 7,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_rounds" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "leagueType" "League" NOT NULL,
    "lobbyId" TEXT,
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "actualStart" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "submissionDeadline" TIMESTAMP(3),
    "status" "RoundStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "tournament_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_participants" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "finalRank" INTEGER,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_round_scores" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "position" INTEGER,
    "machine" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "canEditUntil" TIMESTAMP(3),
    "editCount" INTEGER NOT NULL DEFAULT 0,
    "editHistory" JSONB,
    "status" "ResultStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "tournament_round_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_absences" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "penaltyPoints" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_absences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ban_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "BanAction" NOT NULL,
    "severity" "BanSeverity" NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "evidence" JSONB,
    "moderatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "targetBanId" TEXT,

    CONSTRAINT "ban_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "no_submission_penalties" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "penaltyPoints" INTEGER NOT NULL DEFAULT 1,
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "suspendedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "no_submission_penalties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lobby_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slots" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lobby_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_discordId_key" ON "users"("discordId");

-- CreateIndex
CREATE INDEX "users_discordId_idx" ON "users"("discordId");

-- CreateIndex
CREATE INDEX "users_displayName_idx" ON "users"("displayName");

-- CreateIndex
CREATE UNIQUE INDEX "user_stats_99_userId_key" ON "user_stats_99"("userId");

-- CreateIndex
CREATE INDEX "user_stats_99_mmr_idx" ON "user_stats_99"("mmr");

-- CreateIndex
CREATE UNIQUE INDEX "user_stats_classic_userId_key" ON "user_stats_classic"("userId");

-- CreateIndex
CREATE INDEX "user_stats_classic_rating_idx" ON "user_stats_classic"("rating");

-- CreateIndex
CREATE INDEX "seasons_gameMode_isActive_idx" ON "seasons"("gameMode", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_gameMode_seasonNumber_key" ON "seasons"("gameMode", "seasonNumber");

-- CreateIndex
CREATE INDEX "lobbies_gameMode_status_idx" ON "lobbies"("gameMode", "status");

-- CreateIndex
CREATE INDEX "lobbies_seasonId_idx" ON "lobbies"("seasonId");

-- CreateIndex
CREATE INDEX "lobbies_tournamentId_roundNumber_idx" ON "lobbies"("tournamentId", "roundNumber");

-- CreateIndex
CREATE INDEX "lobbies_scheduledStart_idx" ON "lobbies"("scheduledStart");

-- CreateIndex
CREATE INDEX "lobby_queues_lobbyId_idx" ON "lobby_queues"("lobbyId");

-- CreateIndex
CREATE INDEX "lobby_queues_userId_idx" ON "lobby_queues"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "lobby_queues_lobbyId_userId_key" ON "lobby_queues"("lobbyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "matches_lobbyId_key" ON "matches"("lobbyId");

-- CreateIndex
CREATE INDEX "matches_gameMode_idx" ON "matches"("gameMode");

-- CreateIndex
CREATE INDEX "matches_passcode_idx" ON "matches"("passcode");

-- CreateIndex
CREATE INDEX "matches_status_idx" ON "matches"("status");

-- CreateIndex
CREATE INDEX "matches_disputeDeadline_idx" ON "matches"("disputeDeadline");

-- CreateIndex
CREATE INDEX "match_participants_matchId_idx" ON "match_participants"("matchId");

-- CreateIndex
CREATE INDEX "match_participants_userId_idx" ON "match_participants"("userId");

-- CreateIndex
CREATE INDEX "match_participants_status_idx" ON "match_participants"("status");

-- CreateIndex
CREATE INDEX "match_participants_finalPosition_idx" ON "match_participants"("finalPosition");

-- CreateIndex
CREATE UNIQUE INDEX "match_participants_matchId_userId_key" ON "match_participants"("matchId", "userId");

-- CreateIndex
CREATE INDEX "match_streams_matchId_isLive_idx" ON "match_streams"("matchId", "isLive");

-- CreateIndex
CREATE INDEX "match_streams_lastCheckedAt_idx" ON "match_streams"("lastCheckedAt");

-- CreateIndex
CREATE UNIQUE INDEX "match_streams_matchId_userId_platform_key" ON "match_streams"("matchId", "userId", "platform");

-- CreateIndex
CREATE INDEX "split_votes_matchId_idx" ON "split_votes"("matchId");

-- CreateIndex
CREATE INDEX "split_votes_votedAt_idx" ON "split_votes"("votedAt");

-- CreateIndex
CREATE UNIQUE INDEX "split_votes_matchId_userId_key" ON "split_votes"("matchId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "result_screenshots_matchId_key" ON "result_screenshots"("matchId");

-- CreateIndex
CREATE INDEX "result_disputes_matchId_idx" ON "result_disputes"("matchId");

-- CreateIndex
CREATE INDEX "result_disputes_status_idx" ON "result_disputes"("status");

-- CreateIndex
CREATE INDEX "result_disputes_createdAt_idx" ON "result_disputes"("createdAt");

-- CreateIndex
CREATE INDEX "tournaments_status_idx" ON "tournaments"("status");

-- CreateIndex
CREATE INDEX "tournaments_registrationStart_registrationEnd_idx" ON "tournaments"("registrationStart", "registrationEnd");

-- CreateIndex
CREATE INDEX "tournament_rounds_tournamentId_idx" ON "tournament_rounds"("tournamentId");

-- CreateIndex
CREATE INDEX "tournament_rounds_status_idx" ON "tournament_rounds"("status");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_rounds_tournamentId_roundNumber_key" ON "tournament_rounds"("tournamentId", "roundNumber");

-- CreateIndex
CREATE INDEX "tournament_participants_tournamentId_totalPoints_idx" ON "tournament_participants"("tournamentId", "totalPoints");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_participants_tournamentId_userId_key" ON "tournament_participants"("tournamentId", "userId");

-- CreateIndex
CREATE INDEX "tournament_round_scores_tournamentId_userId_idx" ON "tournament_round_scores"("tournamentId", "userId");

-- CreateIndex
CREATE INDEX "tournament_round_scores_status_idx" ON "tournament_round_scores"("status");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_round_scores_tournamentId_roundNumber_userId_key" ON "tournament_round_scores"("tournamentId", "roundNumber", "userId");

-- CreateIndex
CREATE INDEX "tournament_absences_userId_idx" ON "tournament_absences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_absences_tournamentId_userId_roundNumber_key" ON "tournament_absences"("tournamentId", "userId", "roundNumber");

-- CreateIndex
CREATE INDEX "ban_records_userId_createdAt_idx" ON "ban_records"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ban_records_moderatorId_idx" ON "ban_records"("moderatorId");

-- CreateIndex
CREATE INDEX "ban_records_expiresAt_idx" ON "ban_records"("expiresAt");

-- CreateIndex
CREATE INDEX "moderation_logs_userId_idx" ON "moderation_logs"("userId");

-- CreateIndex
CREATE INDEX "moderation_logs_action_idx" ON "moderation_logs"("action");

-- CreateIndex
CREATE INDEX "moderation_logs_createdAt_idx" ON "moderation_logs"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "no_submission_penalties_userId_idx" ON "no_submission_penalties"("userId");

-- CreateIndex
CREATE INDEX "no_submission_penalties_suspendedUntil_idx" ON "no_submission_penalties"("suspendedUntil");

-- AddForeignKey
ALTER TABLE "user_stats_99" ADD CONSTRAINT "user_stats_99_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_stats_classic" ADD CONSTRAINT "user_stats_classic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lobbies" ADD CONSTRAINT "lobbies_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lobbies" ADD CONSTRAINT "lobbies_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lobbies" ADD CONSTRAINT "lobbies_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lobby_queues" ADD CONSTRAINT "lobby_queues_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "lobbies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lobby_queues" ADD CONSTRAINT "lobby_queues_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "lobbies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_streams" ADD CONSTRAINT "match_streams_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_streams" ADD CONSTRAINT "match_streams_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "split_votes" ADD CONSTRAINT "split_votes_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "split_votes" ADD CONSTRAINT "split_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_screenshots" ADD CONSTRAINT "result_screenshots_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_disputes" ADD CONSTRAINT "result_disputes_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_rounds" ADD CONSTRAINT "tournament_rounds_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_participants" ADD CONSTRAINT "tournament_participants_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_participants" ADD CONSTRAINT "tournament_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_round_scores" ADD CONSTRAINT "tournament_round_scores_tournamentId_roundNumber_fkey" FOREIGN KEY ("tournamentId", "roundNumber") REFERENCES "tournament_rounds"("tournamentId", "roundNumber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_round_scores" ADD CONSTRAINT "tournament_round_scores_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_absences" ADD CONSTRAINT "tournament_absences_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_absences" ADD CONSTRAINT "tournament_absences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ban_records" ADD CONSTRAINT "ban_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ban_records" ADD CONSTRAINT "ban_records_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_logs" ADD CONSTRAINT "moderation_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_logs" ADD CONSTRAINT "moderation_logs_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "no_submission_penalties" ADD CONSTRAINT "no_submission_penalties_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
