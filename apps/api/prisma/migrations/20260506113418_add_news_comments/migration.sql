-- CreateTable
CREATE TABLE "news_comments" (
    "id" SERIAL NOT NULL,
    "newsSlug" VARCHAR(120) NOT NULL,
    "userId" INTEGER NOT NULL,
    "parentId" INTEGER,
    "body" TEXT NOT NULL,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "news_comments_newsSlug_createdAt_idx" ON "news_comments"("newsSlug", "createdAt");

-- CreateIndex
CREATE INDEX "news_comments_userId_idx" ON "news_comments"("userId");

-- CreateIndex
CREATE INDEX "news_comments_parentId_idx" ON "news_comments"("parentId");

-- AddForeignKey
ALTER TABLE "news_comments" ADD CONSTRAINT "news_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_comments" ADD CONSTRAINT "news_comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "news_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
