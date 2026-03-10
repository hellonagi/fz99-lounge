-- Step 1: Add column as nullable first
ALTER TABLE "users" ADD COLUMN "profileNumber" INTEGER;

-- Step 2: Assign sequential numbers to existing users ordered by id
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn
  FROM "users"
)
UPDATE "users" SET "profileNumber" = numbered.rn
FROM numbered WHERE "users".id = numbered.id;

-- Step 3: Make column NOT NULL
ALTER TABLE "users" ALTER COLUMN "profileNumber" SET NOT NULL;

-- Step 4: Add unique constraint
ALTER TABLE "users" ADD CONSTRAINT "users_profileNumber_key" UNIQUE ("profileNumber");

-- Step 5: Create index
CREATE INDEX "users_profileNumber_idx" ON "users"("profileNumber");
