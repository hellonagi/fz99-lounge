-- CreateTable
CREATE TABLE "recurring_match_rules" (
    "id" SERIAL NOT NULL,
    "recurringMatchId" INTEGER NOT NULL,
    "daysOfWeek" INTEGER[] NOT NULL,
    "timeOfDay" TEXT NOT NULL,
    "lastScheduledAt" TIMESTAMP(3),

    CONSTRAINT "recurring_match_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recurring_match_rules_recurringMatchId_idx" ON "recurring_match_rules"("recurringMatchId");

-- AddForeignKey
ALTER TABLE "recurring_match_rules" ADD CONSTRAINT "recurring_match_rules_recurringMatchId_fkey" FOREIGN KEY ("recurringMatchId") REFERENCES "recurring_matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- MigrateData: Copy existing daysOfWeek, timeOfDay, lastScheduledAt into rules table
INSERT INTO "recurring_match_rules" ("recurringMatchId", "daysOfWeek", "timeOfDay", "lastScheduledAt")
SELECT "id", "daysOfWeek", "timeOfDay", "lastScheduledAt" FROM "recurring_matches";

-- DropColumns: Remove old columns from recurring_matches
ALTER TABLE "recurring_matches" DROP COLUMN "daysOfWeek";
ALTER TABLE "recurring_matches" DROP COLUMN "timeOfDay";
ALTER TABLE "recurring_matches" DROP COLUMN "lastScheduledAt";
