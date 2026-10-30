'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { dm, shortName } from '@san7/core';
import { useTeam } from '../TeamContext';
import { TeamCrest } from '../TeamCrest';
import { markResultSeenAction } from '@/app/actions';

type Mood = 'win' | 'draw' | 'loss';

const COPY: Record<Mood, { title: string; line: string; badge: string }> = {
  win: { title: 'Chiến thắng!', line: 'Cả đội đá quá hay — ăn mừng thôi!', badge: 'Thắng' },
  draw: { title: 'Hoà rồi', line: 'Chia điểm sòng phẳng. Trận sau quyết thắng!', badge: 'Hoà' },
  loss: { title: 'Thua rồi…', line: 'Không sao, cả đội đã cố hết sức. Trận sau gỡ lại!', badge: 'Thua' },
};

// Vị trí/màu cố định để hiệu ứng giống nhau mỗi lần render (không lệch giữa server và client)
const CONFETTI = Array.from({ length: 28 }, (_, i) => ({ x: (i * 37) % 100, d: (i % 7) * 0.18, c: i % 4, r: (i * 53) % 360 }));
const FIREFLIES = Array.from({ length: 14 }, (_, i) => ({ x: 6 + ((i * 29) % 88), d: (i % 5) * 0.6, s: 4 + (i % 3) * 2 }));
const RAIN = Array.from({ length: 22 }, (_, i) => ({ x: (i * 41) % 100, d: (i % 6) * 0.25 }));

/**
 * Popup tỉ số trận vừa kết thúc (BRD 6.8): hiện một lần cho mỗi thành viên khi mở app lần đầu sau khi ĐT
 * nhập tỉ số (đánh dấu đã xem ngay khi hiện). Thắng thì pháo giấy + đom đóm, hoà dịu, thua thì mưa nhẹ; tắt bằng ✕ / Đóng / Esc.
 */
export function ResultPopup() {
  const { view, teamId, players, byId } = useTeam();
  const router = useRouter();
  // Giữ trận đang báo cho tới khi đóng: ghi "đã xem" làm dữ liệu trang tải lại và resultMatchId về null
  const [id, setId] = useState(view.postMatch.resultMatchId);
  useEffect(() => {
    if (view.postMatch.resultMatchId) setId(view.postMatch.resultMatchId);
  }, [view.postMatch.resultMatchId]);
  const [closedId, setClosedId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const closeBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => setMounted(true), []);
  const m = id ? view.matches.find((x) => x.id === id) : undefined;
  const open = mounted && !!m && closedId !== m.id && m.scoreUs != null && m.scoreThem != null;
  // Ghi "đã xem" ngay khi popup hiện (không đợi lúc đóng): đóng rồi chuyển trang/tải lại ngay cũng không hiện lại
  const marked = useRef<string | null>(null);
  useEffect(() => {
    if (!open || !m || marked.current === m.id) return;
    marked.current = m.id;
    closeBtn.current?.focus();
    void markResultSeenAction(teamId, m.id);
  }, [open, m, teamId]);
  if (!open || !m) return null;

  const mood: Mood = m.scoreUs! > m.scoreThem! ? 'win' : m.scoreUs! < m.scoreThem! ? 'loss' : 'draw';
  const copy = COPY[mood];
  const name = (pid: string) => {
    const p = byId(pid);
    return p ? shortName(p) : 'Cầu thủ cũ';
  };
  const scorers = Object.entries(m.events)
    .filter(([, e]) => e.goals > 0)
    .sort((a, b) => b[1].goals - a[1].goals)
    .map(([pid, e]) => name(pid) + (e.goals > 1 ? ` ×${e.goals}` : ''));
  const went = view.myPlayerId ? m.attendance[view.myPlayerId]?.status === 'di' : false;
  const canClaim = view.postMatch.claimMatchIds.includes(m.id);
  const goingCount = players.filter((p) => m.attendance[p.id]?.status === 'di').length;

  const close = (then?: () => void) => {
    setClosedId(m.id);
    then?.();
  };

  return createPortal(
    <div
      className={`rp-overlay rp-${mood}`}
      onMouseDown={(e) => e.target === e.currentTarget && close()}
      onKeyDown={(e) => e.key === 'Escape' && close()}
    >
      <div className="rp-fx" aria-hidden="true">
        {mood === 'win' && CONFETTI.map((c, i) => <i key={i} className={`rp-confetti c${c.c}`} style={{ left: `${c.x}%`, animationDelay: `${c.d}s`, ['--r' as string]: `${c.r}deg` }} />)}
        {mood !== 'loss' && FIREFLIES.map((f, i) => <i key={i} className="rp-fly" style={{ left: `${f.x}%`, width: f.s, height: f.s, animationDelay: `${f.d}s` }} />)}
        {mood === 'loss' && RAIN.map((r, i) => <i key={i} className="rp-rain" style={{ left: `${r.x}%`, animationDelay: `${r.d}s` }} />)}
      </div>
      <div className="rp-card" role="dialog" aria-modal="true" aria-labelledby="rpTitle">
        <button ref={closeBtn} type="button" className="rp-x" aria-label="Đóng" onClick={() => close()}>✕</button>
        <div className="rp-kicker">Trận đấu đã kết thúc · {dm(m.date)}{m.time ? ' · ' + m.time : ''}</div>
        {mood === 'win' && (
          <svg className="rp-cup" viewBox="0 0 64 64" aria-hidden="true">
            <path d="M18 8h28v10a14 14 0 0 1-28 0z" />
            <path d="M18 12H10a8 8 0 0 0 10 10M46 12h8a8 8 0 0 1-10 10" fill="none" strokeWidth="4" />
            <path d="M28 32h8v10h-8zM20 46h24v8H20z" />
          </svg>
        )}
        <h2 id="rpTitle" className="rp-title">{copy.title}</h2>
        <div className="rp-score" aria-label={`${view.team.name} ${m.scoreUs} – ${m.scoreThem} ${m.opponent}`}>
          <div className="rp-side">
            <TeamCrest name={view.team.name} photoUrl={view.team.photoUrl} size={52} />
            <b>{view.team.name}</b>
          </div>
          <div className="rp-num"><span>{m.scoreUs}</span><i>–</i><span>{m.scoreThem}</span></div>
          <div className="rp-side">
            <span className="rp-opp" aria-hidden="true">{m.opponent.slice(0, 1).toUpperCase()}</span>
            <b>{m.opponent}</b>
          </div>
        </div>
        <span className={`rp-badge ${mood}`}>{copy.badge}</span>
        <p className="rp-line">{copy.line}</p>
        <ul className="rp-facts">
          {scorers.length > 0 && <li><span>Ghi bàn</span>{scorers.join(', ')}</li>}
          {m.mvpPlayerId && <li><span>MVP</span>★ {name(m.mvpPlayerId)}</li>}
          {m.venue && <li><span>Sân</span>{m.venue}</li>}
          {goingCount > 0 && <li><span>Ra quân</span>{goingCount} người</li>}
        </ul>
        <div className="rp-acts">
          {canClaim && (
            <button type="button" className="btn primary" onClick={() => close(() => router.push(`/t/${teamId}/lich?tran=${m.id}&tab=res`))}>
              Khai báo bàn/kiến tạo
            </button>
          )}
          {!canClaim && went && <span className="hint" style={{ margin: 0 }}>Bạn đã khai báo trận này.</span>}
          <button type="button" className="btn" onClick={() => close()}>Đóng</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
