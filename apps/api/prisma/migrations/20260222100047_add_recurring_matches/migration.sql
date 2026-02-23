-- CreateTable
CREATE TABLE "recurring_matches" (
    "id" SERIAL NOT NULL,
    "eventCategory" "EventCategory" NOT NULL,
    "inGameMode" "InGameMode" NOT NULL,
    "leagueType" "League",
    "minPlayers" INTEGER NOT NULL DEFAULT 12,
    "maxPlayers" INTEGER NOT NULL DEFAULT 20,
    "daysOfWeek" INTEGER[],
    "timeOfDay" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastScheduledAt" TIMESTAMP(3),
    "name" TEXT,
    "notes" TEXT,
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recurring_matches_isEnabled_idx" ON "recurring_matches"("isEnabled");

-- AddForeignKey
ALTER TABLE "recurring_matches" ADD CONSTRAINT "recurring_matches_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
