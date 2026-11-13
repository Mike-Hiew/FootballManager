'use client';

import { useEffect, useMemo, useRef, useState, startTransition } from 'react';
import { createPortal } from 'react-dom';
import { POS_INFO, TIER_NAME, ageOf, cardOf, cardTier, dm, fillStats, isInternal, playerSeason, shortName } from '@san7/core';
import { useTeam } from '../TeamContext';
import { CardReveal } from '../honors/PlayerCard';
import { usePlayerModal } from '../players/PlayersView';
import { setAttendanceAction } from '@/app/actions';
import { isSettled, seasonOf } from '@/lib/season';
import { lineCls } from '@/lib/pos';
import type { MatchDTO, PlayerDTO } from '@/lib/types';
import { lkScene, type LkApi, type LkPlayer } from './scene';

const LK_TIER: Record<LkPlayer['tier'], [string, string]> = { silver: ['#cfe3ff', '#9fb3c8'], gold: ['#f5c84b', '#f5c84b'], dd: ['#d4ff3a', '#36f58a'] };
const LINE: Record<string, number> = { gk: 0, df: 1, mf: 2, fw: 3 };
const LN = ['Thủ môn', 'Hậu vệ', 'Tiền vệ', 'Tiền đạo'];

/** Tải three.js + các pass bloom (bloom là tuỳ chọn — lỗi thì cảnh vẫn chạy). */
async function loadThree() {
  const THREE = await import('three');
  let post: Record<string, unknown> = {};
  try {
    const [ec, rp, sp, ub, gc] = await Promise.all([
      import('three/examples/jsm/postprocessing/EffectComposer.js'),
      import('three/examples/jsm/postprocessing/RenderPass.js'),
      import('three/examples/jsm/postprocessing/ShaderPass.js'),
      import('three/examples/jsm/postprocessing/UnrealBloomPass.js'),
      import('three/examples/jsm/shaders/GammaCorrectionShader.js'),
    ]);
    post = { ...ec, ...rp, ...sp, ...ub, ...gc };
  } catch {
    post = {};
  }
  return { THREE, post };
}

function Radar({ p }: { p: LkPlayer }) {
  if (!p.stats.length) return null;
  const C = [100, 94], R = 58, n = p.stats.length;
  const pt = (k: number, r: number) => {
    const a = ((-90 + (360 / n) * k) * Math.PI) / 180;
    return [C[0] + Math.cos(a) * r, C[1] + Math.sin(a) * r];
  };
  const ring = (f: number) => <polygon key={f} className="ring" points={p.stats.map((_, k) => pt(k, R * f).map((v) => v.toFixed(1)).join(',')).join(' ')} />;
  return (
    <svg className="lk-radar" viewBox="0 0 200 186" role="img" aria-label={`Biểu đồ chỉ số của ${p.name}`}>
      {ring(0.33)}{ring(0.66)}{ring(1)}
      {p.stats.map((_, k) => {
        const [x, y] = pt(k, R);
        return <line key={k} className="axis" x1={C[0]} y1={C[1]} x2={x.toFixed(1)} y2={y.toFixed(1)} />;
      })}
      <polygon className="val" points={p.stats.map(([, v], k) => pt(k, (R * Math.max(0, Math.min(99, v))) / 99).map((x) => x.toFixed(1)).join(',')).join(' ')} />
      {p.stats.map(([lab, v], k) => {
        const [x, y] = pt(k, R + 20);
        return (
          <g key={lab}>
            <text x={x.toFixed(1)} y={(y - 3).toFixed(1)}>{lab}</text>
            <text className="v" x={x.toFixed(1)} y={(y + 10).toFixed(1)}>{v}</text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Phòng thay đồ 3D: mỗi cầu thủ một áo trên giá treo. Mở từ tab Cầu thủ (cả mùa) hoặc từ khối Trận tới
 * (ngày thi đấu: áo phản ánh điểm danh, bấm áo của mình để lấy áo = vote Đi / treo lại = Nghỉ).
 */
export function Locker({ matchId, onClose }: { matchId: string | null; onClose: () => void }) {
  const { view, players, byId, matchById, act, teamId, toast } = useTeam();
  const m: MatchDTO | undefined = matchId ? matchById(matchId) : undefined;
  const season = useMemo(() => seasonOf(view.matches), [view.matches]);
  const today = view.now.slice(0, 10);
  const meId = view.myPlayerId;
  const voteOpen = !!m && m.voteState === 'open' && !isSettled(m, today) && view.role !== 'guest';
  const [att, setAtt] = useState<Record<string, string>>(() => Object.fromEntries(players.map((p) => [p.id, m?.attendance[p.id]?.status ?? ''])));
  // Danh sách áo dựng một lần khi mở (cảnh 3D giữ nguyên thứ tự)
  const PL = useMemo<LkPlayer[]>(() => {
    return players.map((p: PlayerDTO) => {
      const c = cardOf(p, fillStats(p.stats as Record<string, number>));
      const se = playerSeason(season, view.year, p.id);
      return {
        id: p.id, n: p.num, name: p.fullName || shortName(p), short: shortName(p).toUpperCase(), line: LINE[lineCls(c.pos)], pos: c.pos,
        posVi: POS_INFO[c.pos]?.vn ?? c.pos, ovr: c.ovr, tier: cardTier(c.ovr), cap: p.isCaptain, stats: c.stats, age: ageOf(p.dob, new Date(view.now)),
        foot: p.foot || 'Phải', gp: se.gp, g: se.goals, a: se.assists, mvp: se.mvp, att: m ? m.attendance[p.id]?.status ?? '' : null, me: p.id === meId,
      };
    }).sort((a, b) => a.line - b.line || (a.n ?? 99) - (b.n ?? 99));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [focus, setFocus] = useState(0);
  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState<string | null>(null);
  const [pulse, setPulse] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const flash = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLElement>(null);
  const api = useRef<LkApi | null>(null);
  const modal = usePlayerModal();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Áo phản ánh điểm danh hiện tại (kể cả khi vote trong phòng)
  useEffect(() => {
    PL.forEach((p) => {
      if (m) p.att = att[p.id] ?? '';
    });
  }, [att, PL, m]);

  const vote = (s: 'di' | 'nghi') => {
    if (!meId || !m || !voteOpen) return toast('Điểm danh đang đóng');
    setAtt((a) => ({ ...a, [meId]: s }));
    startTransition(async () => {
      await act(() => setAttendanceAction(teamId, m.id, meId, s), s === 'di' ? 'Đã lấy áo · bạn ĐI' : 'Đã treo áo lại · bạn NGHỈ');
    });
  };
  const voteRef = useRef(vote);
  voteRef.current = vote;
  const attRef = useRef(att);
  attRef.current = att;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    let alive = true;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    loadThree()
      .then(({ THREE, post }) => {
        if (!alive || !canvas.current || !flash.current) return;
        try {
          api.current = lkScene(THREE, canvas.current, PL, {
            reduce, flashEl: flash.current, matchday: !!m, team: view.team.name, post,
            showPlayer: (i) => setFocus(i),
            onPick: (p) => {
              if (m && p.me && voteOpen) {
                voteRef.current(attRef.current[p.id] === 'di' ? 'nghi' : 'di');
                return false;
              }
              return true;
            },
            onReveal: (p) => setCard(p.id),
            onPulse: () => setPulse((x) => x + 1),
          });
          setLoading(false);
          const mine = PL.findIndex((p) => p.me);
          const best = PL.findIndex((p) => p.ovr === Math.max(...PL.map((x) => x.ovr)));
          api.current.start(m && mine >= 0 ? mine : Math.max(0, best));
        } catch {
          closeRef.current();
          toast('Thiết bị này không dựng được cảnh 3D');
        }
      })
      .catch(() => {
        if (!alive) return;
        closeRef.current();
        toast('Không tải được thư viện 3D. Kiểm tra mạng rồi thử lại');
      });
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('.hc-overlay, .modal')) return;
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        e.preventDefault();
        closeRef.current();
      } else if (e.key === 'ArrowLeft') api.current?.step(-1);
      else if (e.key === 'ArrowRight') api.current?.step(1);
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      alive = false;
      api.current?.destroy();
      api.current = null;
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Chiều cao bảng thông tin → camera chừa chỗ (điện thoại)
  useEffect(() => {
    if (!sheet.current) return;
    document.documentElement.style.setProperty('--lk-sheet-h', `${sheet.current.offsetHeight}px`);
    api.current?.resize();
  }, [focus, att]);

  const p = PL[focus];
  const T = LK_TIER[p.tier];
  const di = m ? PL.filter((x) => att[x.id] === 'di').length : 0;
  const st = m ? att[p.id] ?? '' : '';
  const cardP = card ? byId(card) : undefined;
  const lines = [...new Set(PL.map((x) => x.line))];

  return createPortal(
    <div className="lk-overlay" role="dialog" aria-modal="true" aria-label="Phòng thay đồ">
      <canvas ref={canvas} className="lk-stage" aria-label="Giá treo áo 3D, kéo ngang để lướt, bấm vào áo để chọn" />
      <div className="lk-vig" />
      <div className="lk-flash" ref={flash} />
      <div className="lk-top">
        <div className="lk-brand">
          <span className="lk-eye">{view.team.name} · {m ? `${isInternal(m) ? 'Đá nội bộ' : `vs ${m.opponent}`} · ${dm(m.date)}` : `Mùa ${view.year}`}</span>
          <h2>Phòng thay đồ{m ? ' ngày thi đấu' : ''}</h2>
          <span className="lk-hint">
            {m
              ? `Áo sáng: đã vote đi · áo tối: nghỉ · áo đung đưa: chưa trả lời${voteOpen && PL.some((x) => x.me) ? ' · bấm áo của bạn để lấy áo' : ''}`
              : 'Kéo ngang để lướt · Bấm vào áo đang chọn để mở thẻ'}
          </span>
        </div>
        <button type="button" className="btn sm" onClick={onClose}>Đóng</button>
      </div>
      <div className="lk-chips" role="group" aria-label="Nhảy tới vị trí">
        {lines.map((l) => (
          <button key={l} type="button" className={`lk-chip${p.line === l ? ' on' : ''}`} onClick={() => api.current?.go(PL.findIndex((x) => x.line === l))}>{LN[l]}</button>
        ))}
      </div>
      <aside ref={sheet} key={pulse} className={`lk-sheet${pulse ? ' pulse' : ''}`} aria-live="polite" style={{ ['--tier' as string]: T[0], ['--tier2' as string]: T[1] }}>
        <div className="lk-head">
          <div className="lk-num">{p.n ?? '–'}</div>
          <div className="lk-who">
            <div className="lk-pos">{p.posVi}{p.me ? ' · Áo của bạn' : ''}</div>
            <div className="lk-name">{p.name}{p.cap && <> <span className="cbadge" title="Đội trưởng">C</span></>}</div>
            <div className="lk-tier">
              ◆ {TIER_NAME[p.tier]}{' '}
              {m && <span className={`lk-st ${st || 'un'}`}>{st === 'di' ? 'Đi' : st === 'nghi' ? 'Nghỉ' : 'Chưa trả lời'}</span>}
            </div>
          </div>
          <div className="lk-ovr"><b>{p.ovr}</b><span>OVR</span></div>
        </div>
        <div className="lk-body">
          <Radar p={p} />
          <div className="lk-stats">
            <div><b>{p.age ?? '–'}</b><span>Tuổi</span></div><div><b>{p.foot}</b><span>Chân</span></div><div><b>{p.mvp}</b><span>MVP</span></div>
            <div><b>{p.gp}</b><span>Trận</span></div><div><b>{p.g}</b><span>Bàn</span></div><div><b>{p.a}</b><span>Kiến tạo</span></div>
          </div>
        </div>
        <div className="lk-acts">
          {m && p.me && voteOpen && (st === 'di'
            ? <button type="button" className="btn sm" onClick={() => vote('nghi')}>Treo áo lại · Tôi nghỉ</button>
            : <button type="button" className="btn primary sm" onClick={() => vote('di')}>Lấy áo · Tôi đi</button>)}
          <button type="button" className={`btn${m && p.me && voteOpen ? '' : ' primary'} sm`} onClick={() => setCard(p.id)}>Mở thẻ</button>
          <button type="button" className="btn sm" onClick={() => modal.open(p.id)}>Hồ sơ</button>
        </div>
        <div className="lk-bar"><i style={{ width: `${((focus + 1) / PL.length) * 100}%` }} /></div>
        <div className="lk-nav">
          <button type="button" aria-label="Áo trước" onClick={() => api.current?.step(-1)}>←</button>
          <div className="lk-count">{String(focus + 1).padStart(2, '0')} / {String(PL.length).padStart(2, '0')}{m ? ` · ${di} đi` : ''}</div>
          <button type="button" aria-label="Áo sau" onClick={() => api.current?.step(1)}>→</button>
        </div>
      </aside>
      {loading && <div className="lk-load">Đang dựng phòng thay đồ…</div>}
      {cardP && (
        <CardReveal c={cardOf(cardP, fillStats(cardP.stats as Record<string, number>))} team={view.team.name} kicker={`Thẻ của ${shortName(cardP)}`} onClose={() => setCard(null)} />
      )}
      {modal.node}
    </div>,
    document.body,
  );
}
