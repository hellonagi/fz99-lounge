-- AlterTable
ALTER TABLE "users" ADD COLUMN "profileId" SERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_profileId_key" ON "users"("profileId");

-- CreateIndex
CREATE INDEX "users_profileId_idx" ON "users"("profileId");
