/**
 * Mọi mốc thời gian nghiệp vụ theo Asia/Ho_Chi_Minh (UTC+7, không có giờ mùa hè).
 * Ngày lưu dạng chuỗi 'YYYY-MM-DD'. Mọi hàm nhận `now` để test được.
 */
export const VN_OFFSET_MS = 7 * 3600 * 1000;

const pad = (n: number) => String(n).padStart(2, '0');

/** Ngày (YYYY-MM-DD) theo giờ VN của một thời điểm. */
export function vnDate(at: Date): string {
  const d = new Date(at.getTime() + VN_OFFSET_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Giờ:phút theo giờ VN. */
export function vnTime(at: Date): string {
  const d = new Date(at.getTime() + VN_OFFSET_MS);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export const todayVN = (now: Date) => vnDate(now);
export const seasonYear = (now: Date) => Number(vnDate(now).slice(0, 4));
export const monthKey = (date: string) => date.slice(0, 7);
export const currentMonth = (now: Date) => monthKey(vnDate(now));

/** Thời điểm UTC của ngày + giờ VN. */
export function vnDateTime(date: string, time?: string | null): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time || '00:00').split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - VN_OFFSET_MS);
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}`;
}

/** 0 = CN … 6 = T7. */
export function dayOfWeek(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export const DAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const;
export const DAY_FULL = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'] as const;
/** Thứ tự hiển thị T2…CN. */
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/** "1/11" */
export function dm(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${d}/${m}`;
}

/** "T11/26" */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-');
  return `T${+m}/${y.slice(2)}`;
}

/** 4 tháng gần nhất kết thúc ở tháng hiện tại. */
export function recentMonths(now: Date, count = 4): string[] {
  const cur = currentMonth(now);
  return Array.from({ length: count }, (_, i) => addMonths(cur, i - count + 1));
}

/** Ngày đá sân nhà gần nhất trong 7 ngày tới (không tính hôm nay); không có thì +3 ngày (BRD 6.1). */
export function nextHomeDay(days: readonly number[], now: Date): string {
  const today = todayVN(now);
  for (let i = 1; i <= 7; i++) {
    const d = addDays(today, i);
    if (days.includes(dayOfWeek(d))) return d;
  }
  return addDays(today, 3);
}

export function ageOf(dob: string | null | undefined, now: Date): number | null {
  if (!dob) return null;
  const [by, bm, bd] = dob.split('-').map(Number);
  const [ty, tm, td] = todayVN(now).split('-').map(Number);
  let a = ty - by;
  if (tm < bm || (tm === bm && td < bd)) a--;
  return a;
}

/** Số năm tròn kể từ ngày thành lập. */
export function yearsSince(date: string | null | undefined, now: Date): number | null {
  return ageOf(date, now);
}
