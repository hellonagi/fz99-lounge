-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "isRated" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "recurring_matches" ALTER COLUMN "minPlayers" SET DEFAULT 4;
