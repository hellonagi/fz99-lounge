-- AlterTable: Change avatarUrl to avatarHash

-- Step 1: Add new avatarHash column
ALTER TABLE "users" ADD COLUMN "avatarHash" TEXT;

-- Step 2: Extract hash from existing avatarUrl and populate avatarHash
-- URL format: https://cdn.discordapp.com/avatars/{discordId}/{hash}.png
UPDATE "users"
SET "avatarHash" = SUBSTRING("avatarUrl" FROM '/avatars/[^/]+/([^.]+)')
WHERE "avatarUrl" IS NOT NULL;

-- Step 3: Drop the old avatarUrl column
ALTER TABLE "users" DROP COLUMN "avatarUrl";
