-- AlterEnum
ALTER TYPE "EventCategory" ADD VALUE 'TEAM_CLASSIC';

-- AlterTable
ALTER TABLE "game_participants" ADD COLUMN     "isExcluded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "teamIndex" INTEGER;

-- AlterTable
ALTER TABLE "games" ADD COLUMN     "passcodeRevealTime" TIMESTAMP(3),
ADD COLUMN     "teamConfig" TEXT,
ADD COLUMN     "teamScores" JSONB;

-- CreateIndex
CREATE INDEX "game_participants_gameId_teamIndex_idx" ON "game_participants"("gameId", "teamIndex");
