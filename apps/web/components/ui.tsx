'use client';
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { fmt1, hue, initials, scoreTier } from '@san7/core';

export const tierColor = (s: number) => `var(--${scoreTier(s)})`;

export function Avatar({ p, size = 28 }: { p: { id: string; nick?: string | null; fullName?: string | null; avatarUrl?: string | null }; size?: number }) {
  return (
    <span className="av" style={{ width: size, height: size, fontSize: Math.round(size * 0.38), ['--h' as string]: hue(p.id || 'x') }}>
      {p.avatarUrl ? <img src={p.avatarUrl} alt="" /> : initials(p)}
    </span>
  );
}

/** Ô điểm có popover công thức khi hover/chạm (BRD 4.3). */
export function Score({ playerId, pos, score, className = 'sc' }: { playerId: string; pos: string; score: number; className?: string }) {
  return (
    <span className={className} data-x={`p:${playerId}:${pos}`} tabIndex={0} style={{ ['--fit' as string]: tierColor(score) }} aria-label={`${pos} ${fmt1(score)} điểm, xem cách tính`}>
      {fmt1(score)}
    </span>
  );
}

export function Tip({ text }: { text: string }) {
  return <span className="tip" tabIndex={0} data-tt={text} aria-label={text}>i</span>;
}

/**
 * Modal render qua portal ra <body>: phần tử cha (.view) có filter/backdrop-filter sẽ tạo
 * containing block mới làm lệch position: fixed (BRD 10.2) — prototype cũng đặt overlay ở body.
 */
export function Modal({ title, onClose, children, footer, tabs, wide }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; tabs?: React.ReactNode; wide?: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} style={wide ? { maxWidth: wide } : undefined}>
        <header>
          <div className="hrow" style={tabs ? undefined : { paddingBottom: 12 }}>
            <h3>{title}</h3>
            <button type="button" className="btn ghost sm" onClick={onClose}>Đóng</button>
          </div>
          {tabs}
        </header>
        <div className="body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: Array<[T, string, boolean?]> }) {
  return (
    <div className="mtabs" role="tablist">
      {items.filter(([, , hidden]) => !hidden).map(([k, label]) => (
        <button key={k} type="button" role="tab" aria-selected={value === k} onClick={() => onChange(k)}>{label}</button>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty-list">{children}</div>;
}
