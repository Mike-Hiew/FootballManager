import { type StatKey, type Stats, clamp, fillStats } from './stats';

export const POSITIONS = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'LM', 'RM', 'CAM', 'ST'] as const;
export type Position = (typeof POSITIONS)[number];
export type PosGroup = 'Thủ môn' | 'Hậu vệ' | 'Tiền vệ' | 'Tiền đạo';

export const POS_INFO: Record<Position, { vn: string; group: PosGroup }> = {
  GK: { vn: 'Thủ môn', group: 'Thủ môn' },
  CB: { vn: 'Trung vệ', group: 'Hậu vệ' },
  LB: { vn: 'Hậu vệ trái', group: 'Hậu vệ' },
  RB: { vn: 'Hậu vệ phải', group: 'Hậu vệ' },
  CDM: { vn: 'TV phòng ngự', group: 'Tiền vệ' },
  CM: { vn: 'TV trung tâm', group: 'Tiền vệ' },
  LM: { vn: 'TV cánh trái', group: 'Tiền vệ' },
  RM: { vn: 'TV cánh phải', group: 'Tiền vệ' },
  CAM: { vn: 'TV tấn công', group: 'Tiền vệ' },
  ST: { vn: 'Tiền đạo', group: 'Tiền đạo' },
};

export const FEET = ['Trái', 'Phải', 'Hai chân'] as const;
export type Foot = (typeof FEET)[number];

type Weights = Partial<Record<StatKey, number>>;
const LB: Weights = { TAC: 22, DEF: 22, DRI: 13, STA: 10, PAS: 10, REA: 8, PAC: 7, LPA: 5, HEA: 3 };
const LM: Weights = { DRI: 25, PAS: 14, PAC: 12, LPA: 11, STA: 9, REA: 7, DEF: 6, VIS: 6, TAC: 5, ATP: 5 };

/** Trọng số (%) mỗi vị trí, tổng = 100 (BRD 4.3). */
export const WEIGHTS: Record<Position, Weights> = {
  GK: { HAN: 40, REF: 24, GKP: 20, PAS: 6, LPA: 5, REA: 5 },
  CB: { TAC: 32, DEF: 24, HEA: 11, STR: 10, PAC: 7, PAS: 6, DRI: 5, REA: 5 },
  LB,
  RB: LB,
  CDM: { DEF: 21, PAS: 15, TAC: 15, STA: 10, DRI: 9, REA: 9, VIS: 8, LPA: 7, STR: 6 },
  CM: { DRI: 18, PAS: 18, VIS: 12, STA: 9, LPA: 8, DEF: 8, ATP: 8, REA: 8, TAC: 6, SHO: 5 },
  LM,
  RM: LM,
  CAM: { DRI: 25, PAS: 18, VIS: 15, ATP: 11, SHO: 10, REA: 7, PAC: 5, FIN: 5, DEF: 4 },
  ST: { FIN: 22, DRI: 16, SHO: 15, PAC: 12, ATP: 11, REA: 9, HEA: 6, DEF: 4, STR: 2, PAS: 2, VIS: 1 },
};

export const FOOT_SIDE: Partial<Record<Position, Foot>> = { LB: 'Trái', LM: 'Trái', RB: 'Phải', RM: 'Phải' };

/** Điều chỉnh chân thuận: chỉ vị trí biên. */
export function footAdj(foot: Foot | string, pos: Position): number {
  const side = FOOT_SIDE[pos];
  if (!side) return 0;
  if (foot === 'Hai chân') return 0.2;
  return foot === side ? 0.3 : -0.3;
}

/** Điểm(p,v) = clamp[1,10](round0.1(Σ w·s /100 + Δchân)). */
export function positionScore(stats: Partial<Stats>, foot: Foot | string, pos: Position): number {
  let r = 0;
  for (const [k, w] of Object.entries(WEIGHTS[pos])) r += (w as number) * ((stats as Record<string, number>)[k] ?? 5);
  return clamp(Math.round((r / 100 + footAdj(foot, pos)) * 10) / 10, 1, 10);
}

export type Scores = Record<Position, number>;

export function allScores(stats: Partial<Stats>, foot: Foot | string): Scores {
  const o = {} as Scores;
  for (const p of POSITIONS) o[p] = positionScore(stats, foot, p);
  return o;
}

/** Vị trí sắp theo điểm giảm dần (giữ thứ tự POSITIONS khi bằng nhau). */
export function rankedPositions(stats: Partial<Stats>, foot: Foot | string): Array<[Position, number]> {
  return (Object.entries(allScores(stats, foot)) as Array<[Position, number]>).sort((a, b) => b[1] - a[1]);
}

export type ScoreTier = 'good' | 'ok' | 'bad';
/** ≥ 8 xanh (xuất sắc), 6.5–7.9 vàng, < 6.5 đỏ. */
export function scoreTier(score: number): ScoreTier {
  return score >= 8 ? 'good' : score >= 6.5 ? 'ok' : 'bad';
}

export interface ExplainRow { key: StatKey; stat: number; weight: number; contribution: number }
export interface Explanation { pos: Position; rows: ExplainRow[]; footAdj: number; score: number }

/** Giải thích công thức cho popover: đóng góp từng chỉ số, sắp theo trọng số giảm dần. */
export function explain(stats: Partial<Stats>, foot: Foot | string, pos: Position): Explanation {
  const s = fillStats(stats);
  const rows = (Object.entries(WEIGHTS[pos]) as Array<[StatKey, number]>)
    .sort((a, b) => b[1] - a[1])
    .map(([key, weight]) => ({ key, stat: s[key], weight, contribution: (weight * s[key]) / 100 }));
  return { pos, rows, footAdj: footAdj(foot, pos), score: positionScore(s, foot, pos) };
}
