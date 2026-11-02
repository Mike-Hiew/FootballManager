-- Giá trị chuyển nhượng mặc định 1M (10 đơn vị 0,1M); người chưa định giá nhận 1M
ALTER TABLE "players" ALTER COLUMN "marketValue" SET DEFAULT 10;
UPDATE "players" SET "marketValue" = 10 WHERE "marketValue" IS NULL;
