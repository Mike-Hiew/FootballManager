export const STAT_KEYS = [
  'PAC', 'STA', 'STR', 'DRI', 'PAS', 'LPA', 'FIN', 'SHO', 'HEA',
  'TAC', 'DEF', 'VIS', 'ATP', 'REA', 'HAN', 'REF', 'GKP',
] as const;
export type StatKey = (typeof STAT_KEYS)[number];
export type Stats = Record<StatKey, number>;

export const STAT_GROUPS = ['Thể chất', 'Kỹ thuật', 'Phòng ngự', 'Tư duy', 'Thủ môn'] as const;
export type StatGroup = (typeof STAT_GROUPS)[number];

export const STAT_INFO: Record<StatKey, { vn: string; desc: string; group: StatGroup }> = {
  PAC: { vn: 'Tốc độ', desc: 'Bứt tốc + tốc độ tối đa', group: 'Thể chất' },
  STA: { vn: 'Thể lực', desc: 'Chạy bền suốt trận', group: 'Thể chất' },
  STR: { vn: 'Sức mạnh', desc: 'Tì đè, va chạm', group: 'Thể chất' },
  DRI: { vn: 'Rê dắt', desc: 'Giữ bóng, khống chế, xoay người', group: 'Kỹ thuật' },
  PAS: { vn: 'Chuyền ngắn', desc: 'Phối hợp nhỏ, chuyền chính xác', group: 'Kỹ thuật' },
  LPA: { vn: 'Chuyền dài/tạt', desc: 'Phát động dài, tạt bóng', group: 'Kỹ thuật' },
  FIN: { vn: 'Dứt điểm', desc: 'Kết thúc trong vòng cấm', group: 'Kỹ thuật' },
  SHO: { vn: 'Sút xa', desc: 'Lực sút, sút ngoài vòng cấm', group: 'Kỹ thuật' },
  HEA: { vn: 'Không chiến', desc: 'Đánh đầu, bật nhảy', group: 'Kỹ thuật' },
  TAC: { vn: 'Tắc bóng', desc: 'Tranh chấp, đoạt bóng 1v1', group: 'Phòng ngự' },
  DEF: { vn: 'Kèm & cắt', desc: 'Kèm người, chọn vị trí, cắt bóng', group: 'Phòng ngự' },
  VIS: { vn: 'Nhãn quan', desc: 'Nhìn thấy đường chuyền', group: 'Tư duy' },
  ATP: { vn: 'Chạy chỗ', desc: 'Di chuyển không bóng khi tấn công', group: 'Tư duy' },
  REA: { vn: 'Phản ứng', desc: 'Phản ứng nhanh với tình huống', group: 'Tư duy' },
  HAN: { vn: 'Bắt & bay người', desc: 'Bắt dính, đổ người cản phá', group: 'Thủ môn' },
  REF: { vn: 'Phản xạ', desc: 'Phản xạ cự ly gần', group: 'Thủ môn' },
  GKP: { vn: 'Chọn vị trí TM', desc: 'Đứng đúng chỗ, băng ra', group: 'Thủ môn' },
};

export const GK_KEYS: readonly StatKey[] = ['HAN', 'REF', 'GKP'];

/** Chỉ số thiếu mặc định 5 (BRD 4.3). */
export function fillStats(partial: Partial<Record<string, number>>): Stats {
  const out = {} as Stats;
  for (const k of STAT_KEYS) out[k] = typeof partial[k] === 'number' ? (partial[k] as number) : 5;
  return out;
}

/**
 * Chỉ số chung khi cả đội chấm: trung bình từng chỉ số của mọi phiếu (bản tự khai + đồng đội),
 * làm tròn bước 0.5 trong [1,10] như chỉ số nhập tay.
 */
export function averageStats(list: ReadonlyArray<Partial<Record<string, number>>>): Stats {
  const all = list.map((s) => fillStats(s));
  const out = {} as Stats;
  for (const k of STAT_KEYS) {
    const avg = all.length ? all.reduce((a, s) => a + s[k], 0) / all.length : 5;
    out[k] = Math.min(10, Math.max(1, Math.round(avg * 2) / 2));
  }
  return out;
}

/** 6 chỉ số gộp kiểu FIFA hiển thị trên thẻ (BRD 4.2). */
export const FACE: ReadonlyArray<readonly [string, Partial<Record<StatKey, number>>]> = [
  ['Tốc độ', { PAC: 1 }],
  ['Sút', { FIN: 0.5, SHO: 0.35, ATP: 0.15 }],
  ['Chuyền', { PAS: 0.5, LPA: 0.3, VIS: 0.2 }],
  ['Rê dắt', { DRI: 0.8, REA: 0.2 }],
  ['Phòng ngự', { TAC: 0.45, DEF: 0.45, HEA: 0.1 }],
  ['Thể chất', { STA: 0.45, STR: 0.4, HEA: 0.15 }],
];

export function faceStats(stats: Partial<Stats>): Array<{ label: string; value: number }> {
  const s = fillStats(stats);
  return FACE.map(([label, f]) => ({
    label,
    value: Object.entries(f).reduce((a, [k, w]) => a + (w as number) * s[k as StatKey], 0),
  }));
}

export const STYLES = [
  'Tốc độ', 'Rê dắt', 'Kiến thiết', 'Chuyền dài', 'Dứt điểm', 'Sút xa', 'Không chiến',
  'Pressing', 'Càn quét', 'Đọc tình huống', 'Bền bỉ', 'Thủ lĩnh', 'Phản xạ (TM)', 'Phát động (TM)',
] as const;
export type Style = (typeof STYLES)[number];

const STYLE_RULE: Partial<Record<Style, (s: Stats) => boolean>> = {
  'Tốc độ': (s) => s.PAC >= 8.5,
  'Rê dắt': (s) => s.DRI >= 8.5,
  'Kiến thiết': (s) => (s.PAS + s.VIS) / 2 >= 8.5,
  'Chuyền dài': (s) => s.LPA >= 8,
  'Dứt điểm': (s) => s.FIN >= 8.5,
  'Sút xa': (s) => s.SHO >= 8.5,
  'Không chiến': (s) => s.HEA >= 8.5,
  Pressing: (s) => (s.STA + s.PAC + s.TAC) / 3 >= 7.5,
  'Càn quét': (s) => (s.TAC + s.STA) / 2 >= 8,
  'Đọc tình huống': (s) => (s.DEF + s.REA) / 2 >= 8,
  'Bền bỉ': (s) => s.STA >= 8.5,
  'Phản xạ (TM)': (s) => s.REF >= 8.5,
  'Phát động (TM)': (s) => s.HAN >= 6 && (s.LPA + s.PAS) / 2 >= 7,
  // 'Thủ lĩnh' chỉ gán tay
};

/** Gợi ý phong cách từ chỉ số (BRD 4.5). */
export function suggestStyles(stats: Partial<Stats>): Style[] {
  const s = fillStats(stats);
  return STYLES.filter((t) => STYLE_RULE[t]?.(s));
}

export const roundHalf = (v: number) => Math.round(v * 2) / 2;
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
