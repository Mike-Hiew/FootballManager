import { type Foot, type Position, allScores, type Scores } from './positions';
import { clamp, type Stats } from './stats';
import { slotPositions } from './formation';

export interface PlanPlayer { id: string; stats: Partial<Stats>; foot: Foot | string; payType: 'quy' | 'le' | string }
export interface PlanConfig { minutes: number; periods: number; min?: number | null }

export interface PlanInfo {
  player: PlanPlayer;
  r: Scores;
  best: number;
  bestPos: Position;
  ex: boolean;
  quy: boolean;
  /** số đợt được đá */
  t: number;
}

export interface PlanPeriod { assign: Array<PlanInfo | null>; avg: number }

export interface Plan {
  info: PlanInfo[];
  N: number;
  P: number;
  min: number;
  maxMin: number;
  periods: PlanPeriod[];
  slots: Position[];
}

export const PLAN_PERIODS = [2, 3, 4, 6] as const;

const PERMS7: number[][] = (() => {
  const out: number[][] = [];
  const a = [0, 1, 2, 3, 4, 5, 6];
  const rec = (k: number) => {
    if (k === 7) {
      out.push(a.slice());
      return;
    }
    for (let i = k; i < 7; i++) {
      [a[k], a[i]] = [a[i], a[k]];
      rec(k + 1);
      [a[k], a[i]] = [a[i], a[k]];
    }
  };
  rec(0);
  return out;
})();

/**
 * Đề xuất thay người (BRD 5.6). Ưu tiên: Xuất sắc › Thành viên quỹ › Mức phù hợp.
 */
export function buildPlan(goers: readonly PlanPlayer[], formation: string, cfg: PlanConfig): Plan {
  const sl = slotPositions(formation);
  const n7 = sl.length;
  const P = cfg.periods;
  const info: PlanInfo[] = goers.map((player) => {
    const r = allScores(player.stats, player.foot);
    const bestPos = sl.reduce((b, pos) => (r[pos] > r[b] ? pos : b), sl[0]);
    const best = r[bestPos];
    return { player, r, best, bestPos, ex: best >= 8, quy: player.payType === 'quy', t: 0 };
  });
  info.sort((a, b) => +b.ex - +a.ex || +b.quy - +a.quy || b.best - a.best);
  const N = info.length;
  if (!N) return { info, N, P, min: 0, maxMin: 0, periods: [], slots: sl };

  // 1) số đợt mỗi người
  const total = n7 * P;
  const maxMin = Math.max(0, Math.min(P, Math.floor(total / N)));
  const min = N <= n7 ? P : clamp(cfg.min == null ? maxMin : cfg.min, Math.min(1, maxMin), maxMin);
  for (const i of info) i.t = N <= n7 ? P : min;
  let extra = N <= n7 ? 0 : total - N * min;
  for (const i of info) {
    if (extra <= 0) break;
    const g = Math.min(P - i.t, extra);
    i.t += g;
    extra -= g;
  }

  // 2) chọn người từng đợt
  const left = new Map<PlanInfo, number>(info.map((i) => [i, i.t]));
  const order = new Map<PlanInfo, number>(info.map((i, k) => [i, k]));
  const periods: PlanPeriod[] = [];
  let prev: Array<PlanInfo | null> | null = null;
  for (let k = 0; k < P; k++) {
    const L = P - k;
    const lf = (i: PlanInfo) => left.get(i) as number;
    const forced = info.filter((i) => lf(i) >= L && lf(i) > 0);
    const rest = info.filter((i) => lf(i) > 0 && lf(i) < L);
    const prevSet = new Set(prev ? prev.filter(Boolean).map((i) => (i as PlanInfo).player.id) : []);
    const w = (i: PlanInfo) => lf(i) / L + (i.ex ? 0.2 : 0) + (i.quy ? 0.1 : 0) + (prevSet.has(i.player.id) ? 0.12 : 0);
    const restSorted = k === 0 ? rest : [...rest].sort((a, b) => w(b) - w(a) || (order.get(a) as number) - (order.get(b) as number));
    const on = [...forced, ...restSorted].slice(0, n7);
    for (const i of on) left.set(i, lf(i) - 1);

    // 3) xếp vị trí tối ưu: 5.040 hoán vị, phạt −0.3 khi đổi sang vị trí khác loại
    const cand: Array<PlanInfo | null> = on.concat(new Array(n7 - on.length).fill(null));
    let best = -1e9;
    let bp = PERMS7[0];
    for (const perm of PERMS7) {
      let sc = 0;
      for (let s = 0; s < n7; s++) {
        const i = cand[perm[s]];
        if (!i) continue;
        sc += i.r[sl[s]];
        if (prev) {
          const was = prev.indexOf(i);
          if (was >= 0 && was !== s && sl[was] !== sl[s]) sc -= 0.3;
        }
      }
      if (sc > best) {
        best = sc;
        bp = perm;
      }
    }
    const assign = sl.map((_, s) => cand[bp[s]]);
    const filled = assign.filter(Boolean).length;
    const avg = filled ? assign.reduce((a, i, s) => a + (i ? i.r[sl[s]] : 0), 0) / filled : 0;
    periods.push({ assign, avg });
    prev = assign;
  }
  return { info, N, P, min, maxMin, periods, slots: sl };
}

export type SubLine =
  | { type: 'sub'; in: PlanInfo; pos: Position; out: PlanInfo | null }
  | { type: 'off'; out: PlanInfo }
  | { type: 'move'; who: PlanInfo; from: Position; to: Position };

/** Lệnh thay giữa đợt k−1 và k: ghép cùng slot › cùng mã vị trí › bất kỳ. */
export function subsOf(plan: Plan, k: number): SubLine[] {
  const a = plan.periods[k - 1].assign;
  const b = plan.periods[k].assign;
  const sl = plan.slots;
  const ids = (x: Array<PlanInfo | null>) => new Set(x.filter(Boolean).map((i) => (i as PlanInfo).player.id));
  const A = ids(a);
  const B = ids(b);
  const outs = a.flatMap((i, s) => (i && !B.has(i.player.id) ? [{ i, s }] : []));
  const ins = b.flatMap((i, s) => (i && !A.has(i.player.id) ? [{ i, s }] : []));
  const res: SubLine[] = [];
  const used = new Set<(typeof outs)[number]>();
  for (const x of ins) {
    const o =
      outs.find((o) => !used.has(o) && o.s === x.s) ||
      outs.find((o) => !used.has(o) && sl[o.s] === sl[x.s]) ||
      outs.find((o) => !used.has(o));
    if (o) used.add(o);
    res.push({ type: 'sub', in: x.i, pos: sl[x.s], out: o ? o.i : null });
  }
  for (const o of outs) if (!used.has(o)) res.push({ type: 'off', out: o.i });
  b.forEach((i, s) => {
    if (!i || !A.has(i.player.id)) return;
    const was = a.findIndex((x) => x && x.player.id === i.player.id);
    if (sl[was] !== sl[s]) res.push({ type: 'move', who: i, from: sl[was], to: sl[s] });
  });
  return res;
}

export function planSummary(plan: Plan, cfg: PlanConfig) {
  const step = cfg.minutes / plan.P;
  let subs = 0;
  for (let k = 1; k < plan.periods.length; k++) subs += subsOf(plan, k).filter((x) => x.type === 'sub').length;
  const minT = plan.info.length ? Math.min(...plan.info.map((i) => i.t)) : 0;
  return { step, subs, minPeriods: minT, minMinutes: Math.round(minT * step), everyonePlays: plan.info.every((i) => i.t > 0) };
}
