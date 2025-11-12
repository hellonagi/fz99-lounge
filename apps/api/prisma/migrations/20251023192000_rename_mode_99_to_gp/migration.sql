-- AlterEnum: Rename MODE_99 to GP
-- We need to recreate the enum with the new value
-- Step 1: Create a temporary enum with the new values
CREATE TYPE "GameMode_new" AS ENUM ('GP', 'CLASSIC', 'TOURNAMENT');

-- Step 2: Update all existing MODE_99 values to GP using the new enum
ALTER TABLE "seasons" ALTER COLUMN "gameMode" TYPE "GameMode_new"
  USING (CASE WHEN "gameMode"::text = 'MODE_99' THEN 'GP'::"GameMode_new" ELSE "gameMode"::text::"GameMode_new" END);

ALTER TABLE "lobbies" ALTER COLUMN "gameMode" TYPE "GameMode_new"
  USING (CASE WHEN "gameMode"::text = 'MODE_99' THEN 'GP'::"GameMode_new" ELSE "gameMode"::text::"GameMode_new" END);

ALTER TABLE "matches" ALTER COLUMN "gameMode" TYPE "GameMode_new"
  USING (CASE WHEN "gameMode"::text = 'MODE_99' THEN 'GP'::"GameMode_new" ELSE "gameMode"::text::"GameMode_new" END);

-- Step 3: Drop the old enum and rename the new one
DROP TYPE "GameMode";
ALTER TYPE "GameMode_new" RENAME TO "GameMode";
