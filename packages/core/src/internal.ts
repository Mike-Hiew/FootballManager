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
 * 1) Theo tuyến (GK → DF → MF → FW), người mạnh trước (có nhiễu), xếp vào đội đang thiếu tuyến đó / yếu hơn.
 * 2) Đổi cặp ngẫu nhiên nếu làm giảm độ lệch.
 */
export function balanceTeams(players: readonly SplitPlayer[], rng: () => number = Math.random): Sides {
  const byId = new Map(players.map((p) => [p.id, p]));
  const info = players.map((p) => ({ id: p.id, ...strengthOf(p), noise: (rng() - 0.5) * 1.2 }));
  const order: Line[] = ['GK', 'DF', 'MF', 'FW'];
  // xáo thứ tự các tuyến sau GK để mỗi lần khác nhau
  const rest = order.slice(1).sort(() => rng() - 0.5);
  const a: string[] = [];
  const b: string[] = [];
  let ta = 0;
  let tb = 0;
  for (const line of ['GK' as Line, ...rest]) {
    const group = info.filter((x) => x.line === line).sort((x, y) => y.score + y.noise - (x.score + x.noise));
    let la = 0;
    let lb = 0;
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
  // cân quân số (lệch tối đa 1)
  while (a.length - b.length > 1) b.push(a.pop()!);
  while (b.length - a.length > 1) a.push(b.pop()!);
  // đổi cặp ngẫu nhiên nếu cân hơn
  let best = cost(a, b, byId);
  for (let it = 0; it < 400 && a.length && b.length; it++) {
    const i = Math.floor(rng() * a.length);
    const j = Math.floor(rng() * b.length);
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
