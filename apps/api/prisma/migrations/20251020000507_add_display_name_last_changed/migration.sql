-- AlterTable
ALTER TABLE "users" ALTER COLUMN "displayName" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN "displayNameLastChangedAt" TIMESTAMP(3);
