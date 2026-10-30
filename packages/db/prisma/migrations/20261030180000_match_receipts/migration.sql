-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "resultAt" TIMESTAMPTZ;
-- CreateTable
CREATE TABLE "match_receipts" (
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seenAt" TIMESTAMPTZ,
    "claimSkippedAt" TIMESTAMPTZ,
    CONSTRAINT "match_receipts_pkey" PRIMARY KEY ("matchId","userId")
);
-- CreateIndex
CREATE INDEX "match_receipts_userId_idx" ON "match_receipts"("userId");
-- AddForeignKey
ALTER TABLE "match_receipts" ADD CONSTRAINT "match_receipts_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "match_receipts" ADD CONSTRAINT "match_receipts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
