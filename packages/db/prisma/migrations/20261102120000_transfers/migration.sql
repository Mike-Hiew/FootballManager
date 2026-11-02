-- AlterTable
ALTER TABLE "players" ADD COLUMN     "listedAt" TIMESTAMPTZ,
ADD COLUMN     "marketValue" INTEGER,
ADD COLUMN     "marketValueAt" TIMESTAMPTZ,
ADD COLUMN     "valueLocked" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "market_value_logs" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "setById" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_value_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_offers" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "sellerTeamId" TEXT NOT NULL,
    "buyerTeamId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "counter" INTEGER,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "createdById" TEXT NOT NULL,
    "decidedById" TEXT,
    "newPlayerId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "completedAt" TIMESTAMPTZ,

    CONSTRAINT "transfer_offers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "market_value_logs_playerId_createdAt_idx" ON "market_value_logs"("playerId", "createdAt");

-- CreateIndex
CREATE INDEX "transfer_offers_sellerTeamId_status_idx" ON "transfer_offers"("sellerTeamId", "status");

-- CreateIndex
CREATE INDEX "transfer_offers_buyerTeamId_status_idx" ON "transfer_offers"("buyerTeamId", "status");

-- CreateIndex
CREATE INDEX "transfer_offers_playerId_status_idx" ON "transfer_offers"("playerId", "status");

-- CreateIndex
CREATE INDEX "transfer_offers_status_completedAt_idx" ON "transfer_offers"("status", "completedAt");

-- AddForeignKey
ALTER TABLE "market_value_logs" ADD CONSTRAINT "market_value_logs_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_offers" ADD CONSTRAINT "transfer_offers_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_offers" ADD CONSTRAINT "transfer_offers_sellerTeamId_fkey" FOREIGN KEY ("sellerTeamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_offers" ADD CONSTRAINT "transfer_offers_buyerTeamId_fkey" FOREIGN KEY ("buyerTeamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Mỗi đội mua chỉ có một đề nghị đang mở cho một cầu thủ
CREATE UNIQUE INDEX "transfer_offers_open_uq" ON "transfer_offers"("playerId", "buyerTeamId") WHERE "status" IN ('pending', 'countered', 'agreed');
