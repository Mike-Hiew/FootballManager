import { rankedPositions, type Position } from './positions';
import type { Stats } from './stats';

/**
 * Đá nội bộ (BRD 15): chia người Đi thành 2 đội cân bằng (Đội A áo sáng, Đội B áo tối), chia tiền do ĐT quyết.
 */
export const INTERNAL_TYPE = 'Nội bộ';
export const isInternal = (m: { type?: string | null }) => m.type === INTERNAL_TYPE;

export interface Sides {
  a: string[];
  b: string[];
}

export interface SplitPlayer {
  id: string;
  stats: Partial<Stats>;
  foot: string;
}

type Line = 'GK' | 'DF' | 'MF' | 'FW';
const LINE: Record<Position, Line> = { GK: 'GK', CB: 'DF', LB: 'DF', RB: 'DF', CM: 'MF', ST: 'FW' };

/** Sức mạnh 1 người (điểm vị trí tốt nhất, thang 1–10) và tuyến của vị trí đó. */
export function strengthOf(p: SplitPlayer): { score: number; line: Line; pos: Position } {
  const [pos, score] = rankedPositions(p.stats, p.foot)[0];
  return { score, line: LINE[pos], pos };
}

export interface SideSummary {
  total: number;
  avg: number;
  lines: Record<Line, number>;
}

export function summarize(ids: readonly string[], byId: Map<string, SplitPlayer>): SideSummary {
  const lines: Record<Line, number> = { GK: 0, DF: 0, MF: 0, FW: 0 };
  let total = 0;
  for (const id of ids) {
    const p = byId.get(id);
    if (!p) continue;
    const s = strengthOf(p);
    total += s.score;
    lines[s.line]++;
  }
  return { total: Math.round(total * 10) / 10, avg: ids.length ? Math.round((total / ids.length) * 10) / 10 : 0, lines };
}

/** Độ lệch giữa 2 đội: chênh tổng sức mạnh + phạt lệch quân số / thủ môn / từng tuyến. */
function cost(a: string[], b: string[], byId: Map<string, SplitPlayer>): number {
  const A = summarize(a, byId);
  const B = summarize(b, byId);
  let c = Math.abs(A.total - B.total);
  c += Math.abs(a.length - b.length) > 1 ? 50 : 0;
  c += Math.abs(A.lines.GK - B.lines.GK) * 3;
  for (const l of ['DF', 'MF', 'FW'] as const) c += Math.max(0, Math.abs(A.lines[l] - B.lines[l]) - 1) * 1.2;
  return c;
}

/**
 * Chia ngẫu nhiên nhưng cân bằng: mỗi lần gọi ra một cách chia khác (nhiễu ngẫu nhiên), luôn gần cân bằng.
 * `fixed`: người ĐT đã tự xếp — giữ nguyên đội, chỉ chia những người còn lại cho cân.
 * 1) Theo tuyến (GK → DF → MF → FW), người mạnh trước (có nhiễu), xếp vào đội đang thiếu tuyến đó / yếu hơn.
 * 2) Đổi cặp ngẫu nhiên (chỉ người chưa cố định) nếu làm giảm độ lệch.
 */
export function balanceTeams(players: readonly SplitPlayer[], rng: () => number = Math.random, fixed?: Sides): Sides {
  const byId = new Map(players.map((p) => [p.id, p]));
  const a = (fixed?.a ?? []).filter((id) => byId.has(id));
  const b = (fixed?.b ?? []).filter((id) => byId.has(id) && !a.includes(id));
  const locked = new Set([...a, ...b]);
  const info = players.filter((p) => !locked.has(p.id)).map((p) => ({ id: p.id, ...strengthOf(p), noise: (rng() - 0.5) * 1.2 }));
  const order: Line[] = ['GK', 'DF', 'MF', 'FW'];
  // xáo thứ tự các tuyến sau GK để mỗi lần khác nhau
  const rest = order.slice(1).sort(() => rng() - 0.5);
  const sa = summarize(a, byId);
  const sb = summarize(b, byId);
  let ta = sa.total;
  let tb = sb.total;
  for (const line of ['GK' as Line, ...rest]) {
    const group = info.filter((x) => x.line === line).sort((x, y) => y.score + y.noise - (x.score + x.noise));
    let la = sa.lines[line];
    let lb = sb.lines[line];
    for (const x of group) {
      const toA = la !== lb ? la < lb : a.length !== b.length ? a.length < b.length : ta !== tb ? ta < tb : rng() < 0.5;
      if (toA) {
        a.push(x.id);
        ta += x.score;
        la++;
      } else {
        b.push(x.id);
        tb += x.score;
        lb++;
      }
    }
  }
  // cân quân số (lệch tối đa 1) — chỉ dời người chưa cố định
  const moveFree = (from: string[], to: string[]) => {
    for (let i = from.length - 1; i >= 0; i--) {
      if (!locked.has(from[i])) {
        to.push(from.splice(i, 1)[0]);
        return true;
      }
    }
    return false;
  };
  while (a.length - b.length > 1 && moveFree(a, b));
  while (b.length - a.length > 1 && moveFree(b, a));
  // đổi cặp ngẫu nhiên nếu cân hơn
  const freeA = () => a.map((id, i) => [id, i] as const).filter(([id]) => !locked.has(id));
  const freeB = () => b.map((id, i) => [id, i] as const).filter(([id]) => !locked.has(id));
  let best = cost(a, b, byId);
  for (let it = 0; it < 400; it++) {
    const fa = freeA();
    const fb = freeB();
    if (!fa.length || !fb.length) break;
    const i = fa[Math.floor(rng() * fa.length)][1];
    const j = fb[Math.floor(rng() * fb.length)][1];
    [a[i], b[j]] = [b[j], a[i]];
    const c = cost(a, b, byId);
    if (c < best - 1e-9) best = c;
    else [a[i], b[j]] = [b[j], a[i]];
  }
  return { a, b };
}

/** Khoản chi thêm của trận nội bộ (nước, lôi, …). */
export interface SplitItem {
  label: string;
  amount: number;
}

/** Đọc khoản thêm từ JSON lưu trong DB. */
export const splitItemsOf = (raw: unknown): SplitItem[] =>
  Array.isArray(raw) ? raw.filter((x): x is SplitItem => !!x && typeof (x as SplitItem).label === 'string' && Number.isFinite((x as SplitItem).amount)) : [];

/** Tổng cần chia = tiền sân + các khoản thêm. */
export const splitTotal = (cost: number, items: readonly SplitItem[]) => cost + items.reduce((s, x) => s + x.amount, 0);

/** Phần mặc định mỗi người: chia đều, làm tròn lên nghìn đồng. */
export function defaultShare(total: number, people: number): number {
  if (people <= 0 || total <= 0) return 0;
  return Math.ceil(total / people / 1000) * 1000;
}

/** Phần của từng người: ĐT sửa riêng thì theo ĐT, còn lại chia đều. */
export function sharesOf(goers: readonly string[], total: number, overrides: Readonly<Record<string, number | null | undefined>>): Record<string, number> {
  const def = defaultShare(total, goers.length);
  return Object.fromEntries(goers.map((id) => [id, overrides[id] ?? def]));
}
