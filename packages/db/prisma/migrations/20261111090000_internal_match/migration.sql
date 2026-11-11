-- AlterTable
ALTER TABLE "attendance" ADD COLUMN     "share" INTEGER;

-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "sides" JSONB,
ADD COLUMN     "splitItems" JSONB;

