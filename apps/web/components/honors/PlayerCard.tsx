'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createIntro, type Intro } from './intro-engine';
import { TIER_NAME, cardOf, cardTier, fillStats, type CardSnapshot, type CardTier, type Stats } from '@san7/core';

/**
 * Thẻ cầu thủ kiểu thẻ sưu tầm (Vinh danh, BRD 13): bay vào úp mặt → rung → lật, lóe sáng, tia lửa, đom đóm nền.
 * Hạng thẻ: Đom Đóm ≥ 85 · Vàng 75–84 · Bạc < 75.
 */

const Badge = ({ className = 'hc-badge' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 34 34" aria-hidden>
    <path d="M17 2 L30 7 V17 C30 25 24 30 17 32 C10 30 4 25 4 17 V7 Z" fill="none" stroke="currentColor" strokeWidth="2" />
    <ellipse cx="17" cy="19" rx="3.2" ry="6" fill="currentColor" />
    <circle cx="17" cy="11" r="2.4" fill="currentColor" />
    <path d="M14 15 C9 12 8 16 10 18 M20 15 C25 12 26 16 24 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const Person = () => (
  <svg viewBox="0 0 150 160" aria-hidden>
    <circle cx="75" cy="58" r="30" fill="currentColor" />
    <path d="M18 160 C20 118 44 98 75 98 C106 98 130 118 132 160 Z" fill="currentColor" />
  </svg>
);

const Star = () => (
  <svg viewBox="0 0 10 10" aria-hidden><path d="M5 0 L6 4 L10 5 L6 6 L5 10 L4 6 L0 5 L4 4 Z" fill="currentColor" /></svg>
);

const SPARKS: Array<[number, number, number]> = [[22, 18, 0], [86, 30, 0.8], [30, 96, 1.5], [250, 360, 0.4]];

/** Mặt trước + mặt sau của thẻ. `tilt` bật hiệu ứng nghiêng theo chuột / ngón tay. */
export function PlayerCard({ c, team, tilt = true, onActivate }: { c: CardSnapshot; team: string; tilt?: boolean; onActivate?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const t = cardTier(c.ovr);
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const move = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || !tilt) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.classList.add('live');
    el.style.setProperty('--mx', `${x * 100}%`);
    el.style.setProperty('--my', `${y * 100}%`);
    el.style.setProperty('--o', '1');
    if (!reduce) {
      el.style.setProperty('--ry', `${(x - 0.5) * 22}deg`);
      el.style.setProperty('--rx', `${(0.5 - y) * 22}deg`);
    }
  };
  const leave = () => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove('live');
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
    el.style.setProperty('--mx', '50%');
    el.style.setProperty('--my', '50%');
    el.style.setProperty('--o', '0');
  };
  const up = c.prevOvr != null ? c.ovr - c.prevOvr : null;
  return (
    <div
      ref={ref}
      className={`hc-card${up != null && up !== 0 ? ' has-up' : ''}`}
      data-tier={t}
      tabIndex={0}
      role="img"
      aria-label={`Thẻ ${c.name}, ${c.pos}, điểm ${c.ovr}, ${TIER_NAME[t]}`}
      onPointerMove={move}
      onPointerLeave={leave}
      onPointerCancel={leave}
      onPointerUp={(e) => e.pointerType !== 'mouse' && leave()}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (onActivate && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onActivate();
        }
      }}
    >
      <div className="hc-flip">
        <div className="hc-back"><div className="hc-rim" /><div className="hc-bface"><Badge /><span>{team}</span></div></div>
        <div className="hc-front">
          <div className="hc-rim" />
          <div className="hc-face">
            <div className="hc-top">
              <div className="hc-meta">
                <div className="hc-ovr">{c.ovr}</div>
                <div className="hc-pos">{c.pos}</div>
                <div className="hc-rule" />
                <div className="hc-num">{c.num != null ? `#${c.num}` : '–'}</div>
                <div className="hc-rule" />
                <Badge />
              </div>
              <div className="hc-photo">{c.avatarUrl ? <img src={c.avatarUrl} alt="" /> : <Person />}</div>
            </div>
            {up != null && up !== 0 && <div className={`hc-up ${up > 0 ? 'pos' : 'neg'}`}>OVR {c.prevOvr} → {c.ovr} <b>{up > 0 ? `▲${up}` : `▼${-up}`}</b></div>}
            <div className="hc-name" style={c.name.length > 13 ? { fontSize: 22 } : c.name.length > 10 ? { fontSize: 26 } : undefined}>{c.name}</div>
            <div className="hc-alt">{c.alt ? `Vị trí phụ: ${c.alt}` : c.fullName}</div>
            <div className="hc-sep" />
            <div className="hc-stats">
              {c.stats.map(([k, v], i) => {
                const d = c.prevStats ? v - c.prevStats[i][1] : 0;
                return (
                  <div key={k} className="hc-stat">
                    <b>{v}{d !== 0 && <em className={d > 0 ? 'pos' : 'neg'} aria-label={`${d > 0 ? 'tăng' : 'giảm'} ${Math.abs(d)}`}>{d > 0 ? `+${d}` : d}</em>}</b><span>{k}</span>
                  </div>
                );
              })}
            </div>
            <div className="hc-foot"><span>Chân {c.foot.toLowerCase()}</span>{c.style && <><span>·</span><span>{c.style}</span></>}</div>
          </div>
          <div className="hc-flash" />
        </div>
      </div>
      {SPARKS.map(([x, y, d], i) => (
        <span key={i} className="hc-spark" style={{ left: x, top: y, animationDelay: `${d}s` }}><Star /></span>
      ))}
    </div>
  );
}

/* ---------------- Lớp phủ mở thẻ ---------------- */

interface Bit { x: number; y: number; vx: number; vy: number; r: number; life: number; c: string }

const SPRAY: Record<CardTier, [number, string, number]> = { dd: [120, '212,255,58', 9], gold: [65, '255,214,110', 7], silver: [40, '200,225,255', 6] };

/**
 * Màn mở thẻ theo prototype "Thẻ Đom Đóm FC 2": đường hầm → lửa → giới thiệu vị trí / số áo / đội → lóe sáng →
 * sân vận động 3D → thẻ xoay bay ra, pháo hoa, kim tuyến. Bấm thẻ / nền / "Bỏ qua" để tới cuối ngay.
 * Engine vẽ là JS thuần (intro-engine.js); three.js tải động khi mở để không làm nặng trang.
 */
export function CardReveal({ c, team, kicker, note, onClose, extra }: {
  c: CardSnapshot;
  team: string;
  /** dòng trên thẻ, VD "MVP trận vs …" */
  kicker: string;
  note?: string | null;
  onClose: () => void;
  extra?: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  const [done, setDone] = useState(false);
  const sceneRef = useRef<HTMLDivElement>(null);
  const fx = useRef<HTMLCanvasElement>(null);
  const bits = useRef<Bit[]>([]);
  const intro = useRef<Intro | null>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const skipBtn = useRef<HTMLButtonElement>(null);
  const t = cardTier(c.ovr);
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => setMounted(true), []);

  const spray = useCallback(() => {
    const card = sceneRef.current?.querySelector('.hc-card');
    if (!card) return;
    const r = card.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height * 0.4;
    const [n, col, sp] = SPRAY[t];
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const v = 1.5 + Math.random() * sp;
      bits.current.push({ x: cx, y: cy, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v - 2, r: 1 + Math.random() * 1.8, life: 50 + Math.random() * 70, c: col });
    }
  }, [t]);

  // Engine màn mở thẻ + tải three.js cho sân 3D
  useEffect(() => {
    if (!mounted || !sceneRef.current) return;
    let alive = true;
    const it = createIntro({
      root: sceneRef.current,
      tier: t,
      team,
      player: { name: c.name, ovr: c.ovr, pos: c.pos, num: c.num },
      reduce,
      onStart: () => setDone(false),
      onLand: spray,
      onDone: () => {
        setDone(true);
        setTimeout(() => closeBtn.current?.focus({ preventScroll: true }), 0);
      },
    });
    intro.current = it;
    if (!reduce) {
      import('three')
        .then((T) => alive && it.attachThree(T))
        .catch(() => {});
    }
    return () => {
      alive = false;
      it.destroy();
      intro.current = null;
    };
  }, [mounted, t, team, c.name, c.ovr, c.pos, c.num, reduce, spray]);

  // Tia lửa khi thẻ đáp
  useEffect(() => {
    if (!mounted) return;
    const f = fx.current;
    const fc = f?.getContext('2d');
    if (!f || !fc) return;
    let W = 0;
    let H = 0;
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      f.width = W * dpr;
      f.height = H * dpr;
      fc.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    window.addEventListener('resize', size);
    let raf = 0;
    const draw = () => {
      fc.clearRect(0, 0, W, H);
      fc.globalCompositeOperation = 'lighter';
      const list = bits.current;
      for (let j = list.length - 1; j >= 0; j--) {
        const q = list[j];
        q.x += q.vx;
        q.y += q.vy;
        q.vx *= 0.975;
        q.vy = q.vy * 0.975 + 0.09;
        q.life--;
        if (q.life <= 0) {
          list.splice(j, 1);
          continue;
        }
        const al = Math.min(1, q.life / 40);
        fc.fillStyle = `rgba(${q.c},${al * 0.35})`;
        fc.beginPath();
        fc.arc(q.x, q.y, q.r * 3, 0, Math.PI * 2);
        fc.fill();
        fc.fillStyle = `rgba(255,255,255,${al})`;
        fc.beginPath();
        fc.arc(q.x, q.y, q.r * 0.8, 0, Math.PI * 2);
        fc.fill();
      }
      fc.globalCompositeOperation = 'source-over';
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', size);
    };
  }, [mounted]);

  // Khoá cuộn; giữ focus trong lớp phủ
  useEffect(() => {
    if (!mounted) return;
    const prev = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    (reduce ? closeBtn : skipBtn).current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = '';
      prev?.focus?.({ preventScroll: true });
    };
  }, [mounted, reduce]);

  const close = useCallback(() => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, reduce ? 0 : 240);
  }, [closing, onClose, reduce]);

  const skip = () => {
    if (intro.current && !intro.current.isDone()) intro.current.finish();
  };

  if (!mounted) return null;
  return createPortal(
    <div
      className={`hc-overlay${closing ? ' closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={`Thẻ ${c.name}: ${kicker}`}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('.hc-card, button')) return;
        if (done) close();
        else skip();
      }}
      onKeyDown={(e) => {
        // lớp phủ có thể nằm trong modal khác (portal vẫn nổi sự kiện React lên cha) — không để Esc đóng luôn modal đó
        if (e.key === 'Escape') {
          e.stopPropagation();
          close();
        }
        if (e.key === 'Tab') {
          const els = [...e.currentTarget.querySelectorAll<HTMLElement>('.hc-card, button')].filter((x) => x.offsetParent !== null && getComputedStyle(x).visibility !== 'hidden');
          const first = els[0];
          const last = els[els.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      <div ref={sceneRef} className={`hc-scene${done ? ' done' : ''}`} data-tier={t}>
        <canvas className="hc-tunnel" aria-hidden />
        <div className="hc-white" />
        <div className="hc-slam" aria-live="polite" />
        <div className="hc-center">
          <div className="hc-kicker">{kicker}</div>
          <div className="hc-stage pre" data-tier={t}>
            <div className="hc-burst" />
            <PlayerCard c={c} team={team} onActivate={skip} />
            <div className="hc-tier">{TIER_NAME[t]}</div>
          </div>
          {note && <p className="hc-note">“{note}”</p>}
          <div className="hc-actions">
            {extra}
            <button className="hc-btn" type="button" onClick={() => intro.current?.play()}>Xem lại</button>
            <button ref={closeBtn} className="hc-btn ghost" type="button" onClick={close}>Đóng</button>
          </div>
        </div>
        <button ref={skipBtn} className="hc-btn ghost hc-skip" type="button" onClick={skip}>Bỏ qua</button>
      </div>
      <canvas ref={fx} className="hc-fx" aria-hidden />
    </div>,
    document.body,
  );
}

/** Nút mở thẻ hiện tại của một cầu thủ (Của tôi, hồ sơ cầu thủ) — ai cũng xem được bất cứ lúc nào. */
export function ViewCardButton({ p, team, label = 'Xem thẻ', kicker, className = 'btn sm' }: {
  p: { nick: string | null; fullName: string; num: number | null; avatarUrl: string | null; foot: string; styles: string[]; stats: Partial<Stats> };
  team: string;
  label?: string;
  kicker?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const c = cardOf(p, fillStats(p.stats as Record<string, number>));
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>{label}</button>
      {open && <CardReveal c={c} team={team} kicker={kicker ?? `Thẻ của ${c.name}`} onClose={() => setOpen(false)} />}
    </>
  );
}
