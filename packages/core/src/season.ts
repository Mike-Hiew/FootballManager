export type AttStatus = 'di' | 'nghi';
export type Result = 'T' | 'H' | 'B';

export interface SeasonMatch {
  id: string;
  date: string; // YYYY-MM-DD
  time?: string | null;
  opponent: string;
  scoreUs: number | null;
  scoreThem: number | null;
  attendance: Readonly<Record<string, AttStatus>>;
  events: Readonly<Record<string, { goals: number; assists: number }>>;
  mvpPlayerId: string | null;
}

export const isPlayed = (m: Pick<SeasonMatch, 'scoreUs' | 'scoreThem'>) => m.scoreUs != null && m.scoreThem != null;

export function resultOf(m: Pick<SeasonMatch, 'scoreUs' | 'scoreThem'>): Result {
  const us = m.scoreUs ?? 0;
  const them = m.scoreThem ?? 0;
  return us > them ? 'T' : us < them ? 'B' : 'H';
}

const byKickoff = (a: SeasonMatch, b: SeasonMatch) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''));

/** Trận đã đá thuộc mùa (năm dương lịch), sắp theo thời gian. */
export function seasonMatches<T extends SeasonMatch>(matches: readonly T[], year: number): T[] {
  return matches.filter((m) => isPlayed(m) && m.date.startsWith(String(year))).sort(byKickoff);
}

export interface TeamSeason {
  matches: SeasonMatch[];
  seq: Result[];
  n: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  /** chuỗi hiện tại */
  cur: number;
  curK: Result | null;
  /** thắng / thua dài nhất */
  wl: number;
  ll: number;
  /** bất bại từ trận cuối */
  unbeaten: number;
  /** 5 kết quả gần nhất, mới nhất cuối */
  form: Array<{ r: Result; match: SeasonMatch }>;
}

/** Thành tích + chuỗi mùa (BRD 8.2). */
export function teamSeason(matches: readonly SeasonMatch[], year: number): TeamSeason {
  const ms = seasonMatches(matches, year);
  let w = 0, d = 0, l = 0, gf = 0, ga = 0;
  const seq = ms.map((m) => {
    const r = resultOf(m);
    if (r === 'T') w++;
    else if (r === 'B') l++;
    else d++;
    gf += m.scoreUs ?? 0;
    ga += m.scoreThem ?? 0;
    return r;
  });
  const longest = (k: Result) => {
    let best = 0, c = 0;
    for (const r of seq) {
      c = r === k ? c + 1 : 0;
      best = Math.max(best, c);
    }
    return best;
  };
  const curK = seq[seq.length - 1] ?? null;
  let cur = 0;
  for (let i = seq.length - 1; i >= 0 && seq[i] === curK; i--) cur++;
  let unbeaten = 0;
  for (let i = seq.length - 1; i >= 0 && seq[i] !== 'B'; i--) unbeaten++;
  const form = ms.slice(-5).map((match) => ({ r: resultOf(match), match }));
  return { matches: ms, seq, n: ms.length, w, d, l, gf, ga, cur, curK, wl: longest('T'), ll: longest('B'), unbeaten, form };
}

export interface PlayerLine {
  playerId: string;
  /** số trận có Đi */
  gp: number;
  goals: number;
  assists: number;
  ga: number;
  mvp: number;
  /** tỉ lệ tham gia % trên số trận đã đá của mùa */
  rate: number;
}

export function playerSeason(matches: readonly SeasonMatch[], year: number, playerId: string): PlayerLine {
  const ms = seasonMatches(matches, year);
  let gp = 0, g = 0, a = 0, mvp = 0;
  for (const m of ms) {
    if (m.attendance[playerId] === 'di') gp++;
    const e = m.events[playerId];
    if (e) {
      g += e.goals || 0;
      a += e.assists || 0;
    }
    if (m.mvpPlayerId === playerId) mvp++;
  }
  return { playerId, gp, goals: g, assists: a, ga: g + a, mvp, rate: ms.length ? Math.round((gp / ms.length) * 100) : 0 };
}

export function seasonTable(matches: readonly SeasonMatch[], year: number, playerIds: readonly string[]): PlayerLine[] {
  return playerIds.map((id) => playerSeason(matches, year, id));
}

export type LeaderKey = 'goals' | 'assists' | 'mvp' | 'ga';
const OTHER: Record<LeaderKey, (l: PlayerLine) => number> = {
  goals: (l) => l.assists,
  assists: (l) => l.goals,
  mvp: (l) => l.ga,
  ga: (l) => l.mvp,
};

/**
 * Bảng xếp hạng một chỉ số: chỉ lấy > 0; hoà thì ít trận hơn đứng trên,
 * rồi nhiều chỉ số còn lại hơn đứng trên (BRD 6.7, 8.2).
 */
export function leaderboard(lines: readonly PlayerLine[], key: LeaderKey): PlayerLine[] {
  return lines
    .filter((l) => l[key] > 0)
    .sort((a, b) => b[key] - a[key] || a.gp - b.gp || OTHER[key](b) - OTHER[key](a));
}

export type TableKey = LeaderKey | 'gp' | 'rate';

/**
 * Thứ tự bảng Thống kê theo cột `key` (dir -1 = giảm dần). Xếp hoà theo BRD 6.7: bằng chỉ số chính →
 * ít trận hơn đứng trên → nhiều chỉ số còn lại hơn đứng trên.
 */
export function compareLines(key: TableKey, dir: 1 | -1) {
  const rest = (l: PlayerLine) => (key === 'gp' || key === 'rate' ? l.ga : OTHER[key](l));
  return (a: PlayerLine, b: PlayerLine) => dir * (a[key] - b[key]) || (key !== 'gp' ? a.gp - b.gp : 0) || rest(b) - rest(a);
}

/** Đếm số lần MVP mùa của từng người (sao trên sân). */
export function mvpCounts(matches: readonly SeasonMatch[], year: number): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of seasonMatches(matches, year)) if (m.mvpPlayerId) out.set(m.mvpPlayerId, (out.get(m.mvpPlayerId) ?? 0) + 1);
  return out;
}
