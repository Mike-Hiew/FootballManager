-- Đá nội bộ: khoản chi thêm (nước, lôi…) ghi sổ với source 'extra'
ALTER TABLE "fund_entries" DROP CONSTRAINT "fund_entries_source_check";
ALTER TABLE "fund_entries" ADD CONSTRAINT "fund_entries_source_check" CHECK ("source" IN ('dues', 'pitch', 'le', 'manual', 'extra'));
