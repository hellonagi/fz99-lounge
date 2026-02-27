-- Add missing enum values and columns that were applied via db push

-- Add TEAM_GP to EventCategory enum
ALTER TYPE "EventCategory" ADD VALUE 'TEAM_GP';

-- Add MIRROR_GRAND_PRIX to InGameMode enum
ALTER TYPE "InGameMode" ADD VALUE 'MIRROR_GRAND_PRIX';

-- Add bestPosition column to user_season_stats
ALTER TABLE "user_season_stats" ADD COLUMN "bestPosition" INTEGER;
