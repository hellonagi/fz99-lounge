-- CreateEnum
CREATE TYPE "TournamentDivision" AS ENUM ('GP', 'CLASSIC');

-- CreateEnum
CREATE TYPE "TournamentMode" AS ENUM ('OFFLINE', 'ONLINE');

-- DropIndex
DROP INDEX "tournament_registrations_userId_tournamentConfigId_key";

-- AlterTable
ALTER TABLE "tournament_registrations"
  ADD COLUMN "division" "TournamentDivision" NOT NULL DEFAULT 'GP',
  ADD COLUMN "mode" "TournamentMode";

-- CreateIndex
CREATE UNIQUE INDEX "tournament_registrations_userId_tournamentConfigId_division_key" ON "tournament_registrations"("userId", "tournamentConfigId", "division");
