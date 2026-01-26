-- AlterTable
ALTER TABLE "matches" ALTER COLUMN "matchNumber" DROP NOT NULL;

-- Update existing CANCELLED matches to have null matchNumber
UPDATE "matches" SET "matchNumber" = NULL WHERE status = 'CANCELLED';
