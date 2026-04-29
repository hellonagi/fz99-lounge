-- Add SUBMITTED variant to ResultStatus enum (was added directly to DB outside migrations)
ALTER TYPE "ResultStatus" ADD VALUE IF NOT EXISTS 'SUBMITTED';

-- Fix status default on game_participants to match actual DB state
ALTER TABLE "game_participants" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"ResultStatus";
