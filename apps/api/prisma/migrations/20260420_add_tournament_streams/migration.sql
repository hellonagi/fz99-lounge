-- CreateTable
CREATE TABLE "tournament_streams" (
    "id" SERIAL NOT NULL,
    "tournamentConfigId" INTEGER NOT NULL,
    "platform" "StreamPlatform" NOT NULL,
    "channelIdentifier" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournament_streams_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "tournament_streams" ADD CONSTRAINT "tournament_streams_tournamentConfigId_fkey" FOREIGN KEY ("tournamentConfigId") REFERENCES "tournament_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
