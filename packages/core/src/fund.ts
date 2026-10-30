export type FundSource = 'dues' | 'pitch' | 'le' | 'manual';

export interface LedgerEntry {
  id?: string;
  date: string; // YYYY-MM-DD
  amount: number; // + thu, − chi (đồng)
  source: FundSource;
  sourceKey: string;
  note: string;
}

export const FUND_SOURCE_LABEL: Record<FundSource, string> = {
  dues: 'Quỹ tháng',
  pitch: 'Trận đấu',
  le: 'Đá lẻ',
  manual: 'Ghi tay',
};

export const balance = (entries: readonly Pick<LedgerEntry, 'amount'>[]) => entries.reduce((a, e) => a + e.amount, 0);

export function monthFlow(entries: readonly Pick<LedgerEntry, 'amount' | 'date'>[], month: string) {
  let inflow = 0, outflow = 0;
  for (const e of entries) {
    if (!e.date.startsWith(month)) continue;
    if (e.amount > 0) inflow += e.amount;
    else outflow -= e.amount;
  }
  return { inflow, outflow };
}

/** Mới nhất trước; cùng ngày thì khoản chi trước (như prototype). */
export function sortLedger<T extends Pick<LedgerEntry, 'date' | 'amount'>>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date) || a.amount - b.amount);
}

export interface DebtInput {
  month: string;
  monthlyFee: number;
  /** thành viên quỹ đang hiệu lực tháng này */
  quyPlayerIds: readonly string[];
  paidThisMonth: ReadonlySet<string>;
  /** các lượt đá lẻ Đi ở trận đã qua: (playerId, matchId, fee, paid) */
  leTurns: ReadonlyArray<{ playerId: string; matchId: string; fee: number; paid: boolean }>;
}

/** Còn phải thu = thành viên quỹ chưa đóng tháng này × monthlyFee + Σ phí đá lẻ chưa trả (BRD 7.3). */
export function outstanding(input: DebtInput) {
  const dues = input.quyPlayerIds.filter((id) => !input.paidThisMonth.has(id));
  const le = input.leTurns.filter((t) => !t.paid);
  return { dues, le, total: dues.length * input.monthlyFee + le.reduce((a, t) => a + t.fee, 0) };
}

/** Số tiền dòng sổ quỹ tháng = Σ số tiền đã đóng (mỗi người lưu mức tại lúc đóng). */
export const duesAmount = (payments: readonly { amount: number }[]) => payments.reduce((a, p) => a + p.amount, 0);
