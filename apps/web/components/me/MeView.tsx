'use client';

import { useState } from 'react';
import { ageOf, dm, money, monthLabel, playerSeason, rankedPositions, recentMonths, resultOf, shortName, todayVN, fmt1 } from '@san7/core';
import { useTeam } from '../TeamContext';
import { Avatar, tierColor } from '../ui';
import { Radar } from '../players/Radar';
import { usePlayerModal } from '../players/PlayersView';
import { MatchModal } from '../matches/MatchModal';
import { byKick, isPlayed, isSettled, seasonOf } from '@/lib/season';
import { setAttendanceAction } from '@/app/actions';
import { PushPrompt } from '../Pwa';

/** Màn Của tôi (BRD 8.4). */
export function MeView({ duesMonths }: { duesMonths: string[] }) {
  const { view, byId, canEdit, act, teamId } = useTeam();
  const me = byId(view.myPlayerId);
  const modal = usePlayerModal();
  const [open, setOpen] = useState<{ id: string; tab: 'att' | 'res' } | null>(null);
  if (!me) return <section className="view"><div className="empty-list">Bạn chưa có hồ sơ cầu thủ trong đội này.</div></section>;
  const now = new Date(view.now);
  const today = todayVN(now);
  const se = playerSeason(seasonOf(view.matches), view.year, me.id);
  const a = ageOf(me.dob, now);
  const rk = rankedPositions(me.stats, me.foot).filter(([k, v]) => !(k === 'GK' && v < 6)).slice(0, 3);
  const yearM = [...view.matches].filter((m) => m.date.startsWith(String(view.year))).sort(byKick);
  const done = yearM.filter((m) => isSettled(m, today));
  const went = done.filter((m) => m.attendance[me.id]?.status === 'di');
  const rate = done.length ? Math.round((went.length / done.length) * 100) : 0;
  const nextOpen = yearM.find((m) => !isSettled(m, today) && m.voteState === 'open' && !m.attendance[me.id]);
  const paidSet = new Set(duesMonths);
  const fee = view.team.monthlyFee ?? 0;

  return (
    <section className="view">
      <div style={{ display: 'grid', gap: 16 }}>
        <div className="panel mehead">
          <Avatar p={me} size={72} />
          <div style={{ minWidth: 0 }}>
            <div className="muted" style={{ fontSize: 12 }}>{view.team.name} · {canEdit ? 'Đội trưởng' : 'Thành viên'}</div>
            <h2>{shortName(me)}{se.mvp > 0 && <> <span className="mvpt" style={{ fontSize: 22 }}>★{se.mvp}</span></>}</h2>
            <div className="muted" style={{ fontSize: 13 }}>
              {me.fullName}{me.num != null ? ' · số ' + me.num : ''}{a != null ? ` · ${a} tuổi` : ''} · <span className={`chip ${me.payType}`}>{me.payType === 'le' ? 'Đá lẻ' : 'Quỹ'}</span>
            </div>
          </div>
          <button type="button" className="btn primary sm" onClick={() => modal.open(me.id)}>{canEdit ? 'Sửa hồ sơ' : 'Cập nhật hồ sơ & chỉ số'}</button>
          {view.myPendingEdit && <p className="note" style={{ gridColumn: '1/-1', margin: 0 }}><span className="chip le">Đang chờ duyệt</span> Bản cập nhật hồ sơ của bạn đang chờ đội trưởng duyệt.</p>}
        </div>

        <PushPrompt />
        {nextOpen && (
          <div className="note" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>Bạn chưa điểm danh trận <b>vs {nextOpen.opponent}</b> ({dm(nextOpen.date)}{nextOpen.time ? ' ' + nextOpen.time : ''}).</span>
            <button type="button" className="btn primary sm" onClick={() => act(() => setAttendanceAction(teamId, nextOpen.id, me.id, 'di'), `Đã điểm danh: bạn ĐI trận vs ${nextOpen.opponent}`)}>Đi</button>
            <button type="button" className="btn sm" onClick={() => act(() => setAttendanceAction(teamId, nextOpen.id, me.id, 'nghi'), `Đã báo nghỉ trận vs ${nextOpen.opponent}`)}>Nghỉ</button>
          </div>
        )}

        <div className="tiles">
          <div className="tile hl"><div className="k">Tham gia {view.year}</div><div className="v">{went.length}<small> / {done.length} trận</small></div><div className="s">{rate}% số trận đã đá</div></div>
          <div className="tile"><div className="k">Bàn thắng</div><div className="v">{se.goals}</div><div className="s">{se.gp ? (se.goals / se.gp).toFixed(2) + ' bàn/trận' : 'Chưa ra sân'}</div></div>
          <div className="tile"><div className="k">Kiến tạo</div><div className="v">{se.assists}</div><div className="s">Bàn + kiến tạo: {se.ga}</div></div>
          <div className="tile"><div className="k">MVP {view.year}</div><div className="v">{se.mvp ? '★ ' + se.mvp : '0'}</div><div className="s">Tính lại từ đầu vào 1/1 năm sau</div></div>
        </div>

        <div className="grid3">
          <div className="panel">
            <h3 className="st">Chỉ số</h3>
            <div className="radar"><Radar stats={me.stats} /></div>
            <div className="pc-pos" style={{ marginTop: 8 }}>
              {rk.map(([k, v], i) => <span key={k} className={`pchip${i === 0 ? ' best' : ''}`} tabIndex={0} data-x={`p:${me.id}:${k}`} style={{ ['--fit' as string]: tierColor(v) }}><b>{k}</b><em>{fmt1(v)}</em></span>)}
            </div>
          </div>
          <div className="panel span2">
            <h3 className="st">Trận đấu {view.year}</h3>
            <div className="twrap">
              <table className="tbl">
                <thead><tr><th>Ngày</th><th>Trận</th><th>Kết quả</th><th>Vote</th><th>Bàn</th><th>KT</th><th /></tr></thead>
                <tbody>
                  {yearM.length ? [...yearM].reverse().map((m) => {
                    const st = m.attendance[me.id]?.status;
                    const e = m.events[me.id] ?? { goals: 0, assists: 0 };
                    const c = m.claims.find((x) => x.playerId === me.id);
                    const r = isPlayed(m) ? resultOf(m) : null;
                    const settled = isSettled(m, today);
                    return (
                      <tr key={m.id} style={{ cursor: 'pointer' }} onClick={() => setOpen({ id: m.id, tab: settled ? 'res' : 'att' })}>
                        <td>{dm(m.date)}</td>
                        <td>vs {m.opponent}</td>
                        <td>{r ? <>{m.scoreUs}–{m.scoreThem} <span className={`chip ${r === 'T' ? 'win' : r === 'B' ? 'loss' : ''}`}>{r}</span></> : settled ? '–' : 'Sắp tới'}</td>
                        <td>{st === 'di' ? 'Đi' : st === 'nghi' ? 'Nghỉ' : '—'}</td>
                        <td>{e.goals}</td>
                        <td>{e.assists}</td>
                        <td>
                          {m.mvpPlayerId === me.id && <span className="mvpt">★ MVP</span>}
                          {c?.status === 'pending' && <> <span className="chip le">chờ duyệt</span></>}
                          {settled && st === 'di' && !canEdit && c?.status !== 'pending' && <button type="button" className="btn ghost sm" onClick={(ev) => { ev.stopPropagation(); setOpen({ id: m.id, tab: 'res' }); }}>Khai báo</button>}
                        </td>
                      </tr>
                    );
                  }) : <tr><td colSpan={7}>Chưa có trận</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="hint">Chạm một trận để vote đi/nghỉ, khai báo bàn thắng hoặc vote MVP.</p>
          </div>
        </div>

        <div className="panel">
          <h3 className="st">Lịch sử đóng tiền · {me.payType === 'le' ? 'Đá lẻ' : 'Quỹ tháng'}</h3>
          <div className="twrap">
            {me.payType === 'quy' ? (
              <>
                <div className="months">
                  {recentMonths(now, 6).map((k) => (
                    <span key={k} className={paidSet.has(k) ? 'ok' : ''}>{monthLabel(k)}<br />{paidSet.has(k) ? 'Đã đóng' : 'Chưa đóng'}</span>
                  ))}
                </div>
                <p className="hint">Mức quỹ {money(fee)}/tháng. {paidSet.has(today.slice(0, 7)) ? 'Tháng này bạn đã đóng.' : `Tháng này bạn còn ${money(fee)} chưa đóng.`}</p>
              </>
            ) : (
              (() => {
                const L = [...view.matches].filter((m) => isSettled(m, today) && m.attendance[me.id]?.status === 'di').sort(byKick).reverse();
                const owe = L.filter((m) => !m.attendance[me.id]?.lePaid);
                return (
                  <>
                    <table className="tbl">
                      <thead><tr><th>Ngày</th><th>Trận</th><th>Tiền</th><th>Trạng thái</th></tr></thead>
                      <tbody>
                        {L.length ? L.map((m) => (
                          <tr key={m.id}><td>{dm(m.date)}</td><td>vs {m.opponent}</td><td>{money(m.fee ?? 0)}</td><td>{m.attendance[me.id]?.lePaid ? <span className="chip quy">Đã trả</span> : <span className="chip loss">Chưa trả</span>}</td></tr>
                        )) : <tr><td colSpan={4}>Chưa đá trận nào</td></tr>}
                      </tbody>
                    </table>
                    <p className="hint">{owe.length ? `Còn nợ ${money(owe.reduce((s, m) => s + (m.fee ?? 0), 0))} cho ${owe.length} trận.` : 'Không còn nợ trận nào.'}</p>
                  </>
                );
              })()
            )}
          </div>
        </div>
      </div>
      {modal.node}
      {open && <MatchModal matchId={open.id} initialTab={open.tab} onClose={() => setOpen(null)} />}
    </section>
  );
}
