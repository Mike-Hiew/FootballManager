'use client';
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { useEffect, useMemo, useOptimistic, useRef, useState, startTransition } from 'react';
import {
  DAY_FULL, DAY_ORDER, DAY_SHORT, dayOfWeek, dm, hue, initials, isFormation, isInternal, isSafeUrl, leaderboard, money, overall, positionScore,
  resultOf, ruleIcon, seasonTable, shortName, slotsOf, teamSeason, todayVN, yearsSince,
} from '@san7/core';
import { useTeam } from '../TeamContext';
import { Avatar, Tip } from '../ui';
import { RuleIcon } from '../Icons';
import { assistSVG, bootSVG } from './art';
import { stadiumScene } from './stadium';
import { TeamInfoModal } from './TeamInfoModal';
import { PaymentReminders } from '../PaymentReminders';
import { MatchModal } from '../matches/MatchModal';
import { StatReviewModal } from '../players/StatReviewModal';
import { remindVoteAction, setAttendanceAction, setVoteStateAction, skipClaimAction } from '@/app/actions';
import { byKick, isPlayed, isSettled, seasonOf } from '@/lib/season';
import type { MatchDTO, PlayerDTO } from '@/lib/types';
import { FullTime } from '../v2/FullTime';
import { lineCls } from '@/lib/pos';

const reduced = () => typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Số lớn đếm từ 0 trong 900 ms (tắt khi reduced-motion). */
function Up({ to }: { to: number }) {
  const [v, setV] = useState(to);
  useEffect(() => {
    if (reduced() || !(to > 0)) return setV(to);
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 900);
      setV(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{v}</>;
}

function Donut({ w, d, l }: { w: number; d: number; l: number }) {
  const n = w + d + l;
  const R = 52;
  const C = 2 * Math.PI * R;
  let off = 0;
  const seg = (v: number, c: string) => {
    if (!v) return null;
    const len = (v / n) * C;
    const el = <circle key={c} cx="66" cy="66" r={R} fill="none" stroke={c} strokeWidth="16" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} transform="rotate(-90 66 66)" />;
    off += len;
    return el;
  };
  const pct = n ? Math.round((w / n) * 100) : 0;
  return (
    <svg className="donut" viewBox="0 0 132 132" role="img" aria-label={`Tỷ lệ thắng ${pct}%`}>
      <circle cx="66" cy="66" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="16" />
      {n ? [seg(w, 'var(--good)'), seg(d, 'var(--ok)'), seg(l, 'var(--bad)')] : null}
      <text x="66" y="68" textAnchor="middle" className="pct">{pct}%</text>
      <text x="66" y="86" textAnchor="middle" className="lb">tỷ lệ thắng</text>
    </svg>
  );
}

/** Đếm ngược 4 ô (ngày · giờ · phút · giây), ô đổi số thì nảy nhẹ. */
function Countdown2({ m, now }: { m: MatchDTO; now: number }) {
  const t = new Date(m.kickoffAt).getTime() - now;
  if (t <= 0) return <span className="cd-now">Đang diễn ra · chờ kết quả</span>;
  const P: Array<[string, number]> = [['ngày', Math.floor(t / 864e5)], ['giờ', Math.floor((t % 864e5) / 36e5)], ['phút', Math.floor((t % 36e5) / 6e4)], ['giây', Math.floor((t % 6e4) / 1e3)]];
  return (
    <>
      {P.map(([l, v], i) => (
        <span key={l} style={{ display: 'contents' }}>
          {i > 0 && <em aria-hidden="true">:</em>}
          <span className="u" style={{ ['--i' as string]: i }}><b key={v} className={reduced() ? undefined : 'tick'}>{String(v).padStart(2, '0')}</b><small>{l}</small></span>
        </span>
      ))}
    </>
  );
}

/** Khiên đội: ảnh đội hoặc chữ viết tắt (bỏ chữ FC), màu theo tên. */
const teamInit = (n: string) => {
  const w = String(n || '?').trim().split(/\s+/).filter((x) => !/^fc$/i.test(x));
  return ((w[0] || '?')[0] + (w[1] ? w[1][0] : '')).toUpperCase();
};
function Shield({ name, img }: { name: string; img?: string | null }) {
  return <span className="shield" style={{ ['--h' as string]: hue(name) }} aria-hidden="true">{img ? <img src={img} alt="" /> : teamInit(name)}</span>;
}

/** Thời lượng trận (phút): theo giờ đá sân nhà của đội nếu có, không thì 90. */
function matchMinutes(from: string | null, to: string | null): number {
  const mm = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  if (!from || !to || !/^\d\d:\d\d$/.test(from) || !/^\d\d:\d\d$/.test(to)) return 90;
  const d = (mm(to) - mm(from) + 1440) % 1440;
  return d >= 30 && d <= 240 ? d : 90;
}

type Phase = 'upcoming' | 'live' | 'ended';

/** Đội hình dự kiến của trận: đội hình ĐT đã xếp (người Đi), không thì tự chọn người Đi hợp nhất từng vị trí. */
function projXI(m: MatchDTO, players: PlayerDTO[], team: { formation: string }) {
  const f = (m.formation && isFormation(m.formation) ? m.formation : isFormation(team.formation) ? team.formation : '2-3-1') as string;
  const sl = slotsOf(f);
  const di = players.filter((p) => m.attendance[p.id]?.status === 'di');
  const byId = new Map(players.map((p) => [p.id, p]));
  const set = !!m.lineup?.some((id) => id && byId.has(id) && m.attendance[id]?.status === 'di');
  let xi: Array<PlayerDTO | null>;
  if (set) xi = sl.map((_, i) => {
    const p = m.lineup![i] ? byId.get(m.lineup![i]!) : undefined;
    return p && m.attendance[p.id]?.status === 'di' ? p : null;
  });
  else {
    const left = [...di];
    xi = sl.map(([pos]) => {
      if (!left.length) return null;
      let bi = 0, bv = -1;
      left.forEach((p, i) => {
        const v = positionScore(p.stats, p.foot, pos);
        if (v > bv) { bv = v; bi = i; }
      });
      return left.splice(bi, 1)[0];
    });
  }
  return { f, sl, xi, set };
}

/** Bóng lăn giữa các cầu thủ trên sân đội hình dự kiến. */
function useBall(box: React.RefObject<HTMLDivElement | null>, key: string) {
  useEffect(() => {
    if (reduced()) return;
    let cur = -1;
    const hop = () => {
      const lx = box.current;
      if (!lx || document.hidden) return;
      const ps = [...lx.querySelectorAll<HTMLElement>('.po-s:not(.empty)')];
      const ball = lx.querySelector<HTMLElement>('.ball');
      if (!ball || ps.length < 2) return;
      let n: number;
      do n = Math.floor(Math.random() * ps.length); while (n === cur);
      cur = n;
      const t = ps[n];
      ps.forEach((p) => p.classList.remove('has'));
      ball.classList.add('on');
      ball.style.left = `calc(${t.style.left} + 20px)`;
      ball.style.top = `calc(${t.style.top} - 2px)`;
      setTimeout(() => t.classList.add('has'), 650);
    };
    const t0 = setTimeout(hop, 1400);
    const id = setInterval(hop, 1900);
    return () => { clearTimeout(t0); clearInterval(id); };
  }, [box, key]);
}

/** Vuốt sang phải = Đi, sang trái = Nghỉ (điện thoại). */
function Swipe({ onVote }: { onVote: (s: 'di' | 'nghi') => void }) {
  const st = useRef<{ x: number; max: number } | null>(null);
  const k = useRef<HTMLSpanElement>(null);
  const [dir, setDir] = useState<'' | 'di' | 'nghi'>('');
  const end = () => {
    if (!st.current) return;
    st.current = null;
    if (dir) onVote(dir);
    else if (k.current) k.current.style.translate = '';
    setDir('');
  };
  return (
    <div
      className="swipe"
      data-swipe
      data-dir={dir || undefined}
      onPointerDown={(e) => {
        st.current = { x: e.clientX, max: e.currentTarget.offsetWidth / 2 - 32 };
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* bỏ qua */ }
      }}
      onPointerMove={(e) => {
        if (!st.current || !k.current) return;
        const dx = Math.max(-st.current.max, Math.min(st.current.max, e.clientX - st.current.x));
        k.current.style.translate = `${dx}px 0`;
        setDir(dx > st.current.max * 0.6 ? 'di' : dx < -st.current.max * 0.6 ? 'nghi' : '');
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <span className="sw-l">‹ Nghỉ</span><span className="sw-r">Tôi đi ›</span><span className="sw-k" ref={k} aria-hidden="true">⇆</span>
    </div>
  );
}

function NextMatch({ onLocker }: { onLocker?: (matchId: string) => void }) {
  const { view, players, canEdit, act, teamId } = useTeam();
  const today = todayVN(new Date(view.now));
  const m = useMemo(() => view.matches.filter((x) => !isPlayed(x) && x.date >= today).sort(byKick)[0], [view.matches, today]);
  const meId = view.myPlayerId;
  const [att, setOpt] = useOptimistic(m?.attendance ?? {}, (cur, [pid, s]: [string, 'di' | 'nghi']) => ({ ...cur, [pid]: { status: s, byCaptain: false, lePaid: false } }));
  const [detail, setDetail] = useState<null | 'att' | 'res'>(null);
  const pitch = useMemo(() => stadiumScene(view.team.name), [view.team.name]);
  const svgBox = useRef<HTMLDivElement>(null);
  const lx = useRef<HTMLDivElement>(null);
  const [fly, setFly] = useState(false);
  useEffect(() => {
    if (reduced()) svgBox.current?.querySelectorAll('svg').forEach((s) => (s as SVGSVGElement).pauseAnimations?.());
  }, [pitch]);
  // Đồng hồ chạy ở client: đếm ngược từng giây, tự chuyển Trận tới → Đang diễn ra → Chờ tỉ số
  const [now, setNow] = useState(() => new Date(view.now).getTime());
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => !document.hidden && setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  // Hiệu ứng vào sân chỉ chạy lần đầu mở trang
  const [intro] = useState(() => !reduced());
  const mAtt = m ? { ...m, attendance: att } : null;
  const X = mAtt ? projXI(mAtt, players, view.team) : null;
  useBall(lx, X ? X.xi.map((p) => p?.id ?? '').join(',') : '');
  if (view.role === 'guest') return null;
  if (!m || !X) {
    return (
      <div className="nxb empty">
        <div className="nx-l">
          <div className="nx-eye">Trận tới</div>
          <div className="nx-vs"><span className="us">Chưa có lịch</span></div>
          <div className="nx-meta">{canEdit ? 'Tạo trận mới ở tab Lịch đấu để anh em điểm danh.' : 'Đội trưởng chưa lên lịch trận tiếp theo.'}</div>
        </div>
        {canEdit && <div className="nx-r"><Link className="btn primary" href={`/t/${teamId}/lich`}>Tạo trận mới</Link></div>}
      </div>
    );
  }
  const inl = isInternal(m);
  const di = players.filter((p) => att[p.id]?.status === 'di');
  const ng = players.filter((p) => att[p.id]?.status === 'nghi');
  const un = players.length - di.length - ng.length;
  const open = m.voteState === 'open' && !isSettled(m, today);
  const st = meId ? att[meId]?.status : undefined;
  const squad = view.team.fullSquad;
  const need = Math.max(0, squad - di.length);
  const kick = new Date(m.kickoffAt).getTime();
  const dur = matchMinutes(view.team.homeFrom, view.team.homeTo);
  const phase: Phase = now < kick ? 'upcoming' : now < kick + dur * 6e4 ? 'live' : 'ended';
  const minute = Math.min(dur, Math.max(1, Math.ceil((now - kick) / 6e4)));
  const askVote = phase === 'upcoming' && !!meId && open && !st;
  const daysTo = Math.round((Date.UTC(...(m.date.split('-').map(Number) as [number, number, number])) - Date.UTC(...(today.split('-').map(Number) as [number, number, number]))) / 864e5);
  const title = inl ? 'trận nội bộ' : `trận vs ${m.opponent}`;
  const vote = (s: 'di' | 'nghi') => {
    if (!meId) return;
    if (s === 'di') setFly(true);
    startTransition(async () => {
      setOpt([meId, s]);
      await act(() => setAttendanceAction(teamId, m.id, meId, s), s === 'di' ? `Đã điểm danh: bạn ĐI ${title}` : `Đã báo nghỉ ${title}`);
    });
  };
  const nU = inl ? 'Đội A' : view.team.name;
  const nT = inl ? 'Đội B' : m.opponent;
  let h2h: React.ReactNode;
  if (inl) h2h = <>Đá nội bộ: đội trưởng chia hai đội ở tab <b>Chia đội</b> của trận</>;
  else {
    const prev = view.matches.filter((x) => isPlayed(x) && !isInternal(x) && x.opponent.trim().toLowerCase() === m.opponent.trim().toLowerCase()).sort(byKick);
    if (prev.length) {
      const c = { T: 0, H: 0, B: 0 };
      prev.forEach((x) => c[resultOf(x)]++);
      const l = prev[prev.length - 1];
      h2h = <>Đã gặp <b>{prev.length}</b> lần: <b>{c.T}</b> thắng · <b>{c.H}</b> hoà · <b>{c.B}</b> thua · gần nhất <b>{l.scoreUs}–{l.scoreThem}</b> ({dm(l.date)})</>;
    } else h2h = 'Lần đầu chạm trán';
  }
  let cta: React.ReactNode = null;
  if (phase === 'live') {
    cta = <div className="nx-ask live-now"><span className="q"><span className="live red" />Trận đang diễn ra — chúc anh em đá hay!</span></div>;
  } else if (phase === 'ended') {
    cta = (
      <div className="nx-ask">
        <span className="q">Trận đã kết thúc. {canEdit ? 'Nhập tỉ số để cả đội nhận kết quả.' : 'Đang chờ đội trưởng nhập tỉ số.'}</span>
        {canEdit && <div className="nx-btns"><button type="button" className="nxbtn go big" onClick={() => setDetail('res')}>Nhập tỉ số</button></div>}
      </div>
    );
  } else if (meId && open) {
    cta = st ? (
      <div className="nx-ask done">
        <div className="nx-btns">
          <button type="button" className={`nxbtn go${st === 'di' ? ' on' : ''}`} onClick={() => vote('di')}>Tôi đi</button>
          <button type="button" className={`nxbtn no${st === 'nghi' ? ' on' : ''}`} onClick={() => vote('nghi')}>Tôi nghỉ</button>
          <span className="tip dk" tabIndex={0} data-tt="Đổi được đến khi đội trưởng đóng điểm danh">i</span>
        </div>
      </div>
    ) : (
      <div className="nx-ask pulse">
        <span className="q"><span className="live" /><b>Bạn đi không?</b></span>
        <Swipe onVote={vote} />
        <div className="nx-btns">
          <button type="button" className="nxbtn go big" onClick={() => vote('di')}>✓ Tôi đi</button>
          <button type="button" className="nxbtn no" onClick={() => vote('nghi')}>Nghỉ</button>
        </div>
      </div>
    );
  } else if (meId && !m.voteState) {
    cta = <div className="nx-ask"><span className="q">Điểm danh chưa mở.{canEdit ? '' : ' Đội trưởng sẽ thông báo khi mở.'}</span></div>;
  } else if (meId && m.voteState === 'closed') {
    cta = <div className="nx-ask"><span className="q">Điểm danh đã đóng{st ? <> · bạn: <b className={st}>{st === 'di' ? 'Đi' : 'Nghỉ'}</b></> : null}. Cần đổi thì báo đội trưởng.</span></div>;
  }
  const extra = di.slice(squad);
  return (
    <>
      <div className={`nxb has-pitch md ph-${phase}${daysTo === 0 && phase === 'upcoming' ? ' today' : ''}${intro ? ' intro' : ''}${askVote ? ' need' : ''}`}>
        <span className="beam l" aria-hidden="true" /><span className="beam r" aria-hidden="true" />
        <div className="nx-scene" ref={svgBox} aria-hidden="true">
          <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: pitch }} />
        </div>
        <div className="nx-l">
          {phase === 'live' ? (
            <div className="nx-eye"><span className="live red" />Trực tiếp <span className="pill-live">Đang diễn ra</span></div>
          ) : phase === 'ended' ? (
            <div className="nx-eye"><span className="live" />Vừa kết thúc <span className="pill-open">Chờ tỉ số</span></div>
          ) : (
            <div className="nx-eye">
              <span className="live" />Trận tới {open && <span className="pill-open">Đang điểm danh</span>}{daysTo === 0 && <span className="pill-today">Hôm nay</span>}
              <span className="eye-x">· {m.type || 'Giao hữu'}{daysTo > 1 ? ` · còn ${daysTo} ngày` : daysTo === 1 ? ' · ngày mai' : ''}</span>
            </div>
          )}
          <div className="fo">
            <div className="fo-t us"><Shield name={nU} img={inl ? null : view.team.photoUrl} /><b>{nU}</b></div>
            <div className="fo-vs"><i>VS</i></div>
            <div className="fo-t them"><Shield name={nT} /><b>{nT}</b></div>
          </div>
          {phase === 'upcoming' && <div className="nx-cd cd2" role="timer" aria-label="Đếm ngược tới giờ đá"><Countdown2 m={m} now={now} /></div>}
          {phase === 'live' && (
            <div className="nx-clock" role="timer" aria-label={`Phút ${minute} trên ${dur}`}>
              <b>{minute}<i>'</i></b>
              <div className="nx-prog"><span style={{ width: `${(minute / dur) * 100}%` }} /></div>
              <small>{dur} phút · bắt đầu {m.time ?? ''}</small>
            </div>
          )}
          {phase === 'ended' && <div className="nx-clock done"><small>Kết thúc khoảng {new Date(kick + dur * 6e4).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })}</small></div>}
          <div className="nx-meta">
            <span><b>{DAY_SHORT[dayOfWeek(m.date)]}, {dm(m.date)}</b></span>
            {m.time && <span>{m.time}</span>}
            {m.venue && <span>{m.venue}</span>}
            {m.fee ? <span className="tip dk" tabIndex={0} data-tt={`Đá lẻ ${money(m.fee)}/trận`}>₫</span> : null}
          </div>
          <div className="h2h">{h2h}</div>
        </div>
        <div className="nx-pitch">
          <div className="lx" ref={lx}>
            <span className="ball" aria-hidden="true" />
            {X.sl.map(([pos, x, y], i) => {
              const p = X.xi[i];
              return (
                <div key={i} className={`po-s${p ? '' : ' empty'}`} style={{ ['--i' as string]: i, left: `${x}%`, top: `${(6 + y * 0.84).toFixed(1)}%` }}>
                  <span className={`d${p && pos === 'GK' ? ' gk' : ''}`}>{p ? p.num ?? initials(p) : '?'}</span>
                  <b>{p ? shortName(p) : 'Chờ vote'}</b><i>{pos}</i>
                </div>
              );
            })}
          </div>
          <div className="nx-pitch-cap">{X.set ? 'Đội hình đội trưởng đã xếp' : 'Đội hình dự kiến'} · {X.f}</div>
        </div>
        <div className="nx-r">
          <div className="nx-att">
            <div className="big"><b><Up to={di.length} /></b><span>/{players.length} đi</span></div>
            <div className={`nx-state ${need ? 'warn' : 'ok'}`} tabIndex={0} data-tt={need ? `Cần tối thiểu ${squad} người, còn thiếu ${need}` : `Đủ ${squad} người${di.length > squad ? `, dư ${di.length - squad} người` : ''}`}>
              {need ? `Thiếu ${need}` : 'Đủ người'}
            </div>
          </div>
          <div className={`nx-avs seats${di.length >= squad ? ' full' : ''}`} style={{ ['--n' as string]: Math.min(squad, 10) }} role="img" aria-label={`${Math.min(squad, di.length)} trên ${squad} chỗ đã có người (7 ra sân, ${squad - 7} dự bị)`}>
            {Array.from({ length: squad }, (_, i) => {
              const p = di[i];
              const sub = i >= 7;
              return p ? (
                <span key={i} className={`seat on${sub ? ' sub' : ''}${p.id === meId ? ' me' : ''}${p.id === meId && fly ? ' fly' : ''}`} style={{ ['--i' as string]: i }} data-tt={`${shortName(p)}${sub ? ' · dự bị' : ''}`}><Avatar p={p} size={30} /></span>
              ) : (
                <span key={i} className={`seat${sub ? ' sub' : ''}`} data-tt={sub ? 'Chỗ dự bị trống' : 'Chỗ ra sân trống'}>{sub ? 'DB' : i + 1}</span>
              );
            })}
          </div>
          {extra.length > 0 && <div className="seat-x">Thêm {extra.length} người: <b>{extra.map((p) => shortName(p)).join(', ')}</b></div>}
          {cta}
          <div className="nx-cap">
            {canEdit && !m.voteState && <button type="button" className="btn primary sm" onClick={() => act(() => setVoteStateAction(teamId, m.id, 'open'), 'Đã mở điểm danh và thông báo cả đội')}>Mở điểm danh</button>}
            {canEdit && open && un > 0 && <button type="button" className="btn sm" onClick={() => act(() => remindVoteAction(teamId, m.id), (n) => `Đã nhắc ${n} người`)}>Nhắc {un} người</button>}
            <button type="button" className="btn sm" onClick={() => setDetail('att')}>Danh sách</button>
            <Link className="btn sm" href={`/t/${teamId}/tran-toi?tran=${m.id}`}>Đội hình trận</Link>
            {onLocker && <button type="button" className="btn sm" onClick={() => onLocker(m.id)}>Vào phòng thay đồ</button>}
          </div>
        </div>
      </div>
      {detail && <MatchModal matchId={m.id} initialTab={detail} onClose={() => setDetail(null)} />}
    </>
  );
}

/** Nhắc người đã Đi khai báo bàn/kiến tạo cho trận vừa có tỉ số (BRD 6.8). Tắt khi đã khai báo hoặc bấm "Không có". */
/** Nhắc chấm chỉ số đồng đội đang chờ (BRD 4.7): mỗi bản mình chưa chấm một dòng, tối đa 3. */
function StatReviewReminders() {
  const { view, byId } = useTeam();
  const [open, setOpen] = useState<string | null>(null);
  const todo = view.statReviews.filter((r) => !r.myVote && byId(r.playerId));
  const cur = open ? view.statReviews.find((r) => r.editId === open) : null;
  if (!todo.length && !cur) return null;
  return (
    <>
      {todo.slice(0, 3).map((r) => {
        const p = byId(r.playerId)!;
        return (
          <div key={r.editId} className="note stat-remind" role="status" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <Avatar p={p} size={28} />
            <span>
              <b>{shortName(p)}</b> {r.origin === 'join' ? 'vừa vào đội' : r.origin === 'captain' ? 'được đội trưởng nhờ chấm lại' : 'vừa cập nhật chỉ số'} — bạn xác nhận hoặc chỉnh giúp?
              <span className="muted"> {r.voted}/{r.invited} đã chấm</span>
            </span>
            <button type="button" className="btn primary sm" onClick={() => setOpen(r.editId)}>Chấm chỉ số</button>
          </div>
        );
      })}
      {todo.length > 3 && <div className="hint" style={{ margin: 0 }}>Còn {todo.length - 3} người nữa chờ bạn chấm.</div>}
      {cur && <StatReviewModal review={cur} onClose={() => setOpen(null)} />}
    </>
  );
}

function ClaimReminders() {
  const { view, teamId, act } = useTeam();
  const [hidden, setHidden] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const me = view.myPlayerId;
  const list = view.postMatch.claimMatchIds
    .filter((id) => !hidden.includes(id))
    .map((id) => view.matches.find((m) => m.id === id))
    .filter((m): m is MatchDTO => !!m)
    .slice(0, 2);
  if (!me || !list.length) return open ? <MatchModal matchId={open} initialTab="res" onClose={() => setOpen(null)} /> : null;
  return (
    <>
      {list.map((m) => {
        const e = m.events[me];
        return (
          <div key={m.id} className="note claim-remind" role="status" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>
              Trận <b>vs {m.opponent}</b> ({dm(m.date)}) kết thúc <b>{m.scoreUs}–{m.scoreThem}</b>. Bạn có ghi bàn hay kiến tạo không?
              {e && (e.goals || e.assists) ? <> Đội trưởng đang ghi cho bạn {e.goals} bàn, {e.assists} kiến tạo.</> : null}
            </span>
            <button type="button" className="btn primary sm" onClick={() => setOpen(m.id)}>Khai báo</button>
            <button
              type="button"
              className="btn sm"
              onClick={() => {
                setHidden((h) => [...h, m.id]);
                void act(() => skipClaimAction(teamId, m.id));
              }}
            >
              Không có
            </button>
          </div>
        );
      })}
      {open && <MatchModal matchId={open} initialTab="res" onClose={() => setOpen(null)} />}
    </>
  );
}

export function Dashboard({ isNew }: { isNew?: boolean }) {
  const { view, players, byId, nameOf, canEdit } = useTeam();
  const t = view.team;
  const [edit, setEdit] = useState(false);
  const season = useMemo(() => seasonOf(view.matches), [view.matches]);
  const ts = teamSeason(season, view.year);
  const lines = seasonTable(season, view.year, players.map((p) => p.id));
  const boot = leaderboard(lines, 'goals');
  const assist = leaderboard(lines, 'assists');
  const mvps = leaderboard(lines, 'mvp').slice(0, 5);
  const now = new Date(view.now);
  const yrs = yearsSince(t.foundedOn, now);
  const played = [...view.matches].filter((m) => isPlayed(m) && !isInternal(m)).sort(byKick);
  const [ft, setFt] = useState<MatchDTO | null>(null);
  const map = isSafeUrl(t.homeMapUrl) ? t.homeMapUrl! : null;

  const honor = (cls: string, img: string | null, svg: string, title: string, list: typeof boot, k: 'goals' | 'assists', unit: string, other: 'goals' | 'assists', otherUnit: string) => {
    const top = list[0];
    const p = top ? byId(top.playerId) : undefined;
    return (
      <div className={`honor ${cls}`}>
        {img ? <img className="emb img" src={img} alt={`Cúp ${title}`} /> : <span style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: svg }} />}
        <div style={{ minWidth: 0 }}>
          <div className="ttl">{title}</div>
          {top && p ? (
            <>
              <div className="who2">
                <Avatar p={p} size={44} />
                <div style={{ minWidth: 0 }}>
                  <div className="nm" data-tt={p.fullName} tabIndex={0}>{shortName(p)}</div>
                  {p.num != null && <div className="full">Số {p.num}</div>}
                </div>
              </div>
              <div className="big">
                <b><Up to={top[k]} /></b><span>{unit}</span>
                <span className="tip dk" tabIndex={0} data-tt={`Mùa ${view.year} · ${top.gp} trận${top.gp ? ` · ${(top[k] / top.gp).toFixed(2)} ${unit}/trận` : ''}${top[other] ? ` · ${top[other]} ${otherUnit}` : ''}`}>i</span>
              </div>
            </>
          ) : <div className="empty">Chưa có {unit} nào trong mùa này.</div>}
        </div>
        {list.length > 1 && (
          <div className="runner">
            {list.slice(1, 4).map((r, i) => <span key={r.playerId}><i className="rkn">#{i + 2}</i> <b>{nameOf(r.playerId)}</b> {r[k]}</span>)}
          </div>
        )}
      </div>
    );
  };

  const curLbl = ts.curK ? { T: 'thắng', B: 'thua', H: 'hoà' }[ts.curK] : '';
  const curColor = ts.curK ? { T: 'var(--good)', B: 'var(--bad)', H: 'var(--ok)' }[ts.curK] : 'inherit';
  const bigWin = ts.matches.filter((m) => resultOf(m) === 'T').sort((a, b) => b.scoreUs! - b.scoreThem! - (a.scoreUs! - a.scoreThem!) || b.scoreUs! - a.scoreUs!)[0];
  const most = [...lines].sort((a, b) => b.gp - a.gp)[0];

  return (
    <section className="view">
      <div style={{ display: 'grid', gap: 16 }} className="dash-in">
        {isNew && canEdit && (
          <div className="note">Đội đã được tạo. Gửi link mời ở tab <Link href={`/t/${t.id}/duyet`}>Duyệt</Link> để anh em đăng ký vào đội.</div>
        )}
        <StatReviewReminders />
        <ClaimReminders />
        <div className="hero" id="tHero">
          {t.photoUrl ? <img className="cover" src={t.photoUrl} alt={`Ảnh đội ${t.name}`} /> : (
            [[12, 18, 5], [22, 62, 4], [70, 24, 6], [84, 58, 3], [48, 40, 4], [60, 12, 3]].map(([x, y, r], i) => <i key={i} className="ff" style={{ left: `${x}%`, top: `${y}%`, width: r, height: r }} />)
          )}
          <div className="in">
            <div className="hid"><h2>{t.name}</h2>{t.slogan && <div className="sl">{t.slogan}</div>}</div>
            <div className="meta">
              {t.foundedOn && yrs != null && <span data-tt={`Thành lập ${dm(t.foundedOn)}/${t.foundedOn.slice(0, 4)}`} tabIndex={0}><b>{yrs < 1 ? '<1' : yrs}</b><em>năm gắn bó</em></span>}
              <span><b>{players.length}</b><em>thành viên</em></span>
              {t.captainNames.length > 0 && <span><b>{t.captainNames.join(', ')}</b><em>đội trưởng</em></span>}
            </div>
            {canEdit && <button type="button" className="btn sm edit" onClick={() => setEdit(true)}>Sửa thông tin đội</button>}
          </div>
        </div>

        <PaymentReminders />
        <NextMatch />

        <div className="wk">
          <Potw played={played} season={lines} />
          <div className="panel">
            <h3 className="st">5 trận gần nhất</h3>
            {played.length ? (
              <div className="fwrap">
                <div className="fcards">
                  {played.slice(-5).reverse().map((m) => {
                    const r = resultOf(m);
                    const sc = Object.entries(m.events).filter(([id, e]) => byId(id) && e.goals).sort((a, b) => b[1].goals - a[1].goals).map(([id, e]) => nameOf(id) + (e.goals > 1 ? ` ×${e.goals}` : ''));
                    return (
                      <button key={m.id} type="button" className={`fcard ${r}`} aria-label={`Xem bảng kết quả trận vs ${m.opponent}`} onClick={() => setFt(m)}>
                        <span className="r">{r === 'T' ? 'Thắng' : r === 'B' ? 'Thua' : 'Hoà'} · {dm(m.date)}</span>
                        <span className="s">{m.scoreUs}–{m.scoreThem}</span>
                        <span className="o">vs {m.opponent}</span>
                        <span className="g">{sc.length ? sc.join(', ') : 'Không có bàn thắng'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : <div className="empty-list">Chưa đá trận nào trong mùa này.</div>}
          </div>
        </div>

        <div className="dash">
          {honor('gold', t.awardBootUrl, bootSVG(), 'Giày vàng', boot, 'goals', 'bàn', 'assists', 'kiến tạo')}
          {honor('silver', t.awardAssistUrl, assistSVG(), 'Vua kiến tạo', assist, 'assists', 'kiến tạo', 'goals', 'bàn')}
          <div className="panel ratep">
            <h3 className="st" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              Thành tích {view.year}
              <Tip text={`${ts.n} trận · bàn thắng–thua ${ts.gf}–${ts.ga} · hiệu số ${ts.gf - ts.ga >= 0 ? '+' : ''}${ts.gf - ts.ga}${ts.n ? ` · ${(ts.gf / ts.n).toFixed(1)} bàn/trận` : ''}`} />
            </h3>
            <div className="rate-row">
              <Donut w={ts.w} d={ts.d} l={ts.l} />
              <div className="wdl">
                <span><i style={{ background: 'var(--good)' }} /><b>{ts.w}</b>thắng</span>
                <span><i style={{ background: 'var(--ok)' }} /><b>{ts.d}</b>hoà</span>
                <span><i style={{ background: 'var(--bad)' }} /><b>{ts.l}</b>thua</span>
              </div>
            </div>
          </div>
        </div>

        <div className="tiles">
          <div className={`tile ${ts.curK ? 'st-' + ts.curK : ''}`}>
            <div className="k">Chuỗi hiện tại</div>
            <div className="v" style={{ color: curColor }}>{ts.cur}<small>{curLbl}</small></div>
            <div className="s">{ts.n ? `Bất bại ${ts.unbeaten} trận gần nhất` : 'Mùa này chưa đá trận nào'}</div>
          </div>
          <div className={`tile ${ts.wl ? 'st-T' : ''}`}><div className="k">Chuỗi thắng dài nhất</div><div className="v">{ts.wl}<small>trận</small></div><div className="s">Mùa {view.year}</div></div>
          <div className="tile">
            <div className="k">Thắng đậm nhất</div>
            <div className="v">{bigWin ? `${bigWin.scoreUs}–${bigWin.scoreThem}` : '–'}</div>
            <div className="s">{bigWin ? `vs ${bigWin.opponent} · ${dm(bigWin.date)}` : 'Chưa có trận thắng'}</div>
          </div>
          <div className="tile">
            <div className="k">Ra sân nhiều nhất</div>
            <div className="v">{most && most.gp ? nameOf(most.playerId) : '–'}</div>
            <div className="s">{most && most.gp ? `${most.gp} trận` : 'Chưa có số liệu'}</div>
          </div>
        </div>

        <div className="tgrid">
          <div className="panel">
            <h3 className="st">Sân nhà</h3>
            {t.homeName ? (
              <>
                <div className="home-name" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{t.homeName}{t.homeAddress && <Tip text={t.homeAddress} />}</div>
                <dl className="kv">
                  <dt>Lịch đá</dt>
                  <dd><div className="daypills" aria-label={DAY_ORDER.filter((d) => t.homeDays.includes(d)).map((d) => DAY_FULL[d]).join(', ')}>{DAY_ORDER.map((d) => <span key={d} className={t.homeDays.includes(d) ? 'on' : ''}>{DAY_SHORT[d]}</span>)}</div></dd>
                  <dt>Giờ đá</dt><dd>{t.homeFrom || '?'} – {t.homeTo || '?'}</dd>
                  {t.homeCost > 0 && <><dt>Tiền sân</dt><dd>{money(t.homeCost)} / buổi</dd></>}
                </dl>
                <div className="row-actions" style={{ marginTop: 12 }}>
                  {map ? (
                    <>
                      <a className="btn primary sm" href={map} target="_blank" rel="noopener noreferrer">Mở bản đồ</a>
                      <CopyBtn text={map} />
                    </>
                  ) : <span className="hint" style={{ margin: 0 }}>Chưa có link địa điểm.</span>}
                </div>
              </>
            ) : <div className="empty-list">Chưa khai báo sân nhà.{canEdit && <> Bấm <b>Sửa thông tin đội</b> để thêm.</>}</div>}
          </div>
          <div className="panel" id="tRules">
            <h3 className="st">Quy định đội</h3>
            {t.rules.length ? (
              <>
                <ol className="rules">{t.rules.slice(0, 2).map((r, i) => <li key={i}><span>{r}</span></li>)}</ol>
                {t.rules.length > 2 && (
                  <div className="rule-more">
                    <span className="lbl">Khác</span>
                    {t.rules.slice(2).map((r, i) => <span key={i} className="rule-ic" tabIndex={0} data-tt={r} aria-label={r}><RuleIcon k={ruleIcon(r)} /></span>)}
                  </div>
                )}
              </>
            ) : <div className="empty-list">Chưa có quy định nào.</div>}
          </div>
          <div className="panel">
            <h3 className="st">Ngôi sao MVP · {view.year}</h3>
            {mvps.length ? (
              <ol className="mvpl">
                {mvps.map((r, i) => {
                  const p = byId(r.playerId);
                  return (
                    <li key={r.playerId} className={i === 0 ? 'first' : ''}>
                      <i className="rkn">{i + 1}</i>
                      {p && <Avatar p={p} size={34} />}
                      <div className="n"><b>{nameOf(r.playerId)}</b><span className="bar"><span style={{ width: `${Math.round((r.mvp / mvps[0].mvp) * 100)}%` }} /></span></div>
                      <span className="cnt"><b><Up to={r.mvp} /></b>★</span>
                    </li>
                  );
                })}
              </ol>
            ) : <div className="empty-list">Chưa có MVP nào trong mùa này.</div>}
          </div>
        </div>
      </div>
      {edit && <TeamInfoModal onClose={() => setEdit(false)} />}
      {ft && <FullTime m={ft} onClose={() => setFt(null)} />}
    </section>
  );
}

/** Cầu thủ của tuần: MVP trận gần nhất, không có thì người ghi bàn / kiến tạo nhiều nhất. */
function Potw({ played, season }: { played: MatchDTO[]; season: ReturnType<typeof seasonTable> }) {
  const { view, byId } = useTeam();
  const last = played[played.length - 1];
  if (!last) return null;
  let star = last.mvpPlayerId ? byId(last.mvpPlayerId) : undefined;
  let why = 'MVP';
  if (!star) {
    const top = Object.entries(last.events).filter(([id, e]) => byId(id) && e.goals + e.assists > 0).sort((a, b) => b[1].goals * 2 + b[1].assists - (a[1].goals * 2 + a[1].assists))[0];
    star = top ? byId(top[0]) : undefined;
    why = 'Nổi bật nhất';
  }
  if (!star) return null;
  const o = overall(star.stats, star.foot);
  const e = last.events[star.id] ?? { goals: 0, assists: 0 };
  const mvp = season.find((l) => l.playerId === star!.id)?.mvp ?? 0;
  return (
    <div className="potw" id="hPotw">
      <span className="k">Cầu thủ của tuần</span>
      <div className="pw-top"><div className="pc-ovr"><b>{o.ovr}</b><span className={`posb ${lineCls(o.pos)}`}>{o.pos}</span></div><Avatar p={star} size={96} /></div>
      <div className="nm">{shortName(star)}</div>
      <div className="sub">{why} trận vs {last.opponent} · {dm(last.date)}</div>
      <div className="pw-st"><span><b>{e.goals}</b>bàn trận này</span><span><b>{e.assists}</b>kiến tạo trận này</span><span><b>{mvp}</b>MVP mùa {view.year}</span></div>
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const { toast } = useTeam();
  return (
    <button type="button" className="btn sm" onClick={async () => {
      try {
        await navigator.clipboard.writeText(text);
        toast('Đã sao chép link bản đồ');
      } catch {
        toast('Không sao chép được');
      }
    }}>Sao chép link</button>
  );
}
