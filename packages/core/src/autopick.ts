import { type Position, allScores, type Foot } from './positions';
import { type Lineup, slotPositions } from './formation';
import type { Stats } from './stats';

/**
 * Hungarian (Kuhn–Munkres) cho ma trận chi phí n×m với n ≤ m, tìm phép gán
 * tối thiểu tổng chi phí. Trả về assignment[row] = col.
 */
export function hungarian(cost: number[][]): number[] {
  const n = cost.length;
  if (!n) return [];
  const m = cost[0].length;
  if (m < n) throw new Error('hungarian: cần số cột ≥ số hàng');
  const INF = Number.POSITIVE_INFINITY;
  const u = new Array(n + 1).fill(0);
  const v = new Array(m + 1).fill(0);
  const p = new Array(m + 1).fill(0);
  const way = new Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(m + 1).fill(INF);
    const used = new Array(m + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = INF;
      let j1 = 0;
      for (let j = 1; j <= m; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }
  const ans = new Array(n).fill(-1);
  for (let j = 1; j <= m; j++) if (p[j]) ans[p[j] - 1] = j - 1;
  return ans;
}

export interface PickPlayer { id: string; stats: Partial<Stats>; foot: Foot | string }

/**
 * Xếp tự động (BRD 5.4, bản thật): tối đa tổng điểm 7 slot bằng Hungarian.
 * Thiếu người thì slot cuối cùng có điểm thấp nhất để trống.
 */
export function autoPick(players: readonly PickPlayer[], formation: string): Lineup {
  const slots = slotPositions(formation);
  if (!players.length) return slots.map(() => null);
  const scores = players.map((p) => allScores(p.stats, p.foot));
  // hàng = slot, cột = cầu thủ (+ cột giả điểm 0 nếu thiếu người)
  const cols = Math.max(players.length, slots.length);
  const cost = slots.map((pos: Position) =>
    Array.from({ length: cols }, (_, j) => (j < players.length ? -scores[j][pos] : 0)),
  );
  const asg = hungarian(cost);
  return asg.map((j) => (j >= 0 && j < players.length ? players[j].id : null));
}

/** Bản tham lam như prototype — chỉ dùng để so sánh trong test. */
export function autoPickGreedy(players: readonly PickPlayer[], formation: string): Lineup {
  const slots = slotPositions(formation);
  const pairs: Array<[number, string, number]> = [];
  for (const p of players) {
    const r = allScores(p.stats, p.foot);
    slots.forEach((pos, i) => pairs.push([r[pos], p.id, i]));
  }
  pairs.sort((a, b) => b[0] - a[0]);
  const out: Lineup = slots.map(() => null);
  const used = new Set<string>();
  const gk = pairs.find((x) => x[2] === 0);
  if (gk) {
    out[0] = gk[1];
    used.add(gk[1]);
  }
  for (const [, pid, i] of pairs) {
    if (out[i] || used.has(pid)) continue;
    out[i] = pid;
    used.add(pid);
  }
  return out;
}
