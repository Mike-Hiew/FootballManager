'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { cardTier, dm, shortName } from '@san7/core';
import { useTeam } from '../TeamContext';
import { Avatar, Modal } from '../ui';
import { CardReveal, PlayerCard } from './PlayerCard';
import { giveHonorAction, markHonorSeenAction, removeHonorAction } from '@/app/actions';
import type { HonorDTO, HonorKind, HonorsData } from '@/server/services/honors';

const ICON: Record<HonorKind, string> = { mvp: '★', top_scorer: '⚽', top_assist: '🎯', captain: '🏅', stats: '⬆' };
const KIND: Record<HonorKind, string> = { mvp: 'MVP', top_scorer: 'Vua phá lưới', top_assist: 'Vua kiến tạo', captain: 'Đội trưởng', stats: 'Chỉ số mới' };
type Filter = 'all' | 'mvp' | 'month' | 'captain' | 'stats';
const PRESETS = ['Cầu thủ của tháng', 'Chiến binh của trận', 'Bàn thắng đẹp nhất', 'Pha cứu thua xuất sắc', 'Tinh thần đồng đội'];

/** Mở thẻ vinh danh; đánh dấu đã xem ngay khi hiện (không hiện lại kể cả khi trang tải lại). */
export function HonorRevealFor({ h, onClose }: { h: HonorDTO; onClose: () => void }) {
  const { teamId, view, act, canEdit } = useTeam();
  const marked = useRef(false);
  useEffect(() => {
    if (marked.current || h.seen) return;
    marked.current = true;
    void markHonorSeenAction(teamId, h.id);
  }, [h, teamId]);
  return (
    <CardReveal
      c={h.card}
      team={view.team.name}
      kicker={h.kind === 'stats' ? (h.mine ? 'Thẻ mới của bạn' : `Thẻ mới · ${h.card.name}`) : h.title}
      note={h.note}
      onClose={onClose}
      extra={canEdit && (h.kind === 'captain' || h.kind === 'stats') ? (
        <button type="button" className="hc-btn ghost" onClick={async () => {
          const r = await act(() => removeHonorAction(teamId, h.id), 'Đã gỡ lần vinh danh');
          if (r !== undefined) onClose();
        }}>Gỡ</button>
      ) : undefined}
    />
  );
}

/** Popup ở mọi tab: thẻ vinh danh / chỉ số mới của chính người xem (một lần). */
export function HonorPopup() {
  const { view } = useTeam();
  const path = usePathname();
  const [done, setDone] = useState<string[]>([]);
  const h = view.honorPopup;
  if (!h || done.includes(h.id) || path?.endsWith('/vinh-danh')) return null;
  return <HonorRevealFor h={h} onClose={() => setDone((d) => [...d, h.id])} />;
}

function GiveModal({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => void }) {
  const { players, act, teamId } = useTeam();
  const active = players.filter((p) => p.status === 'active');
  const [pid, setPid] = useState(active[0]?.id ?? '');
  const [title, setTitle] = useState(PRESETS[0]);
  const [note, setNote] = useState('');
  return (
    <Modal
      title="Vinh danh cầu thủ"
      onClose={onClose}
      wide={520}
      footer={
        <button type="button" className="btn primary" disabled={!pid || title.trim().length < 2} onClick={async () => {
          const id = await act(() => giveHonorAction(teamId, { playerId: pid, title, note }), 'Đã vinh danh — cả đội được báo');
          if (id) onDone(id);
        }}>Vinh danh</button>
      }
    >
      <div className="hv-form">
        <div className="field"><label htmlFor="hvP">Cầu thủ</label>
          <select id="hvP" value={pid} onChange={(e) => setPid(e.target.value)}>{active.map((p) => <option key={p.id} value={p.id}>{shortName(p)}{p.num != null ? ` · #${p.num}` : ''}</option>)}</select>
        </div>
        <div className="field">
          <label htmlFor="hvT">Danh hiệu</label>
          <div className="hv-presets" role="group" aria-label="Gợi ý danh hiệu">
            {PRESETS.map((t) => <button key={t} type="button" className="chip" aria-pressed={title === t} onClick={() => setTitle(t)}>{t}</button>)}
          </div>
          <input id="hvT" maxLength={48} value={title} onChange={(e) => setTitle(e.target.value)} style={{ marginTop: 8 }} />
        </div>
        <div className="field"><label htmlFor="hvN">Lời khen (không bắt buộc)</label><textarea id="hvN" rows={3} maxLength={160} value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: Chạy không biết mệt, cứu thua 2 bàn chắc chắn" /></div>
        <p className="hint">Cả đội nhận thông báo; người được vinh danh tự mở thẻ lần tới vào app.</p>
      </div>
    </Modal>
  );
}

export function HonorsView({ data }: { data: HonorsData }) {
  const { view, byId } = useTeam();
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<HonorDTO | null>(null);
  const [queue, setQueue] = useState<string[]>(data.unseen);
  const [give, setGive] = useState(false);
  const [want, setWant] = useState<string | null>(null);
  const byHonor = useMemo(() => new Map(data.honors.map((h) => [h.id, h])), [data.honors]);

  // Tự mở lần lượt các thẻ mới chưa xem
  useEffect(() => {
    if (open || !queue.length) return;
    const h = byHonor.get(queue[0]);
    setQueue((q) => q.slice(1));
    if (h) setOpen(h);
  }, [open, queue, byHonor]);
  // Thẻ ĐT vừa vinh danh → mở ngay khi dữ liệu mới về
  useEffect(() => {
    if (want && byHonor.has(want)) {
      setOpen(byHonor.get(want)!);
      setWant(null);
    }
  }, [want, byHonor]);

  const list = data.honors.filter((h) =>
    filter === 'all' ? true : filter === 'month' ? h.kind === 'top_scorer' || h.kind === 'top_assist' : h.kind === filter,
  );
  const latest = data.honors.find((h) => h.kind !== 'stats') ?? data.honors[0] ?? null;
  const name = (h: HonorDTO) => {
    const p = byId(h.playerId);
    return p ? shortName(p) : h.card.name;
  };

  return (
    <section className="view hv">
      <div className="hv-hero">
        <div>
          <div className="hv-club">
            <svg viewBox="0 0 34 34" aria-hidden><path d="M17 2 L30 7 V17 C30 25 24 30 17 32 C10 30 4 25 4 17 V7 Z" fill="none" stroke="currentColor" strokeWidth="2.4" /><ellipse cx="17" cy="19" rx="3.2" ry="6" fill="currentColor" /><circle cx="17" cy="11" r="2.4" fill="currentColor" /></svg>
            {view.team.name}
          </div>
          <h2 className="vt">Vinh danh</h2>
          <p className="hv-sub">MVP từng trận, Vua phá lưới và Vua kiến tạo mỗi tháng được vinh danh tự động; đội trưởng vinh danh thêm những khoảnh khắc đáng nhớ. Bấm một dòng để mở thẻ.</p>
          <div className="hv-legend" aria-label="Hạng thẻ">
            <span><i className="hv-dot" style={{ background: '#D4FF3A' }} />Đom Đóm · từ 85</span>
            <span><i className="hv-dot" style={{ background: '#C9A33A' }} />Vàng · 75–84</span>
            <span><i className="hv-dot" style={{ background: '#9EA8B0' }} />Bạc · dưới 75</span>
          </div>
        </div>
        {latest && (
          <div className="hv-latest">
            <small>Mới nhất</small>
            <PlayerCard c={latest.card} team={view.team.name} onActivate={() => setOpen(latest)} />
            <b>{latest.title}</b>
          </div>
        )}
      </div>

      <div className="hv-bar">
        <div className="seg" role="group" aria-label="Lọc vinh danh">
          {([['all', 'Tất cả'], ['mvp', 'MVP'], ['month', 'Danh hiệu tháng'], ['captain', 'Đội trưởng'], ['stats', 'Chỉ số mới']] as Array<[Filter, string]>).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
        {data.canEdit && <button type="button" className="btn primary" onClick={() => setGive(true)}>+ Vinh danh cầu thủ</button>}
      </div>

      {list.length ? (
        <ul className="hv-list">
          {list.map((h) => {
            const t = cardTier(h.card.ovr);
            const p = byId(h.playerId);
            return (
              <li key={h.id}>
                <button type="button" className={`hv-row${!h.seen && (h.kind !== 'stats' || h.mine) ? ' new' : ''}`} onClick={() => setOpen(h)} aria-label={`Mở thẻ ${name(h)}: ${h.title}`}>
                  <span className="hv-ic" aria-hidden>{ICON[h.kind]}</span>
                  {p ? <Avatar p={p} size={44} /> : <span className="hv-ic" aria-hidden>{h.card.name.slice(0, 2).toUpperCase()}</span>}
                  <span className="who">
                    <b>{name(h)}{!h.seen && (h.kind !== 'stats' || h.mine) && <span className="hv-new">MỚI</span>}</b>
                    <small>{h.title} · {dm(h.createdAt.slice(0, 10))}</small>
                  </span>
                  <span className="hv-kind">{KIND[h.kind]}</span>
                  <span className={`hv-pill ${t}`}>{h.card.ovr}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : <div className="empty-list">Chưa có lần vinh danh nào{filter !== 'all' ? ' ở mục này' : ''}.</div>}

      {data.fame.length > 0 && (
        <div className="panel">
          <h3 className="st">Bảng vàng</h3>
          <ol className="hv-fame">
            {data.fame.map((f) => {
              const p = byId(f.playerId);
              const parts = (Object.entries(f.kinds) as Array<[HonorKind, number]>).map(([k, n]) => `${KIND[k]} ×${n}`);
              return (
                <li key={f.playerId}>
                  {p ? <Avatar p={p} size={36} /> : <span className="hv-ic">★</span>}
                  <span style={{ minWidth: 0 }}><b>{p ? shortName(p) : f.card.name}</b><small>{parts.join(' · ')}</small></span>
                  <span className="cnt">{f.total}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {open && <HonorRevealFor h={open} onClose={() => setOpen(null)} />}
      {give && <GiveModal onClose={() => setGive(false)} onDone={(id) => { setGive(false); setWant(id); }} />}
    </section>
  );
}
