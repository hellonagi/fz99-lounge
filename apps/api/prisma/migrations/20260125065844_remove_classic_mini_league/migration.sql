/*
  Warnings:

  - The values [CLASSIC_MINI] on the enum `League` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "League_new" AS ENUM ('KNIGHT', 'QUEEN', 'KING', 'ACE', 'MIRROR_KNIGHT', 'MIRROR_QUEEN', 'MIRROR_KING', 'MIRROR_ACE', 'MYSTERY_KNIGHT');
ALTER TABLE "tracks" ALTER COLUMN "league" TYPE "League_new" USING ("league"::text::"League_new");
ALTER TABLE "games" ALTER COLUMN "leagueType" TYPE "League_new" USING ("leagueType"::text::"League_new");
ALTER TYPE "League" RENAME TO "League_old";
ALTER TYPE "League_new" RENAME TO "League";
DROP TYPE "public"."League_old";
COMMIT;

-- AlterTable
ALTER TABLE "games" ALTER COLUMN "leagueType" DROP NOT NULL;
