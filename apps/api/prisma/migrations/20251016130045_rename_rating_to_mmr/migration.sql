/*
  Warnings:

  - You are about to drop the column `rating` on the `user_stats_classic` table. All the data in the column will be lost.
  - You are about to drop the column `seasonHighRating` on the `user_stats_classic` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."user_stats_classic_rating_idx";

-- AlterTable
ALTER TABLE "user_stats_classic" DROP COLUMN "rating",
DROP COLUMN "seasonHighRating",
ADD COLUMN     "mmr" INTEGER NOT NULL DEFAULT 1500,
ADD COLUMN     "seasonHighMmr" INTEGER NOT NULL DEFAULT 1500;

-- CreateIndex
CREATE INDEX "user_stats_classic_mmr_idx" ON "user_stats_classic"("mmr");
