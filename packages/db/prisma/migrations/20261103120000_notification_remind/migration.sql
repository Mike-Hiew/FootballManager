-- Lời nhắc do đội trưởng bấm → popup "Đội trưởng nhắc bạn"
ALTER TABLE "notifications" ADD COLUMN "remind" BOOLEAN NOT NULL DEFAULT false;
