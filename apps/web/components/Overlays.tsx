'use client';

import { useEffect, useRef, useState } from 'react';
import { FOOT_SIDE, POS_INFO, STAT_INFO, explain, fmt1, shortName, type Position } from '@san7/core';
import { useTeam } from './TeamContext';

/**
 * Tooltip dùng chung (BRD 10.3): một hộp position: fixed cho mọi phần tử [data-tt];
 * mở bằng hover, focus bàn phím, chạm; kẹp trong màn hình 8 px.
 */
export function TooltipLayer() {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let current: Element | null = null;
    const show = (t: HTMLElement) => {
      const s = t.dataset.tt;
      const b = box.current;
      if (!s || !b) return;
      current = t;
      b.textContent = s;
      b.hidden = false;
      const r = t.getBoundingClientRect();
      const w = b.offsetWidth;
      const h = b.offsetHeight;
      const x = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2));
      let y = r.top - h - 8;
      if (y < 8) y = r.bottom + 8;
      b.style.left = x + 'px';
      b.style.top = y + 'px';
    };
    const hide = () => {
      if (box.current) box.current.hidden = true;
      current = null;
    };
    const over = (e: Event) => {
      const t = (e.target as Element).closest?.('[data-tt]') as HTMLElement | null;
      if (t) {
        if (t !== current) show(t);
      } else if (current) hide();
    };
    const focus = (e: Event) => {
      const t = (e.target as Element).closest?.('[data-tt]') as HTMLElement | null;
      if (t) show(t);
    };
    const click = (e: Event) => {
      const t = (e.target as Element).closest?.('[data-tt]') as HTMLElement | null;
      if (t && !t.closest('button')) show(t);
      else hide();
    };
    document.addEventListener('mouseover', over);
    document.addEventListener('focusin', focus);
    document.addEventListener('focusout', hide);
    document.addEventListener('click', click, true);
    addEventListener('scroll', hide, { passive: true });
    return () => {
      document.removeEventListener('mouseover', over);
      document.removeEventListener('focusin', focus);
      document.removeEventListener('focusout', hide);
      document.removeEventListener('click', click, true);
      removeEventListener('scroll', hide);
    };
  }, []);
  return <div id="tipbox" ref={box} role="tooltip" hidden />;
}

/**
 * Popover công thức điểm vị trí — chỉ hiện khi hover/chạm/focus vào ô điểm (BRD 4.3).
 * Phần tử mang data-x="p:<playerId>:<POS>" hoặc "d:<POS>" (nháp trong form).
 */
export function FormulaPopover() {
  const { byId, draft } = useTeam();
  const [state, setState] = useState<{ x: string; rect: DOMRect } | null>(null);
  const pop = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canHover = matchMedia('(hover:hover)').matches;
    let cur: Element | null = null;
    const open = (el: HTMLElement) => {
      cur = el;
      setState({ x: el.dataset.x!, rect: el.getBoundingClientRect() });
    };
    const close = () => {
      cur = null;
      setState(null);
    };
    const over = (e: Event) => {
      if (!canHover) return;
      const el = (e.target as Element).closest?.('[data-x]') as HTMLElement | null;
      if (el && el !== cur) open(el);
      else if (!el && cur) close();
    };
    const focus = (e: Event) => {
      const el = (e.target as Element).closest?.('[data-x]') as HTMLElement | null;
      if (el) open(el);
    };
    const blur = (e: Event) => {
      if ((e.target as Element).closest?.('[data-x]')) close();
    };
    const click = (e: Event) => {
      if (canHover) return;
      const el = (e.target as Element).closest?.('[data-x]') as HTMLElement | null;
      if (el) (cur === el ? close() : open(el));
      else if (cur) close();
    };
    document.addEventListener('mouseover', over);
    document.addEventListener('focusin', focus);
    document.addEventListener('focusout', blur);
    document.addEventListener('click', click, true);
    addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mouseover', over);
      document.removeEventListener('focusin', focus);
      document.removeEventListener('focusout', blur);
      document.removeEventListener('click', click, true);
      removeEventListener('scroll', close, true);
    };
  }, []);

  useEffect(() => {
    const p = pop.current;
    if (!p || !state) return;
    const r = state.rect;
    const pw = p.offsetWidth;
    const ph = p.offsetHeight;
    const x = Math.min(Math.max(8, r.left + r.width / 2 - pw / 2), innerWidth - pw - 8);
    let y = r.bottom + 8;
    if (y + ph > innerHeight - 8) y = r.top - ph - 8;
    if (y < 8) y = 8;
    p.style.left = x + 'px';
    p.style.top = y + 'px';
  }, [state]);

  if (!state) return <div className="pop" hidden ref={pop} />;
  const [kind, a, b] = state.x.split(':');
  let stats: Record<string, number> | undefined;
  let foot = 'Phải';
  let pos: Position;
  let who = '';
  if (kind === 'd') {
    if (!draft.current) return null;
    stats = draft.current.stats;
    foot = draft.current.foot;
    pos = a as Position;
  } else {
    const p = byId(a);
    if (!p) return null;
    stats = p.stats;
    foot = p.foot;
    pos = b as Position;
    who = shortName(p);
  }
  const e = explain(stats, foot, pos);
  return (
    <div className="pop" ref={pop} role="tooltip">
      <h4>{pos} · {POS_INFO[pos].vn}{who ? ' · ' + who : ''}</h4>
      <table>
        <tbody>
          {e.rows.map((r) => (
            <tr key={r.key}><td>{STAT_INFO[r.key].vn}</td><td>{fmt1(r.stat)} × {r.weight}%</td><td>{r.contribution.toFixed(2)}</td></tr>
          ))}
          {e.footAdj !== 0 && (
            <tr><td>Chân {foot.toLowerCase()}</td><td /><td>{e.footAdj > 0 ? '+' : '−'}{Math.abs(e.footAdj).toFixed(1)}</td></tr>
          )}
          <tr className="tot"><td>Điểm</td><td /><td>{fmt1(e.score)}</td></tr>
        </tbody>
      </table>
      <div className="f">Điểm = Σ (chỉ số × trọng số) / 100{FOOT_SIDE[pos] ? ' ± chân thuận' : ''}</div>
    </div>
  );
}
