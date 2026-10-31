'use client';
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { useEffect, useMemo, useOptimistic, useRef, useState, startTransition } from 'react';
import {
  DAY_FULL, DAY_ORDER, DAY_SHORT, dayOfWeek, dm, isSafeUrl, leaderboard, money, resultOf, ruleIcon, seasonTable, shortName,
  teamSeason, todayVN, yearsSince,
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
import type { MatchDTO } from '@/lib/types';

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

function Countdown({ m, now }: { m: MatchDTO; now: number }) {
  const t = new Date(m.kickoffAt).getTime() - now;
  const d = Math.floor(t / 864e5);
  const h = Math.floor((t % 864e5) / 36e5);
  const mi = Math.floor((t % 36e5) / 6e4);
  const c = (v: number, l: string) => <span className="u" key={l}><b>{String(v).padStart(2, '0')}</b><small>{l}</small></span>;
  return <>{d ? c(d, 'ngày') : null}{c(h, 'giờ')}{c(mi, 'phút')}</>;
}

/** Thời lượng trận (phút): theo giờ đá sân nhà của đội nếu có, không thì 90. */
function matchMinutes(from: string | null, to: string | null): number {
  const mm = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  if (!from || !to || !/^\d\d:\d\d$/.test(from) || !/^\d\d:\d\d$/.test(to)) return 90;
  const d = (mm(to) - mm(from) + 1440) % 1440;
  return d >= 30 && d <= 240 ? d : 90;
}

type Phase = 'upcoming' | 'live' | 'ended';

function NextMatch() {
  const { view, players, byId, canEdit, act, teamId } = useTeam();
  const today = todayVN(new Date(view.now));
  const m = useMemo(() => view.matches.filter((x) => !isPlayed(x) && x.date >= today).sort(byKick)[0], [view.matches, today]);
  const meId = view.myPlayerId;
  const [att, setOpt] = useOptimistic(m?.attendance ?? {}, (cur, [pid, s]: [string, 'di' | 'nghi']) => ({ ...cur, [pid]: { status: s, byCaptain: false, lePaid: false } }));
  const [detail, setDetail] = useState<null | 'att' | 'res'>(null);
  const pitch = useMemo(() => stadiumScene(view.team.name), [view.team.name]);
  const svgBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reduced()) svgBox.current?.querySelectorAll('svg').forEach((s) => (s as SVGSVGElement).pauseAnimations?.());
  }, [pitch]);
  // Đồng hồ chạy ở client để tự chuyển Trận tới → Đang diễn ra → Chờ tỉ số mà không cần tải lại
  const [now, setNow] = useState(() => new Date(view.now).getTime());
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);
  if (view.role === 'guest') return null;
  if (!m) {
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
  const di = players.filter((p) => att[p.id]?.status === 'di');
  const ng = players.filter((p) => att[p.id]?.status === 'nghi');
  const un = players.length - di.length - ng.length;
  const open = m.voteState === 'open' && !isSettled(m, today);
  const st = meId ? att[meId]?.status : undefined;
  const squad = view.team.fullSquad;
  const need = Math.max(0, squad - di.length);
  const pct = (x: number) => (players.length ? (x / players.length) * 100 : 0);
  const kick = new Date(m.kickoffAt).getTime();
  const dur = matchMinutes(view.team.homeFrom, view.team.homeTo);
  const phase: Phase = now < kick ? 'upcoming' : now < kick + dur * 6e4 ? 'live' : 'ended';
  const minute = Math.min(dur, Math.max(1, Math.ceil((now - kick) / 6e4)));
  const askVote = phase === 'upcoming' && !!meId && open && !st;
  const daysTo = Math.round((Date.UTC(...(m.date.split('-').map(Number) as [number, number, number])) - Date.UTC(...(today.split('-').map(Number) as [number, number, number]))) / 864e5);
  const vote = (s: 'di' | 'nghi') => {
    if (!meId) return;
    startTransition(async () => {
      setOpt([meId, s]);
      await act(() => setAttendanceAction(teamId, m.id, meId, s), s === 'di' ? `Đã điểm danh: bạn ĐI trận vs ${m.opponent}` : `Đã báo nghỉ trận vs ${m.opponent}`);
    });
  };
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
  return (
    <>
      <div className={`nxb has-pitch stadium ph-${phase}${askVote ? ' need' : ''}`}>
        <div className="nx-pitch" ref={svgBox}>
          <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: pitch }} />
        </div>
        <div className="nx-l">
          {phase === 'live' ? (
            <div className="nx-eye"><span className="live red" />Trực tiếp <span className="pill-live">Đang diễn ra</span></div>
          ) : phase === 'ended' ? (
            <div className="nx-eye"><span className="live" />Vừa kết thúc <span className="pill-open">Chờ tỉ số</span></div>
          ) : (
            <div className="nx-eye"><span className="live" />Trận tới {open && <span className="pill-open">Đang điểm danh</span>}{daysTo === 0 && <span className="pill-today">Hôm nay</span>}</div>
          )}
          <div className="nx-vs"><i>vs</i><span className="them">{m.opponent}</span></div>
          <div className="nx-meta">
            <span><b>{DAY_SHORT[dayOfWeek(m.date)]}, {dm(m.date)}</b></span>
            {m.time && <span>{m.time}</span>}
            {m.venue && <span>{m.venue}</span>}
            {m.fee ? <span className="tip dk" tabIndex={0} data-tt={`Đá lẻ ${money(m.fee)}/trận`}>₫</span> : null}
          </div>
          {phase === 'upcoming' && <div className="nx-cd"><Countdown m={m} now={now} /></div>}
          {phase === 'live' && (
            <div className="nx-clock" role="timer" aria-label={`Phút ${minute} trên ${dur}`}>
              <b>{minute}<i>'</i></b>
              <div className="nx-prog"><span style={{ width: `${(minute / dur) * 100}%` }} /></div>
              <small>{dur} phút · bắt đầu {m.time ?? ''}</small>
            </div>
          )}
          {phase === 'ended' && <div className="nx-clock done"><small>Kết thúc khoảng {new Date(kick + dur * 6e4).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })}</small></div>}
        </div>
        <div className="nx-gap" aria-hidden="true" />
        <div className="nx-r">
          <div className="nx-att">
            <div className="big"><b><Up to={di.length} /></b><span>/{players.length} đi</span></div>
            <div className={`nx-state ${need ? 'warn' : 'ok'}`} tabIndex={0} data-tt={need ? `Cần tối thiểu ${squad} người, còn thiếu ${need}` : `Đủ ${squad} người đá chính${di.length > squad ? `, dư ${di.length - squad} dự bị` : ''}`}>
              {need ? `Thiếu ${need}` : 'Đủ người'}
            </div>
          </div>
          <div className="nx-bar" role="img" tabIndex={0} aria-label={`${di.length} đi, ${ng.length} nghỉ, ${un} chưa trả lời`} data-tt={`${di.length} đi · ${ng.length} nghỉ · ${un} chưa trả lời`}>
            <span className="di" style={{ width: `${pct(di.length)}%` }} />
            <span className="ng" style={{ width: `${pct(ng.length)}%` }} />
          </div>
          <div className="nx-avs">
            {di.slice(0, 10).map((p) => <span key={p.id} data-tt={shortName(p)}><Avatar p={p} size={30} /></span>)}
            {di.length > 10 && <span className="more">+{di.length - 10}</span>}
          </div>
          {cta}
          <div className="nx-cap">
            {canEdit && !m.voteState && <button type="button" className="btn primary sm" onClick={() => act(() => setVoteStateAction(teamId, m.id, 'open'), 'Đã mở điểm danh và thông báo cả đội')}>Mở điểm danh</button>}
            {canEdit && open && un > 0 && <button type="button" className="btn sm" onClick={() => act(() => remindVoteAction(teamId, m.id), (n) => `Đã nhắc ${n} người`)}>Nhắc {un} người</button>}
            <button type="button" className="btn sm" onClick={() => setDetail('att')}>Danh sách</button>
            <Link className="btn sm" href={`/t/${teamId}/tran-toi?tran=${m.id}`}>Đội hình trận</Link>
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
  const last = [...view.matches].filter(isPlayed).sort(byKick).pop();
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

  const curLbl = ts.curK ? { T: 'thắng', B: 'thua', H: 'hoà' }[ts.curK] : '–';
  const curColor = ts.curK ? { T: 'var(--good)', B: 'var(--bad)', H: 'var(--ok)' }[ts.curK] : 'var(--muted)';
  const last5 = ts.form;

  return (
    <section className="view">
      <div style={{ display: 'grid', gap: 16 }} className="dash-in">
        {isNew && canEdit && (
          <div className="note">Đội đã được tạo. Gửi link mời ở tab <Link href={`/t/${t.id}/duyet`}>Duyệt</Link> để anh em đăng ký vào đội.</div>
        )}
        <div className="hero">
          {t.photoUrl ? <img className="cover" src={t.photoUrl} alt={`Ảnh đội ${t.name}`} /> : (
            [[12, 18, 5], [22, 62, 4], [70, 24, 6], [84, 58, 3], [48, 40, 4], [60, 12, 3]].map(([x, y, r], i) => <i key={i} className="ff" style={{ left: `${x}%`, top: `${y}%`, width: r, height: r }} />)
          )}
          {canEdit && <button type="button" className="btn sm edit" onClick={() => setEdit(true)}>Sửa thông tin đội</button>}
          <div className="in">
            <h2>{t.name}</h2>
            {t.slogan && <div className="sl">{t.slogan}</div>}
            <div className="meta">
              {t.foundedOn && yrs != null && <span data-tt={`Thành lập ${dm(t.foundedOn)}/${t.foundedOn.slice(0, 4)}`} tabIndex={0}><b>{yrs < 1 ? '<1' : yrs}</b>năm</span>}
              <span><b>{players.length}</b>thành viên</span>
              {t.captainNames.length > 0 && <span>Đội trưởng <b style={{ fontSize: 15 }}>{t.captainNames.join(', ')}</b></span>}
            </div>
          </div>
        </div>

        <ClaimReminders />
        <StatReviewReminders />
        <PaymentReminders />
        <NextMatch />

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
          <div className={`tile streak ${ts.curK ? 'st-' + ts.curK : ''}`}>
            <div className="k">Chuỗi hiện tại <Tip text={ts.n ? `Bất bại ${ts.unbeaten} trận gần nhất` : 'Mùa này chưa đá trận nào'} /></div>
            <div className="v" style={{ color: curColor }}>{ts.cur}<small>{curLbl}</small></div>
          </div>
          <div className={`tile streak ${ts.wl ? 'st-T' : ''}`}><div className="k">Thắng dài nhất</div><div className="v" style={{ color: 'var(--good)' }}>{ts.wl}<small>trận</small></div></div>
          <div className={`tile streak ${ts.ll ? 'st-B' : ''}`}><div className="k">Thua dài nhất</div><div className="v" style={{ color: ts.ll ? 'var(--bad)' : 'inherit' }}>{ts.ll}<small>trận</small></div></div>
          <div className="tile">
            <div className="k">Phong độ <Tip text="5 trận gần nhất, trận mới nhất ở bên phải" /></div>
            <div className="form5">
              {Array.from({ length: 5 }, (_, i) => {
                const f = last5[i - (5 - last5.length)];
                if (!f) return <span key={i} className="fp x">–</span>;
                return <span key={i} className={`fp ${f.r}`} tabIndex={0} data-tt={`${dm(f.match.date)} vs ${f.match.opponent} ${f.match.scoreUs}–${f.match.scoreThem}`}>{f.r}</span>;
              })}
            </div>
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
          <div className="panel">
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
            {last && (
              <div className="lastm">
                <span className="k">Trận gần nhất · {dm(last.date)}</span>
                <div className="sc"><span>{t.name}</span><b>{last.scoreUs}<i>–</i>{last.scoreThem}</b><span>{last.opponent}</span></div>
                {last.mvpPlayerId && <span className="mvpt">★ MVP {nameOf(last.mvpPlayerId)}</span>}
                <span className="sr-only">Kết quả: {resultOf(last)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      {edit && <TeamInfoModal onClose={() => setEdit(false)} />}
    </section>
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
