'use client';

import { useState } from 'react';
import { FUND_SOURCE_LABEL, addMonths, dm, monthFlow, monthLabel, money, recentMonths, shortName, todayVN, balance, type FundSource } from '@san7/core';
import { useTeam } from './TeamContext';
import { Avatar } from './ui';
import { MatchModal } from './matches/MatchModal';
import { addEntryAction, deleteEntryAction, remindPaymentAction, requestDuesAction, setDuesAction, setDuesReminderAction, setFeesAction } from '@/app/actions';

export interface FundData {
  monthlyFee: number;
  perMatchFee: number;
  duesReminder: boolean;
  month: string;
  entries: Array<{ id: string; date: string; amount: number; source: string; note: string }>;
  dues: Array<{ playerId: string; month: string; amount: number }>;
  debts: { dues: string[]; le: Array<{ playerId: string; matchId: string; fee: number; paid: boolean }>; total: number };
  matchMoney: Array<{ id: string; date: string; opponent: string; cost: number; fee: number; lePaid: number; leTotal: number }>;
  /** yêu cầu đóng tiền còn người nợ (chỉ ĐT) */
  requests: Array<{ id: string; kind: 'dues' | 'le'; label: string; amount: number; createdAt: string; remindedAt: string | null; owed: string[]; pending: string[] }>;
}

/** ĐT gửi yêu cầu đóng quỹ tháng và theo dõi / nhắc các yêu cầu còn người nợ. */
function PayRequests({ data }: { data: FundData }) {
  const { nameOf, act, teamId } = useTeam();
  const months = [addMonths(data.month, -1), data.month, addMonths(data.month, 1)];
  const names = (ids: string[]) => ids.map((id) => nameOf(id)).join(', ');
  return (
    <div className="panel">
      <h3 className="st">Yêu cầu đóng tiền</h3>
      <form
        className="form-inline"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const month = String(f.get('month'));
          act(() => requestDuesAction(teamId, month, String(f.get('note') ?? '')), (n) => `Đã gửi yêu cầu đóng quỹ ${monthLabel(month)} cho ${n} người`);
        }}
      >
        <div className="field" style={{ width: 150 }}>
          <label htmlFor="reqMonth">Quỹ tháng</label>
          <select id="reqMonth" name="month" defaultValue={data.month}>{months.map((k) => <option key={k} value={k}>{monthLabel(k)}</option>)}</select>
        </div>
        <div className="field" style={{ flex: 1, minWidth: 180 }}><label htmlFor="reqNote">Ghi chú (không bắt buộc)</label><input id="reqNote" name="note" maxLength={80} placeholder="VD: CK 0901… Vietcombank, hạn 10/11" /></div>
        <button className="btn primary" type="submit">Gửi yêu cầu {money(data.monthlyFee)}/người</button>
      </form>
      <p className="hint">Gửi cho thành viên <span className="chip quy">Quỹ</span> chưa đóng tháng đó. Tiền đá lẻ gửi ở tab Kết quả của từng trận sau khi nhập tỉ số. App tự nhắc lại 3 ngày một lần cho người chưa đóng.</p>
      {data.requests.length ? data.requests.map((r) => (
        <div key={r.id} className="apcard">
          <span className={`chip ${r.kind === 'dues' ? 'quy' : 'le'}`}>{r.kind === 'dues' ? 'Quỹ' : 'Đá lẻ'}</span>
          <div className="t">
            <b>{r.label}</b> · {money(r.amount)}/người
            {r.owed.length > 0 && <small>Chưa đóng ({r.owed.length}): {names(r.owed)}</small>}
            {r.pending.length > 0 && <small>Đã báo đóng, chờ bạn xác nhận ở tab Duyệt: {names(r.pending)}</small>}
          </div>
          <div className="acts">
            {r.owed.length > 0 && <button type="button" className="btn sm" onClick={() => act(() => remindPaymentAction(teamId, r.id), (n) => `Đã nhắc ${n} người`)}>Nhắc lại</button>}
          </div>
        </div>
      )) : <div className="empty-list">Không có yêu cầu nào còn người chưa đóng.</div>}
    </div>
  );
}

/** Tab Quỹ đội (BRD 7.3): thành viên chỉ đọc, khách không thấy. */
export function FundView({ data }: { data: FundData }) {
  const { view, players, nameOf, canEdit, act, teamId, matchById } = useTeam();
  const [kind, setKind] = useState<'in' | 'out'>('out');
  const [openMatch, setOpenMatch] = useState<string | null>(null);
  const [armDel, setArmDel] = useState<string | null>(null);
  const now = new Date(view.now);
  const today = todayVN(now);
  const cm = data.month;
  const bal = balance(data.entries);
  const flow = monthFlow(data.entries, cm);
  const months = recentMonths(now, 4);
  const paid = (m: string, pid: string) => data.dues.some((d) => d.month === m && d.playerId === pid);
  const quy = players.filter((p) => p.payType === 'quy').sort((a, b) => (a.num ?? 99) - (b.num ?? 99));

  return (
    <section className="view">
      <div style={{ display: 'grid', gap: 16 }}>
        <h2 className="vt">Quỹ đội</h2>
        <div className="tiles">
          <div className="tile hl"><div className="k">Số dư quỹ</div><div className="v">{money(bal)}</div><div className="s">{data.entries.length} khoản thu chi</div></div>
          <div className="tile"><div className="k">Thu {monthLabel(cm)}</div><div className="v money-in">{money(flow.inflow)}</div><div className="s">Quỹ tháng, đá lẻ, khoản khác</div></div>
          <div className="tile"><div className="k">Chi {monthLabel(cm)}</div><div className="v money-out">{money(flow.outflow)}</div><div className="s">Tiền sân và mua sắm</div></div>
          <div className="tile">
            <div className="k">Còn phải thu</div><div className="v">{money(data.debts.total)}</div>
            <div className="owe">
              {data.debts.dues.map((id) => <span key={id} className="chip quy" data-tt={`Chưa đóng quỹ ${monthLabel(cm)}`} tabIndex={0}>{nameOf(id)}</span>)}
              {data.debts.le.map((t) => {
                const m = matchById(t.matchId);
                return <span key={t.matchId + t.playerId} className="chip le" data-tt={`Chưa trả đá lẻ vs ${m?.opponent ?? ''}`} tabIndex={0}>{nameOf(t.playerId)} · {m ? dm(m.date) : ''}</span>;
              })}
              {!data.debts.dues.length && !data.debts.le.length && <span className="s">Không ai nợ</span>}
            </div>
          </div>
        </div>

        <div className="panel">
          <h3 className="st">Mức đóng</h3>
          <form
            className="form-inline"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              act(() => setFeesAction(teamId, Number(f.get('monthly')) || 0, Number(f.get('match')) || 0), 'Đã lưu mức đóng');
            }}
          >
            <fieldset disabled={!canEdit} style={{ display: 'contents' }}>
              <div className="field" style={{ width: 170 }}><label htmlFor="feeMonth">Quỹ tháng / người</label><input id="feeMonth" name="monthly" type="number" min={0} step={10000} inputMode="numeric" defaultValue={data.monthlyFee} /></div>
              <div className="field" style={{ width: 170 }}><label htmlFor="feeMatch">Giá đá lẻ / trận</label><input id="feeMatch" name="match" type="number" min={0} step={5000} inputMode="numeric" defaultValue={data.perMatchFee} /></div>
              {canEdit && <button className="btn" type="submit">Lưu mức đóng</button>}
              {canEdit && (
                <label className="check" style={{ alignSelf: 'center' }} data-tt="Gửi thông báo ngày 5 hằng tháng cho thành viên quỹ chưa đóng (hạn trước ngày 10)">
                  <input type="checkbox" defaultChecked={data.duesReminder} onChange={(e) => act(() => setDuesReminderAction(teamId, e.target.checked), e.target.checked ? 'Đã bật nhắc đóng quỹ ngày 5' : 'Đã tắt nhắc đóng quỹ')} />
                  Nhắc đóng quỹ ngày 5
                </label>
              )}
            </fieldset>
          </form>
          <p className="hint">Thành viên <span className="chip quy">Quỹ</span> đóng theo tháng. Thành viên <span className="chip le">Đá lẻ</span> trả tiền theo từng trận có đi đá. Giá đá lẻ mới chỉ áp dụng cho các trận tạo sau.</p>
        </div>

        {canEdit && <PayRequests data={data} />}

        <div className="grid2">
          <div className="panel">
            <h3 className="st">Đóng quỹ tháng</h3>
            <div className="twrap">
              {quy.length ? (
                <table className="tbl dues">
                  <thead><tr><th>Số</th><th>Thành viên</th>{months.map((k) => <th key={k}>{monthLabel(k)}</th>)}</tr></thead>
                  <tbody>
                    {quy.map((p) => (
                      <tr key={p.id}>
                        <td>{p.num ?? ''}</td>
                        <td><span className="who"><Avatar p={p} size={24} />{shortName(p)}</span></td>
                        {months.map((k) => {
                          const on = paid(k, p.id);
                          return (
                            <td key={k}>
                              <button type="button" aria-pressed={on} disabled={!canEdit} aria-label={`${shortName(p)} ${monthLabel(k)}: ${on ? 'đã đóng' : 'chưa đóng'}`} onClick={() => act(() => setDuesAction(teamId, k, p.id, !on))}>{on ? '✓' : ''}</button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr><td /><td>Đã thu</td>{months.map((k) => <td key={k}>{money(data.dues.filter((d) => d.month === k).reduce((a, d) => a + d.amount, 0))}</td>)}</tr></tfoot>
                </table>
              ) : <div className="empty-list">Chưa có thành viên đóng quỹ tháng.</div>}
            </div>
          </div>
          <div className="panel">
            <h3 className="st">Tiền từng trận</h3>
            <div className="twrap">
              {data.matchMoney.length ? (
                <table className="tbl">
                  <thead><tr><th>Ngày</th><th>Trận</th><th>Tiền sân</th><th>Đá lẻ trả</th><th>Đã thu</th></tr></thead>
                  <tbody>
                    {data.matchMoney.map((m) => (
                      <tr key={m.id} style={{ cursor: 'pointer' }} onClick={() => setOpenMatch(m.id)}>
                        <td>{dm(m.date)}</td><td>vs {m.opponent}</td><td className="money-out">{money(-m.cost)}</td><td>{m.lePaid}/{m.leTotal}</td><td className="money-in">{money(m.lePaid * m.fee)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div className="empty-list">Chưa có trận đã đá.</div>}
            </div>
          </div>
        </div>

        <div className="panel">
          <h3 className="st">Sổ thu chi</h3>
          {canEdit && (
            <form
              className="form-inline"
              style={{ marginBottom: 12 }}
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const f = new FormData(form);
                const amount = Number(f.get('amount'));
                const r = await act(() => addEntryAction(teamId, { kind, amount, date: String(f.get('date')), note: String(f.get('note') ?? '') }), (kind === 'in' ? 'Đã ghi thu ' : 'Đã ghi chi ') + money(amount));
                if (r !== undefined) form.reset();
              }}
            >
              <div className="seg" role="group" aria-label="Loại">
                <button type="button" aria-pressed={kind === 'in'} onClick={() => setKind('in')}>Thu</button>
                <button type="button" aria-pressed={kind === 'out'} onClick={() => setKind('out')}>Chi</button>
              </div>
              <div className="field" style={{ width: 140 }}><label htmlFor="txAmt">Số tiền</label><input id="txAmt" name="amount" type="number" min={1} step={1000} inputMode="numeric" required placeholder="450000" /></div>
              <div className="field" style={{ flex: 1, minWidth: 180 }}><label htmlFor="txNote">Nội dung</label><input id="txNote" name="note" required maxLength={80} placeholder="VD: Mua bóng mới / Phạt đến muộn (Minh)" /></div>
              <div className="field" style={{ width: 150 }}><label htmlFor="txDate">Ngày</label><input id="txDate" name="date" type="date" required defaultValue={today} /></div>
              <button className="btn primary" type="submit">Ghi sổ</button>
            </form>
          )}
          <div className="twrap">
            {data.entries.length ? (
              <table className="tbl ledger">
                <thead><tr><th>Ngày</th><th>Nội dung</th><th>Nguồn</th><th>Số tiền</th><th /></tr></thead>
                <tbody>
                  {data.entries.map((x) => (
                    <tr key={x.id}>
                      <td>{dm(x.date)}</td>
                      <td style={{ whiteSpace: 'normal', minWidth: 160 }}>{x.note}</td>
                      <td><span className="chip">{FUND_SOURCE_LABEL[x.source as FundSource] ?? x.source}</span></td>
                      <td className={`amt ${x.amount >= 0 ? 'money-in' : 'money-out'}`}>{x.amount >= 0 ? '+' : ''}{money(x.amount)}</td>
                      <td>
                        {canEdit && x.source === 'manual' && (
                          <button type="button" className="btn ghost sm" aria-label={`Xoá khoản ${x.note}`} onClick={() => {
                            if (armDel !== x.id) {
                              setArmDel(x.id);
                              setTimeout(() => setArmDel(null), 2500);
                              return;
                            }
                            act(() => deleteEntryAction(teamId, x.id), 'Đã xoá khoản ghi tay');
                          }}>{armDel === x.id ? 'Xác nhận xoá' : 'Xoá'}</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <div className="empty-list">Sổ trống.</div>}
          </div>
        </div>
      </div>
      {openMatch && <MatchModal matchId={openMatch} initialTab="att" onClose={() => setOpenMatch(null)} />}
    </section>
  );
}
