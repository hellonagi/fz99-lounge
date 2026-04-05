/*
  Warnings:

  - You are about to drop the column `leagues` on the `tournament_configs` table. All the data in the column will be lost.
  - Added the required column `name` to the `tournament_configs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rounds` to the `tournament_configs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tournamentDate` to the `tournament_configs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tournamentNumber` to the `tournament_configs` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('DRAFT', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'IN_PROGRESS', 'RESULTS_PENDING', 'COMPLETED');

-- AlterTable
ALTER TABLE "tournament_configs" DROP COLUMN "leagues",
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "rounds" JSONB NOT NULL,
ADD COLUMN     "status" "TournamentStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "tournamentDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "tournamentNumber" INTEGER NOT NULL,
ALTER COLUMN "intervalMinutes" SET DEFAULT 20;

-- CreateTable
CREATE TABLE "tournament_registrations" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "tournamentConfigId" INTEGER NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tournament_registrations_tournamentConfigId_idx" ON "tournament_registrations"("tournamentConfigId");

-- CreateIndex
CREATE INDEX "tournament_registrations_userId_idx" ON "tournament_registrations"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_registrations_userId_tournamentConfigId_key" ON "tournament_registrations"("userId", "tournamentConfigId");

-- CreateIndex
CREATE INDEX "tournament_configs_status_idx" ON "tournament_configs"("status");

-- AddForeignKey
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_tournamentConfigId_fkey" FOREIGN KEY ("tournamentConfigId") REFERENCES "tournament_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
