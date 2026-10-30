'use client';

import { useMemo, useState } from 'react';
import { mvpQuorum, money, nextHomeDay, shortName, todayVN } from '@san7/core';
import { useTeam } from '../TeamContext';
import { Avatar, Modal, Tabs, Tip } from '../ui';
import {
  assignMvpAction, castBallotAction, decideClaimAction, deleteMatchAction, openMvpAction, remindVoteAction, saveMatchAction,
  requestLeAction, saveResultAction, setAttendanceAction, setLePaidAction, setVoteStateAction, submitClaimAction,
} from '@/app/actions';
import { isSettled } from '@/lib/season';
import type { MatchDTO, PlayerDTO } from '@/lib/types';

type Tab = 'info' | 'att' | 'res';

/** Modal trận 3 tab: Thông tin · Điểm danh & tiền · Kết quả (BRD 6.2–6.6). */
export function MatchModal({ matchId, initialTab, onClose }: { matchId: string | null; initialTab?: Tab; onClose: () => void }) {
  const { view, matchById, canEdit, act, teamId } = useTeam();
  const [createdId, setCreatedId] = useState<string | null>(null);
  const m = matchById(matchId ?? createdId);
  const today = todayVN(new Date(view.now));
  const [tab, setTab] = useState<Tab>(m ? initialTab ?? (isSettled(m, today) ? 'res' : 'att') : 'info');
  const [armDel, setArmDel] = useState(false);

  return (
    <Modal
      title={m ? `vs ${m.opponent}` : 'Tạo trận'}
      onClose={onClose}
      wide={680}
      tabs={<Tabs<Tab> value={tab} onChange={(t) => m && setTab(t)} items={[['info', 'Thông tin'], ['att', 'Điểm danh & tiền', !m], ['res', 'Kết quả', !m]]} />}
      footer={
        <>
          {m && canEdit && (
            <button className="btn danger ghost" type="button" onClick={async () => {
              if (!armDel) {
                setArmDel(true);
                setTimeout(() => setArmDel(false), 2500);
                return;
              }
              const r = await act(() => deleteMatchAction(teamId, m.id), 'Đã xoá trận');
              if (r !== undefined) onClose();
            }}>{armDel ? 'Bấm lần nữa để xoá' : 'Xoá trận'}</button>
          )}
          <button className="btn primary" type="button" style={{ marginLeft: 'auto' }} onClick={onClose}>Xong</button>
        </>
      }
    >
      {tab === 'info' && <InfoTab m={m} onCreated={(id) => { setCreatedId(id); setTab('att'); }} />}
      {tab === 'att' && m && <AttTab m={m} />}
      {tab === 'res' && m && <ResTab m={m} />}
    </Modal>
  );
}

function InfoTab({ m, onCreated }: { m: MatchDTO | undefined; onCreated: (id: string) => void }) {
  const { view, canEdit, act, teamId } = useTeam();
  const t = view.team;
  const [openVote, setOpenVote] = useState(true);
  const d = m ?? {
    opponent: '', type: 'Giao hữu', date: nextHomeDay(t.homeDays, new Date(view.now)), time: t.homeFrom ?? '19:30', venue: t.homeName ?? '',
    cost: t.homeCost || 0, fee: t.perMatchFee ?? 0, note: '',
  };
  return (
    <form
      className="fgrid"
      autoComplete="off"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const s = (k: string) => String(f.get(k) ?? '').trim();
        const input = {
          opponent: s('opponent'), type: s('type'), date: s('date'), time: s('time') || null, venue: s('venue') || null,
          cost: Number(s('cost')) || 0, fee: Number(s('fee')) || 0, note: s('note') || null, openVote,
        };
        const id = await act(() => saveMatchAction(teamId, m?.id ?? null, input), m ? 'Đã lưu trận' : 'Đã tạo trận, điểm danh nào');
        if (id && !m) onCreated(id);
      }}
    >
      <fieldset disabled={!canEdit} style={{ display: 'contents' }}>
        <div className="field c4"><label htmlFor="mOpp">Đối thủ</label><input id="mOpp" name="opponent" maxLength={60} required defaultValue={d.opponent} placeholder="VD: FC Cầu Giấy" /></div>
        <div className="field c2"><label htmlFor="mType">Loại trận</label><select id="mType" name="type" defaultValue={d.type}><option>Giao hữu</option><option>Giải đấu</option><option>Nội bộ</option></select></div>
        <div className="field c2 h3"><label htmlFor="mDate">Ngày</label><input id="mDate" name="date" type="date" required defaultValue={d.date} /></div>
        <div className="field c2 h3"><label htmlFor="mTime">Giờ đá</label><input id="mTime" name="time" type="time" defaultValue={d.time ?? ''} /></div>
        <div className="field c2"><label htmlFor="mVenue">Sân</label><input id="mVenue" name="venue" maxLength={60} defaultValue={d.venue ?? ''} /></div>
        <div className="field c3"><label htmlFor="mCost">Tiền sân + nước (đ)</label><input id="mCost" name="cost" type="number" min={0} step={10000} inputMode="numeric" defaultValue={d.cost ?? 0} /></div>
        <div className="field c3"><label htmlFor="mFee">Giá đá lẻ trận này (đ)</label><input id="mFee" name="fee" type="number" min={0} step={5000} inputMode="numeric" defaultValue={d.fee ?? 0} /></div>
        <div className="field c6"><label htmlFor="mNote">Ghi chú</label><input id="mNote" name="note" maxLength={200} defaultValue={d.note ?? ''} placeholder="VD: Mặc áo vàng, có mặt trước 15 phút" /></div>
        {!m && <div className="c6"><label className="check"><input type="checkbox" checked={openVote} onChange={(e) => setOpenVote(e.target.checked)} /> Mở vote tham gia và gửi thông báo cho thành viên</label></div>}
        {canEdit && <div className="c6"><button className="btn primary" type="submit">{m ? 'Lưu thông tin' : 'Tạo trận và điểm danh'}</button></div>}
      </fieldset>
    </form>
  );
}

function AttTab({ m }: { m: MatchDTO }) {
  const { view, players, canEdit, act, teamId } = useTeam();
  const today = todayVN(new Date(view.now));
  const settled = isSettled(m, today);
  const open = m.voteState === 'open' && !settled;
  const meId = view.myPlayerId;
  const ps = [...players].sort((a, b) => (a.num ?? 99) - (b.num ?? 99));
  const st = (id: string) => m.attendance[id]?.status;
  const di = ps.filter((p) => st(p.id) === 'di');
  const ng = ps.filter((p) => st(p.id) === 'nghi');
  const le = di.filter((p) => p.payType === 'le');
  const paid = le.filter((p) => m.attendance[p.id]?.lePaid);
  const vs = settled ? <span className="chip">Trận đã qua</span> : m.voteState === 'open' ? <span className="chip quy">Vote đang mở</span> : m.voteState === 'closed' ? <span className="chip loss">Vote đã đóng</span> : <span className="chip">Chưa mở vote</span>;
  const vote = (p: PlayerDTO, a: 'di' | 'nghi') => {
    const next = st(p.id) === a ? null : a;
    act(() => setAttendanceAction(teamId, m.id, p.id, next), p.id === meId ? (next ? `Đã điểm danh: bạn ${next === 'di' ? 'ĐI' : 'NGHỈ'} trận vs ${m.opponent}` : 'Đã bỏ chọn') : undefined);
  };
  return (
    <div>
      <div className="attsum">
        {vs}
        <span><b>{di.length}</b> đi</span><span><b>{ng.length}</b> nghỉ</span><span><b>{ps.length - di.length - ng.length}</b> chưa trả lời</span>
        {canEdit && <span>Đá lẻ đã trả <b>{paid.length}/{le.length}</b> · {money(paid.length * (m.fee ?? 0))}</span>}
        {canEdit && !settled && (
          <span className="row-actions" style={{ marginLeft: 'auto' }}>
            <button type="button" className="btn sm" onClick={() => act(() => setVoteStateAction(teamId, m.id, m.voteState === 'open' ? 'closed' : 'open'), m.voteState === 'open' ? 'Đã đóng vote' : 'Đã mở vote')}>
              {m.voteState === 'open' ? 'Đóng vote' : m.voteState ? 'Mở lại vote' : 'Mở vote và thông báo'}
            </button>
            {open && <button type="button" className="btn ghost sm" onClick={() => act(() => remindVoteAction(teamId, m.id), (n) => `Đã nhắc ${n} người`)}>Nhắc người chưa vote</button>}
            <Tip text="Đội trưởng có thể đổi vote của bất kỳ ai khi cần (dòng đó sẽ ghi “đội trưởng chỉnh”)." />
          </span>
        )}
        {!canEdit && meId && <span className="hint" style={{ margin: 0, flexBasis: '100%' }}>{open ? 'Chọn Đi hoặc Nghỉ ở dòng của bạn.' : 'Vote đang đóng. Cần đổi thì báo đội trưởng.'}</span>}
      </div>
      <div style={{ marginTop: 8 }}>
        {ps.length ? ps.map((p) => {
          const a = m.attendance[p.id];
          const mine = p.id === meId;
          const can = canEdit || (mine && open);
          const isLe = p.payType === 'le';
          return (
            <div key={p.id} className={`arow${mine ? ' mine' : ''}`}>
              <Avatar p={p} size={34} />
              <div className="n">
                {p.num != null ? `#${p.num} ` : ''}{shortName(p)}{mine && <> <span className="chip le">Bạn</span></>}
                <small>{isLe ? `Đá lẻ · ${money(m.fee ?? 0)}/trận` : 'Đóng quỹ tháng'}{a?.byCaptain ? ' · đội trưởng chỉnh' : ''}</small>
              </div>
              <div className="ctl">
                {canEdit && isLe && a?.status === 'di' && (
                  <button type="button" className="paybtn" aria-pressed={a.lePaid} onClick={() => act(() => setLePaidAction(teamId, m.id, p.id, !a.lePaid))}>
                    {a.lePaid ? `Đã trả ${money(m.fee ?? 0)}` : 'Chưa trả'}
                  </button>
                )}
                <div className="seg" role="group" aria-label={`Điểm danh ${shortName(p)}`}>
                  <button type="button" aria-pressed={a?.status === 'di'} disabled={!can} onClick={() => vote(p, 'di')}>Đi</button>
                  <button type="button" aria-pressed={a?.status === 'nghi'} disabled={!can} onClick={() => vote(p, 'nghi')}>Nghỉ</button>
                </div>
              </div>
            </div>
          );
        }) : <div className="empty-list">Đội chưa có cầu thủ.</div>}
      </div>
    </div>
  );
}

function Step({ label, value, onChange, name }: { label: string; value: number; onChange: (v: number) => void; name: string }) {
  return (
    <div>
      <div className="step-lbl">{label}</div>
      <span className="step">
        <button type="button" onClick={() => onChange(Math.max(0, value - 1))} aria-label={`Bớt ${label.toLowerCase()} của ${name}`}>−</button>
        <b>{value}</b>
        <button type="button" onClick={() => onChange(value + 1)} aria-label={`Thêm ${label.toLowerCase()} cho ${name}`}>+</button>
      </span>
    </div>
  );
}

function ResTab({ m }: { m: MatchDTO }) {
  const { view, players, byId, nameOf, canEdit, act, teamId } = useTeam();
  const goingList = players.filter((p) => m.attendance[p.id]?.status === 'di');
  const list = (goingList.length ? goingList : players).slice().sort((a, b) => (a.num ?? 99) - (b.num ?? 99));
  const [score, setScore] = useState({ us: m.scoreUs ?? 0, them: m.scoreThem ?? 0 });
  const [ev, setEv] = useState<Record<string, { goals: number; assists: number }>>(m.events);
  const dirty = score.us !== (m.scoreUs ?? 0) || score.them !== (m.scoreThem ?? 0) || JSON.stringify(ev) !== JSON.stringify(m.events) || m.scoreUs == null;
  const g = Object.values(ev).reduce((a, e) => a + e.goals, 0);
  const asg = Object.values(ev).reduce((a, e) => a + e.assists, 0);
  const setE = (id: string, k: 'goals' | 'assists', v: number) => setEv((x) => ({ ...x, [id]: { ...(x[id] ?? { goals: 0, assists: 0 }), [k]: v } }));

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="scorebox">
        {canEdit ? (
          <>
            <div className="team">{view.team.name}<div className="big-step"><button type="button" onClick={() => setScore((s) => ({ ...s, us: Math.max(0, s.us - 1) }))} aria-label={`Bớt 1 bàn cho ${view.team.name}`}>−</button><b>{score.us}</b><button type="button" onClick={() => setScore((s) => ({ ...s, us: s.us + 1 }))} aria-label={`Thêm 1 bàn cho ${view.team.name}`}>+</button></div></div>
            <div className="muted" style={{ fontFamily: 'var(--f-display)', fontSize: 22 }}>–</div>
            <div className="team">{m.opponent}<div className="big-step"><button type="button" onClick={() => setScore((s) => ({ ...s, them: Math.max(0, s.them - 1) }))} aria-label={`Bớt 1 bàn cho ${m.opponent}`}>−</button><b>{score.them}</b><button type="button" onClick={() => setScore((s) => ({ ...s, them: s.them + 1 }))} aria-label={`Thêm 1 bàn cho ${m.opponent}`}>+</button></div></div>
          </>
        ) : m.scoreUs != null ? (
          <>
            <div className="team">{view.team.name}<div className="big-step"><b>{m.scoreUs}</b></div></div>
            <div className="muted" style={{ fontFamily: 'var(--f-display)', fontSize: 22 }}>–</div>
            <div className="team">{m.opponent}<div className="big-step"><b>{m.scoreThem}</b></div></div>
          </>
        ) : <p className="hint" style={{ margin: 0 }}>Trận chưa có kết quả.</p>}
      </div>

      <ClaimBox m={m} />
      <LeRequestBox m={m} />

      <div>
        <div className="sec-title" style={{ marginBottom: 4 }}>
          Bàn thắng, kiến tạo{' '}
          <span className="warn">
            {canEdit && g !== score.us ? `Tổng bàn cá nhân là ${g}, tỉ số là ${score.us}. Có thể có bàn phản lưới. ` : ''}
            {canEdit && asg > g ? 'Tổng kiến tạo nhiều hơn tổng bàn.' : ''}
          </span>
        </div>
        {canEdit ? (
          <>
            {!goingList.length && <p className="hint" style={{ margin: '0 0 6px' }}>Chưa điểm danh nên đang hiện cả đội.</p>}
            {list.map((p) => {
              const e = ev[p.id] ?? { goals: 0, assists: 0 };
              return (
                <div key={p.id} className="arow">
                  <Avatar p={p} size={34} />
                  <div className="n">{shortName(p)}<small>{p.num != null ? '#' + p.num : ''}</small></div>
                  <div className="ctl">
                    <Step label="Bàn" name={shortName(p)} value={e.goals} onChange={(v) => setE(p.id, 'goals', v)} />
                    <Step label="Kiến tạo" name={shortName(p)} value={e.assists} onChange={(v) => setE(p.id, 'assists', v)} />
                    {m.scoreUs != null && m.attendance[p.id]?.status === 'di' && (
                      <div><div className="step-lbl">&nbsp;</div><button type="button" className="mvp" aria-pressed={m.mvpPlayerId === p.id} aria-label={`Chọn ${shortName(p)} là MVP`} onClick={() => act(() => assignMvpAction(teamId, m.id, p.id), `Đã chỉ định MVP: ${shortName(p)}`)}>MVP</button></div>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="row-actions" style={{ marginTop: 10 }}>
              <button type="button" className="btn primary" disabled={!dirty} onClick={() => act(() => saveResultAction(teamId, m.id, {
                scoreUs: score.us, scoreThem: score.them, events: Object.entries(ev).map(([playerId, e]) => ({ playerId, ...e })),
              }), 'Đã lưu kết quả')}>Lưu kết quả</button>
              {m.scoreUs != null && (
                <button type="button" className="btn ghost" onClick={() => act(() => saveResultAction(teamId, m.id, { scoreUs: null, scoreThem: null, events: [] }), 'Đã xoá kết quả')}>Xoá kết quả (trận chưa đá)</button>
              )}
            </div>
          </>
        ) : (
          (() => {
            const L = m.scoreUs != null ? players.filter((p) => m.events[p.id] || m.mvpPlayerId === p.id) : [];
            return L.length ? L.map((p) => {
              const e = m.events[p.id] ?? { goals: 0, assists: 0 };
              return (
                <div key={p.id} className="arow">
                  <Avatar p={p} size={34} />
                  <div className="n">{shortName(p)}<small>{[e.goals ? e.goals + ' bàn' : '', e.assists ? e.assists + ' kiến tạo' : ''].filter(Boolean).join(' · ')}</small></div>
                  <div className="ctl">{m.mvpPlayerId === p.id && <span className="tier ex">★ MVP</span>}</div>
                </div>
              );
            }) : <p className="hint" style={{ margin: 0 }}>Chưa có bàn thắng nào được ghi nhận.</p>;
          })()
        )}
      </div>
      <MvpBox m={m} />
    </div>
  );
}

/** Sau khi có tỉ số: ĐT chốt tiền đá lẻ trận này và gửi yêu cầu trả cho người đá lẻ có Đi. */
function LeRequestBox({ m }: { m: MatchDTO }) {
  const { players, canEdit, act, teamId } = useTeam();
  const [amount, setAmount] = useState(m.fee ?? 0);
  if (!canEdit || m.scoreUs == null) return null;
  const le = players.filter((p) => p.payType === 'le' && m.attendance[p.id]?.status === 'di');
  if (!le.length) return null;
  const unpaid = le.filter((p) => !m.attendance[p.id]?.lePaid);
  return (
    <div className="note" style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <span style={{ flexBasis: '100%' }}>
        Tiền đá lẻ trận này: <b>{le.length - unpaid.length}/{le.length}</b> người đã trả.
        {unpaid.length ? ' Nhập số tiền mỗi người rồi gửi yêu cầu, anh em sẽ nhận thông báo và bấm "Tôi đã đóng" khi chuyển xong.' : ' Đã thu đủ.'}
      </span>
      {unpaid.length > 0 && (
        <>
          <div className="field" style={{ width: 160, margin: 0 }}>
            <label htmlFor="leAmt">Số tiền / người (đ)</label>
            <input id="leAmt" type="number" min={0} step={5000} inputMode="numeric" value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} />
          </div>
          <button type="button" className="btn primary sm" disabled={!amount} onClick={() => act(() => requestLeAction(teamId, m.id, amount), (n) => `Đã gửi yêu cầu trả ${money(amount)} cho ${n} người`)}>
            Gửi yêu cầu trả tiền ({unpaid.length} người)
          </button>
        </>
      )}
    </div>
  );
}

function ClaimBox({ m }: { m: MatchDTO }) {
  const { view, byId, nameOf, canEdit, act, teamId } = useTeam();
  const me = byId(view.myPlayerId);
  const today = todayVN(new Date(view.now));
  const mine = me ? m.claims.find((c) => c.playerId === me.id) : undefined;
  const cur = me ? m.events[me.id] ?? { goals: 0, assists: 0 } : { goals: 0, assists: 0 };
  const [draft, setDraft] = useState(mine?.status === 'pending' ? { goals: mine.goals, assists: mine.assists } : cur);
  const canClaim = !!me && !canEdit && m.attendance[me.id]?.status === 'di' && isSettled(m, today);
  const pend = canEdit ? m.claims.filter((c) => c.status === 'pending') : [];
  if (!canClaim && !pend.length) return null;
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {canClaim && me && (
        <div className="box">
          <h4>Khai báo của tôi</h4>
          <div className="arow" style={{ border: 0, padding: 0 }}>
            <Avatar p={me} size={34} />
            <div className="n">{shortName(me)}<small>Đang ghi nhận: {cur.goals} bàn, {cur.assists} kiến tạo</small></div>
            <div className="ctl">
              <Step label="Bàn" name="bạn" value={draft.goals} onChange={(v) => setDraft((d) => ({ ...d, goals: v }))} />
              <Step label="Kiến tạo" name="bạn" value={draft.assists} onChange={(v) => setDraft((d) => ({ ...d, assists: v }))} />
            </div>
          </div>
          <div className="row-actions">
            {mine && (mine.status === 'pending' ? <span className="chip le">Đang chờ duyệt: {mine.goals} bàn, {mine.assists} KT</span> : mine.status === 'approved' ? <span className="chip quy">Đã được duyệt</span> : <span className="chip loss">Bị từ chối, có thể khai lại</span>)}
            <button type="button" className="btn primary sm" style={{ marginLeft: 'auto' }} onClick={() => act(() => submitClaimAction(teamId, m.id, draft.goals, draft.assists), 'Đã gửi đội trưởng duyệt')}>Gửi đội trưởng duyệt</button>
          </div>
        </div>
      )}
      {pend.length > 0 && (
        <div className="box">
          <h4>Khai báo chờ duyệt</h4>
          {pend.map((c) => {
            const e = m.events[c.playerId] ?? { goals: 0, assists: 0 };
            return (
              <div key={c.id} className="arow">
                <div className="n">{nameOf(c.playerId)}<small>Hiện ghi {e.goals} bàn, {e.assists} KT → khai {c.goals} bàn, {c.assists} KT</small></div>
                <div className="ctl">
                  <button type="button" className="btn ghost sm" onClick={() => act(() => decideClaimAction(teamId, c.id, false), 'Đã từ chối khai báo')}>Từ chối</button>
                  <button type="button" className="btn primary sm" onClick={() => act(() => decideClaimAction(teamId, c.id, true), 'Đã duyệt khai báo')}>Duyệt</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MvpBox({ m }: { m: MatchDTO }) {
  const { view, players, byId, nameOf, canEdit, act, teamId } = useTeam();
  const today = todayVN(new Date(view.now));
  const parts = useMemo(() => players.filter((p) => m.attendance[p.id]?.status === 'di'), [players, m.attendance]);
  if (!isSettled(m, today) || m.scoreUs == null) return null;
  const v = m.mvpVote;
  const N = parts.length;
  const need = mvpQuorum(N);
  const me = byId(view.myPlayerId);
  const cur = m.mvpPlayerId;
  const left = v ? Math.max(0, new Date(v.closesAt).getTime() - new Date(view.now).getTime()) : 0;
  return (
    <div className="box">
      <h4>MVP trận</h4>
      {cur && (
        <div className="row-actions">
          <span className="tier ex">★</span><b>{nameOf(cur)}</b>
          <span className="muted" style={{ fontSize: 12.5 }}>{v?.decidedBy === 'vote' ? 'theo kết quả vote' : 'do đội trưởng chỉ định'}</span>
        </div>
      )}
      {!v ? (
        canEdit ? (
          !cur && (
            <>
              <p className="hint" style={{ margin: 0 }}>Mở vote để {N} người đá trận này bầu MVP trong 24 giờ. Kết quả hợp lệ khi có ít nhất {need} phiếu (60% số người đá). Hoặc chỉ định trực tiếp bằng nút MVP ở danh sách trên.</p>
              <button type="button" className="btn primary sm" style={{ justifySelf: 'start' }} onClick={() => act(() => openMvpAction(teamId, m.id), 'Đã mở vote MVP, hạn 24 giờ')}>Mở vote MVP (24 giờ)</button>
            </>
          )
        ) : !cur && <p className="hint" style={{ margin: 0 }}>Trận này chưa có vote MVP.</p>
      ) : (
        <>
          {v.status === 'open' && (
            <>
              <div className="muted" style={{ fontSize: 12.5 }}>Đang vote · còn {Math.floor(left / 3600e3)} giờ {Math.floor((left % 3600e3) / 60e3)} phút · {v.ballots}/{N} phiếu (cần ít nhất {need})</div>
              {me && m.attendance[me.id]?.status === 'di' ? (
                <>
                  <div className="sec-title">Phiếu của bạn{v.myBallot ? ' · có thể đổi đến khi hết hạn' : ''}</div>
                  <div className="cands">
                    {parts.filter((p) => p.id !== me.id).map((p) => (
                      <button key={p.id} type="button" aria-pressed={v.myBallot === p.id} onClick={() => act(() => castBallotAction(teamId, m.id, p.id), `Đã bầu ${shortName(p)}`)}>{shortName(p)}</button>
                    ))}
                  </div>
                </>
              ) : !canEdit && <p className="hint" style={{ margin: 0 }}>Chỉ người đá trận này mới được vote.</p>}
            </>
          )}
          {v.status === 'need' && (
            <p className="warn" style={{ margin: 0 }}>
              Vote đã đóng nhưng chưa đủ điều kiện ({v.ballots}/{N} phiếu, cần {need}, hoặc hoà phiếu). {canEdit ? 'Hãy chỉ định MVP bằng nút MVP ở danh sách trên.' : 'Đang chờ đội trưởng chỉ định.'}
            </p>
          )}
          {v.tally ? (
            v.tally.length ? v.tally.map(([pid, c]) => (
              <div key={pid} className="vbar"><span>{nameOf(pid)}</span><span className="pb"><i style={{ width: `${(c / Math.max(1, v.ballots)) * 100}%` }} /></span><b>{c}</b></div>
            )) : <p className="hint" style={{ margin: 0 }}>Chưa có phiếu nào.</p>
          ) : null}
          {v.status === 'open' && (
            <p className="hint" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Tip text="Chỉ đội trưởng thấy số phiếu khi vote còn mở." />Phiếu đang ẩn
            </p>
          )}
        </>
      )}
    </div>
  );
}
