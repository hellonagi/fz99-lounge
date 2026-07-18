-- AlterTable
ALTER TABLE "tournament_configs" ADD COLUMN     "practiceForTournamentId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "tournament_configs_practiceForTournamentId_key" ON "tournament_configs"("practiceForTournamentId");

-- AddForeignKey
ALTER TABLE "tournament_configs" ADD CONSTRAINT "tournament_configs_practiceForTournamentId_fkey" FOREIGN KEY ("practiceForTournamentId") REFERENCES "tournament_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

