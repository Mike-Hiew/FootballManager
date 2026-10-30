-- Ngưỡng "đủ người" mặc định 9 (7 ra sân + 2 dự bị) cho đội tạo mới; đội đã có giữ giá trị đang dùng.
ALTER TABLE "teams" ALTER COLUMN "fullSquad" SET DEFAULT 9;
ALTER TABLE "teams" ADD CONSTRAINT "teams_full_squad_check" CHECK ("fullSquad" BETWEEN 7 AND 30);
