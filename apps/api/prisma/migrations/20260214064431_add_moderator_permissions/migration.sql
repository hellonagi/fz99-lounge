-- CreateEnum
CREATE TYPE "ModeratorPermission" AS ENUM ('CREATE_MATCH', 'DELETE_MATCH', 'CANCEL_MATCH', 'VERIFY_SCORE', 'REJECT_SCORE', 'EDIT_SCORE', 'VERIFY_SCREENSHOT', 'REJECT_SCREENSHOT', 'END_MATCH', 'REGENERATE_PASSCODE', 'UPDATE_TRACKS', 'VIEW_MULTI_ACCOUNTS', 'VIEW_LOGIN_HISTORY', 'RECALCULATE_RATING');

-- CreateTable
CREATE TABLE "user_permissions" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "permission" "ModeratorPermission" NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedBy" INTEGER,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_permissions_userId_idx" ON "user_permissions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_permissions_userId_permission_key" ON "user_permissions"("userId", "permission");

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
