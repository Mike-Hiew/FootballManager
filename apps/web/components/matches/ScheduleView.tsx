'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { DAY_SHORT, dayOfWeek, money, resultOf, todayVN } from '@san7/core';
import { useTeam } from '../TeamContext';
import { MatchModal } from './MatchModal';
import { byKick, isPlayed, isSettled } from '@/lib/season';
import type { MatchDTO } from '@/lib/types';

/** Tab Lịch đấu (BRD 6.2). */
export function ScheduleView({ openId, openTab }: { openId?: string; openTab?: 'info' | 'att' | 'res' }) {
  const { view, players, canEdit, nameOf } = useTeam();
  const router = useRouter();
  const today = todayVN(new Date(view.now));
  const [modal, setModal] = useState<{ id: string | null; tab?: 'info' | 'att' | 'res' } | null>(openId ? { id: openId, tab: openTab } : null);
  const years = useMemo(() => [...new Set(view.matches.filter((m) => isSettled(m, today)).map((m) => Number(m.date.slice(0, 4))))].sort((a, b) => b - a), [view.matches, today]);
  const [year, setYear] = useState<number>(view.year);
  const all = [...view.matches].sort(byKick);
  const up = all.filter((m) => !isSettled(m, today));
  const past = all.filter((m) => isSettled(m, today) && m.date.startsWith(String(year))).reverse();
  const me = view.myPlayerId;

  const card = (m: MatchDTO, next = false) => {
    const [, mo, d] = m.date.split('-').map(Number);
    const ac = Object.values(m.attendance);
    const di = ac.filter((a) => a.status === 'di').length;
    const ng = ac.filter((a) => a.status === 'nghi').length;
    const un = Math.max(0, players.length - di - ng);
    let res: React.ReactNode;
    if (isPlayed(m)) {
      const r = resultOf(m);
      res = (
        <>
          <span className="score">{m.scoreUs}–{m.scoreThem}</span>
          {/* ★ MVP (BRD 6.2) đặt cùng hàng với chip kết quả để giữ chiều cao thẻ như prototype */}
          <span>
            {m.mvpPlayerId && <span className="mvpt" style={{ fontSize: 11.5, marginRight: 6 }}>★ {nameOf(m.mvpPlayerId)}</span>}
            <span className={`chip ${r === 'T' ? 'win' : r === 'B' ? 'loss' : ''}`}>{r === 'T' ? 'Thắng' : r === 'B' ? 'Thua' : 'Hoà'}</span>
          </span>
        </>
      );
    } else if (m.date < today) res = <span className="chip loss">Chưa nhập kết quả</span>;
    else {
      res = (
        <>
          {/* trạng thái vote (BRD 6.2) gộp vào chip số người để giữ bố cục prototype */}
          <span className={`chip ${m.voteState === 'open' ? 'quy' : ''}`} data-tt={m.voteState === 'open' ? 'Vote đang mở' : m.voteState === 'closed' ? 'Vote đã đóng' : 'Chưa mở vote'}>
            {m.voteState === 'open' ? '● ' : ''}{di} đi · {ng} nghỉ{un ? ` · ${un} chưa trả lời` : ''}
          </span>
        </>
      );
    }
    if (me && !isSettled(m, today)) {
      const st = m.attendance[me]?.status;
      res = <>{res}<span className={`chip ${st === 'di' ? 'win' : st === 'nghi' ? 'loss' : 'le'}`}>Bạn: {st === 'di' ? 'Đi' : st === 'nghi' ? 'Nghỉ' : m.voteState === 'open' ? 'Chưa vote' : 'Chưa mở vote'}</span></>;
    }
    return (
      <button key={m.id} type="button" className={`mcard${next ? ' next' : ''}`} onClick={() => setModal({ id: m.id, tab: isSettled(m, today) ? 'res' : 'att' })}>
        <div className="mdate"><span>{DAY_SHORT[dayOfWeek(m.date)]}</span><b>{d}</b><span>Th{mo}</span></div>
        <div className="minfo">
          <b>vs {m.opponent}</b>
          <div className="ln">
            {m.time && <span>{m.time}</span>}
            {m.venue && <span>{m.venue}</span>}
            <span>{m.type}</span>
            {m.cost != null && <span>Sân {money(m.cost)}</span>}
          </div>
          {m.note && <div className="ln">{m.note}</div>}
        </div>
        <div className="mres">{res}</div>
      </button>
    );
  };

  return (
    <section className="view">
      <div style={{ display: 'grid', gap: 16 }}>
        <div className="view-head">
          <h2 className="vt">Lịch thi đấu</h2>
          {canEdit && <button className="btn primary" type="button" onClick={() => setModal({ id: null })}>+ Tạo trận</button>}
        </div>
        {view.role !== 'guest' && (
          <div>
            <h3 className="st">Sắp tới</h3>
            <div className="mlist">{up.length ? up.map((m, i) => card(m, i === 0)) : <div className="empty-list">Chưa có trận nào sắp tới.{canEdit && <> Bấm <b>+ Tạo trận</b>.</>}</div>}</div>
          </div>
        )}
        <div>
          <div className="view-head">
            <h3 className="st">Đã đá</h3>
            {years.length > 1 && (
              <select aria-label="Chọn mùa" value={year} onChange={(e) => setYear(+e.target.value)}>
                {[...new Set([view.year, ...years])].map((y) => <option key={y} value={y}>Mùa {y}</option>)}
              </select>
            )}
          </div>
          <div className="mlist">{past.length ? past.map((m) => card(m)) : <div className="empty-list">Chưa đá trận nào.</div>}</div>
        </div>
      </div>
      {modal && (
        <MatchModal
          matchId={modal.id}
          initialTab={modal.tab}
          onClose={() => {
            setModal(null);
            if (openId) router.replace(`/t/${view.team.id}/lich`);
          }}
        />
      )}
    </section>
  );
}
