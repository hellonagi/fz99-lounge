-- AlterTable
ALTER TABLE "matches" ADD COLUMN "recurringMatchId" INTEGER;

-- CreateIndex
CREATE INDEX "matches_recurringMatchId_idx" ON "matches"("recurringMatchId");

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_recurringMatchId_fkey" FOREIGN KEY ("recurringMatchId") REFERENCES "recurring_matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex (unique constraint: 1 schedule per eventCategory)
CREATE UNIQUE INDEX "recurring_matches_eventCategory_key" ON "recurring_matches"("eventCategory");
