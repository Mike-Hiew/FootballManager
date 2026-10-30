/** Số phiếu cần để chốt bằng vote: ceil(0.6 · số người Đi) (BRD 6.6 — cách hiểu quorum). */
export function mvpQuorum(goers: number): number {
  return Math.ceil(goers * 0.6);
}

export type MvpResolution =
  | { status: 'done'; winner: string; votes: number; total: number; need: number }
  | { status: 'need'; total: number; need: number; tie: boolean };

/**
 * Chốt vote MVP: đủ quorum và người dẫn đầu không hoà → done, ngược lại → need.
 * `ballots` = danh sách id ứng viên (mỗi phiếu một phần tử).
 */
export function resolveMvp(ballots: readonly string[], goers: number): MvpResolution {
  const need = mvpQuorum(goers);
  const tally = new Map<string, number>();
  for (const c of ballots) tally.set(c, (tally.get(c) ?? 0) + 1);
  const rows = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  const tie = rows.length > 1 && rows[0][1] === rows[1][1];
  if (ballots.length >= need && rows.length && !tie) {
    return { status: 'done', winner: rows[0][0], votes: rows[0][1], total: ballots.length, need };
  }
  return { status: 'need', total: ballots.length, need, tie };
}

export function tallyVotes(ballots: readonly string[]): Array<[string, number]> {
  const tally = new Map<string, number>();
  for (const c of ballots) tally.set(c, (tally.get(c) ?? 0) + 1);
  return [...tally.entries()].sort((a, b) => b[1] - a[1]);
}
