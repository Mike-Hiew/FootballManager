/** Chuẩn hoá tên để so trùng: bỏ dấu, đ→d, chữ thường, chỉ giữ a–z0–9 (BRD 3.1). */
export function normName(t: string | null | undefined): string {
  return String(t ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

/** Bỏ dấu nhưng giữ khoảng trắng — dùng cho tìm kiếm. */
export function foldText(t: string | null | undefined): string {
  return String(t ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim();
}

/** SĐT: bỏ ký tự không phải số; đầu 84 đổi thành 0. */
export function normPhone(p: string | null | undefined): string {
  let d = String(p ?? '').replace(/\D/g, '');
  if (d.startsWith('84')) d = '0' + d.slice(2);
  return d;
}

export function isValidPhone(p: string): boolean {
  return /^0\d{9,10}$/.test(normPhone(p));
}

export function normEmail(e: string | null | undefined): string {
  return String(e ?? '').trim().toLowerCase();
}

/** Nhận diện đăng nhập: có @ là email, còn lại là SĐT. */
export function normLogin(id: string): { kind: 'email' | 'phone'; value: string } {
  return id.includes('@') ? { kind: 'email', value: normEmail(id) } : { kind: 'phone', value: normPhone(id) };
}

/** Tên hiển thị: biệt danh, trống thì lấy từ cuối của họ tên. */
export function shortName(p: { nick?: string | null; fullName?: string | null } | null | undefined): string {
  if (!p) return '?';
  if (p.nick && p.nick.trim()) return p.nick.trim();
  const parts = (p.fullName ?? '').trim().split(/\s+/);
  return parts[parts.length - 1] || '?';
}

export function initials(p: { nick?: string | null; fullName?: string | null }): string {
  const src = (p.nick || p.fullName || '?').trim().split(/\s+/);
  return (src.length > 1 ? src[0][0] + src[src.length - 1][0] : src[0].slice(0, 2)).toUpperCase();
}

/** Màu avatar theo hash id. */
export function hue(id: string): number {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

/** 200000 → "200.000đ", số âm dùng dấu −. */
export function money(n: number): string {
  const abs = Math.abs(Math.round(n));
  const s = String(abs).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (n < 0 ? '−' : '') + s + 'đ';
}

export const fmt1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

/** Quy định: tách dòng, bỏ số thứ tự đầu dòng, bỏ dòng trống. */
export function parseRules(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(\d+[.)]|[-•*])\s*/, '').trim())
    .filter(Boolean);
}

export type RuleIcon = 'clock' | 'check' | 'coin' | 'shield' | 'shirt' | 'heart' | 'info';
/** Icon quy định theo từ khoá (BRD 10.3). */
export function ruleIcon(r: string): RuleIcon {
  const t = r.toLowerCase();
  if (/muộn|giờ|phút|đúng hẹn/.test(t)) return 'clock';
  if (/điểm danh|vote|báo nghỉ/.test(t)) return 'check';
  if (/quỹ|tiền|phạt|trả|đóng/.test(t)) return 'coin';
  if (/xoạc|chấn thương|an toàn|bạo lực/.test(t)) return 'shield';
  if (/áo|đồng phục|giày/.test(t)) return 'shirt';
  if (/anh em|tôn trọng|thắng thua|vui/.test(t)) return 'heart';
  return 'info';
}

export function isSafeUrl(u: string | null | undefined): boolean {
  return /^https?:\/\//i.test(u ?? '');
}
