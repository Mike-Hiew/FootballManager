-- AlterTable
ALTER TABLE "teams" ADD COLUMN     "honorsFrom" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "honors" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "periodKey" TEXT,
    "card" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "honors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "honor_views" (
    "honorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seenAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "honor_views_pkey" PRIMARY KEY ("honorId","userId")
);

-- CreateIndex
CREATE INDEX "honors_teamId_createdAt_idx" ON "honors"("teamId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "honors_teamId_kind_periodKey_playerId_key" ON "honors"("teamId", "kind", "periodKey", "playerId");

-- CreateIndex
CREATE INDEX "honor_views_userId_idx" ON "honor_views"("userId");

-- AddForeignKey
ALTER TABLE "honors" ADD CONSTRAINT "honors_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "honors" ADD CONSTRAINT "honors_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "honor_views" ADD CONSTRAINT "honor_views_honorId_fkey" FOREIGN KEY ("honorId") REFERENCES "honors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

