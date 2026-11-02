import { z } from 'zod';
import { rankedPositions, type Position } from './positions';
import type { Stats } from './stats';

/**
 * Giá trị chuyển nhượng (BRD 12). Lưu số nguyên theo đơn vị 0,1M = 100.000đ để đủ chỗ cho 999B
 * (9.990.000 đơn vị) trong cột INT. Hiển thị bằng M (triệu) / B (tỷ), tiền tệ đồng (đ).
 */
export const MV_UNIT = 100_000;
/** 1M */
export const MV_MIN = 10;
/** 999B */
export const MV_MAX = 9_990_000;

const UNIT_MULT: Record<string, number> = { m: 10, 'tr': 10, 'triệu': 10, 'trieu': 10, b: 10_000, 'tỷ': 10_000, 'ty': 10_000, 'tỉ': 10_000, 'ti': 10_000 };

/**
 * Đọc giá người dùng gõ: "150M", "1.2B", "1,2 tỷ", "150 triệu", "150" (mặc định M).
 * Trả về số đơn vị 0,1M, hoặc null nếu không đọc được / sai bước 0,1 / ngoài khoảng 1M – 999B.
 */
export function parseValue(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, ' ').replace(/đ$|đồng$/, '').trim();
  const m = /^(\d{1,3}(?:[.,]\d{1,3})?)\s*([a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]*)$/.exec(s);
  if (!m) return null;
  const num = Number(m[1].replace(',', '.'));
  const unit = m[2] || 'm';
  const mult = UNIT_MULT[unit];
  if (!mult || !Number.isFinite(num)) return null;
  const raw = num * mult;
  const units = Math.round(raw);
  if (Math.abs(raw - units) > 1e-6) return null; // nhỏ hơn bước 0,1M
  if (units < MV_MIN || units > MV_MAX) return null;
  return units;
}

const trim1 = (n: number) => (Math.round(n * 10) / 10).toString().replace('.', ',');

/** "150M", "1,2B", "999B" (không kèm đ). B khi ≥ 1 tỷ. */
export function formatValueShort(units: number): string {
  if (units >= 10_000) {
    const b = units / 10_000;
    // giữ tối đa 2 chữ số thập phân để 1,25B không thành 1,3B
    const s = (Math.round(b * 100) / 100).toString().replace('.', ',');
    return `${s}B`;
  }
  return `${trim1(units / 10)}M`;
}

/** "150M đ" / "1,2B đ"; null → "Chưa định giá". */
export function formatValue(units: number | null | undefined): string {
  if (units == null) return 'Chưa định giá';
  return `${formatValueShort(units)} đ`;
}

/** Giá trị sang đồng (để tính %, so sánh). */
export const valueToDong = (units: number) => units * MV_UNIT;

/** % thay đổi so với giá trước (làm tròn 1 chữ số); null nếu không có giá trước. */
export function valueChange(prev: number | null | undefined, cur: number | null | undefined): number | null {
  if (!prev || cur == null) return null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

/** Tổng giá trị đội hình (chỉ người đã định giá). */
export function squadValue(values: Array<number | null | undefined>): number {
  return values.reduce<number>((a, v) => a + (v ?? 0), 0);
}

/** Chỉ số tổng (OVR 0–100) = điểm vị trí tốt nhất × 10, kèm vị trí đó. */
export function overall(stats: Partial<Stats>, foot: string): { pos: Position; ovr: number } {
  const [pos, score] = rankedPositions(stats, foot)[0];
  return { pos, ovr: Math.round(score * 10) };
}

export const marketValueSchema = z.number().int('Giá theo bước 0,1M').min(MV_MIN, 'Tối thiểu 1M').max(MV_MAX, 'Tối đa 999B');

export const offerSchema = z.object({
  amount: marketValueSchema,
  message: z.string().trim().max(120).optional().nullable(),
});

/** Trạng thái đề nghị chuyển nhượng. */
export type OfferStatus = 'pending' | 'countered' | 'agreed' | 'completed' | 'rejected' | 'withdrawn' | 'cancelled';
export const OPEN_OFFER: OfferStatus[] = ['pending', 'countered', 'agreed'];
export const OFFER_LABEL: Record<OfferStatus, string> = {
  pending: 'Chờ đội bán trả lời',
  countered: 'Đội bán trả giá',
  agreed: 'Chờ cầu thủ đồng ý',
  completed: 'Hoàn tất',
  rejected: 'Bị từ chối',
  withdrawn: 'Đã rút',
  cancelled: 'Đã huỷ',
};
