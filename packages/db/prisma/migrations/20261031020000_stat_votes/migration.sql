-- AlterTable
ALTER TABLE "profile_edits" ADD COLUMN     "origin" TEXT NOT NULL DEFAULT 'self',
ADD COLUMN     "remindedAt" TIMESTAMPTZ;
-- CreateTable
CREATE TABLE "stat_votes" (
    "editId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "stats" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "stat_votes_pkey" PRIMARY KEY ("editId","playerId")
);
-- CreateIndex
CREATE INDEX "stat_votes_playerId_idx" ON "stat_votes"("playerId");
-- AddForeignKey
ALTER TABLE "stat_votes" ADD CONSTRAINT "stat_votes_editId_fkey" FOREIGN KEY ("editId") REFERENCES "profile_edits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "stat_votes" ADD CONSTRAINT "stat_votes_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
