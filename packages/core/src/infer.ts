import { GK_KEYS, STAT_KEYS, type StatKey, type Stats, clamp, roundHalf } from './stats';
import { type Foot, type Position, WEIGHTS, footAdj, positionScore } from './positions';

export type Ratings = Partial<Record<Position, number>>;

/**
 * Suy ngược 17 chỉ số từ điểm vị trí tự chấm (BRD 4.4):
 * gradient descent có chiếu về [1,10], regularize ridge về một prior.
 */
export function inferStats(ratings: Ratings, foot: Foot | string): Stats {
  const ps = (Object.keys(ratings) as Position[]).filter((p) => (ratings[p] ?? 0) > 0 && WEIGHTS[p]);
  const out = ps.filter((p) => p !== 'GK');
  const m = out.length ? out.reduce((a, p) => a + (ratings[p] as number), 0) / out.length - 0.5 : 5;

  const inv = {} as Record<StatKey, number>;
  for (const k of STAT_KEYS) inv[k] = 0;
  for (const p of out) for (const [k, w] of Object.entries(WEIGHTS[p])) inv[k as StatKey] += w as number;

  const prior = {} as Stats;
  for (const k of STAT_KEYS) {
    prior[k] = GK_KEYS.includes(k) ? ratings.GK || 3 : 4 + (m - 4) * Math.min(1, inv[k] / 15);
  }

  const s: Stats = { ...prior };
  const g = {} as Record<StatKey, number>;
  for (let it = 0; it < 600; it++) {
    for (const k of STAT_KEYS) g[k] = 0.04 * (s[k] - prior[k]);
    for (const p of ps) {
      const w = WEIGHTS[p];
      let pred = 0;
      for (const [k, wk] of Object.entries(w)) pred += ((wk as number) * s[k as StatKey]) / 100;
      const e = pred - ((ratings[p] as number) - footAdj(foot, p));
      for (const [k, wk] of Object.entries(w)) g[k as StatKey] += (2 * e * (wk as number)) / 100;
    }
    for (const k of STAT_KEYS) s[k] = clamp(s[k] - 1.5 * g[k], 1, 10);
  }
  for (const k of STAT_KEYS) s[k] = roundHalf(s[k]);
  refine(s, ratings, ps, foot);
  return s;
}

const TOLERANCE = 0.3;

/**
 * Sau khi làm tròn 0.5, điểm cao (≥ 9) có thể lệch tới 0.5 do ridge kéo về prior.
 * Bước tinh chỉnh tham lam: dịch ±0.5 chỉ số trọng số lớn nhất của vị trí lệch nhất,
 * chỉ nhận khi sai số lớn nhất giảm. Không chạy khi mọi vị trí đã trong ±0.3,
 * nên kết quả trùng prototype ở các ca bình thường.
 */
function refine(s: Stats, ratings: Ratings, ps: Position[], foot: Foot | string) {
  const raw = (p: Position) =>
    Object.entries(WEIGHTS[p]).reduce((a, [k, w]) => a + ((w as number) * s[k as StatKey]) / 100, 0) + footAdj(foot, p);
  const rounded = () => Math.max(0, ...ps.map((p) => Math.abs(positionScore(s, foot, p) - (ratings[p] as number))));
  // mục tiêu liên tục: sai số lớn nhất, rồi tổng bình phương sai số
  const cost = () => {
    const e = ps.map((p) => raw(p) - (ratings[p] as number));
    return [Math.max(...e.map(Math.abs)), e.reduce((a, x) => a + x * x, 0)] as const;
  };
  const better = (a: readonly [number, number], b: readonly [number, number]) =>
    a[0] < b[0] - 1e-9 || (Math.abs(a[0] - b[0]) <= 1e-9 && a[1] < b[1] - 1e-9);
  for (let it = 0; it < 80 && rounded() > TOLERANCE + 1e-9; it++) {
    const base = cost();
    let best: { k: StatKey; d: number; c: readonly [number, number] } | null = null;
    for (const k of STAT_KEYS) {
      for (const d of [-0.5, 0.5]) {
        const next = s[k] + d;
        if (next < 1 || next > 10) continue;
        s[k] = next;
        const c = cost();
        s[k] -= d;
        if (better(c, best ? best.c : base)) best = { k, d, c };
      }
    }
    if (!best) return;
    s[best.k] += best.d;
  }
}
