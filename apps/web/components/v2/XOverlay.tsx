'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/** Lớp phủ dùng chung của giao diện v2 (bảng hết giờ, so sánh cầu thủ, poster đội hình…). Esc / bấm nền để đóng. */
export function XOverlay({ cls, label, onClose, children }: { cls?: string; label: string; onClose: () => void; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      onClose();
    };
    document.addEventListener('keydown', esc, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    box.current?.querySelector<HTMLElement>('button,[tabindex]')?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('keydown', esc, true);
      document.body.style.overflow = prev;
    };
  }, [onClose, mounted]);
  if (!mounted) return null;
  return createPortal(
    <div className="overlay xov" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} className={`xbox ${cls ?? ''}`} role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </div>,
    document.body,
  );
}

const reduced = () => typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Số đếm từ 0 (tắt khi reduced-motion). */
export function CountUp({ to, ms = 900 }: { to: number; ms?: number }) {
  const [v, setV] = useState(to);
  useEffect(() => {
    if (reduced() || !(to > 0)) return setV(to);
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      setV(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return <>{v}</>;
}
