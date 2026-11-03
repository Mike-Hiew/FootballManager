'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useTeam } from './TeamContext';
import { markRemindersSeenAction } from '@/app/actions';
import { notifHref, timeAgo } from '@/lib/notif';
import type { ReminderDTO } from '@/server/services/notify';

/** Biểu tượng + nhãn nút theo loại lời nhắc. */
function meta(r: ReminderDTO): { icon: string; tone: string; cta: string } {
  if (r.kind === 'vote') return { icon: '✋', tone: 'vote', cta: 'Điểm danh' };
  if (r.kind === 'fund') return { icon: '₫', tone: 'fund', cta: 'Đóng tiền' };
  if (r.kind === 'transfer') return { icon: '⇄', tone: 'transfer', cta: 'Định giá' };
  if (r.kind === 'edit' && r.view === 'toi') return { icon: '✎', tone: 'edit', cta: 'Cập nhật' };
  if (r.kind === 'edit') return { icon: '★', tone: 'edit', cta: 'Chấm chỉ số' };
  return { icon: '!', tone: 'other', cta: 'Xem' };
}

/**
 * Popup "Đội trưởng nhắc bạn": lần đầu vào app sau khi ĐT bấm nhắc, liệt kê các lời nhắc chưa đọc,
 * mỗi dòng có nút tới đúng chỗ cần làm. Đóng / bấm đi tới → đánh dấu đã xem, không hiện lại.
 * Đợi popup tỉ số trận và thẻ vinh danh đóng rồi mới hiện (không chồng lớp phủ).
 */
export function RemindersPopup() {
  const { view, teamId } = useTeam();
  const router = useRouter();
  const [items, setItems] = useState<ReminderDTO[] | null>(null);
  const [closing, setClosing] = useState(false);
  const [clear, setClear] = useState(false);
  const shownFor = useRef<string>('');
  const firstBtn = useRef<HTMLButtonElement>(null);
  const list = view.reminders;
  const key = list.map((r) => r.id).join(',');

  // Lấy danh sách một lần cho mỗi bộ lời nhắc mới (không bị tải lại khi trang revalidate)
  useEffect(() => {
    if (!key || shownFor.current === key) return;
    shownFor.current = key;
    setItems(list);
    setClosing(false);
  }, [key, list]);

  // Đợi các lớp phủ khác đóng
  useEffect(() => {
    if (!items?.length) return;
    let calm = 0;
    const t = setInterval(() => {
      calm = document.querySelector('.rp-overlay, .hc-overlay') ? 0 : calm + 1;
      if (calm >= 3) {
        setClear(true);
        clearInterval(t);
      }
    }, 300);
    return () => clearInterval(t);
  }, [items]);

  const open = !!items?.length && clear;
  useEffect(() => {
    if (!open) return;
    firstBtn.current?.focus({ preventScroll: true });
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !items) return null;

  const finish = (to?: string | null) => {
    const ids = items.map((r) => r.id);
    setClosing(true);
    void markRemindersSeenAction(ids);
    setTimeout(() => {
      setItems(null);
      setClear(false);
      if (to) router.push(to);
    }, 180);
  };

  const captains = [...new Set(items.map((r) => r.actor).filter(Boolean))] as string[];

  return createPortal(
    <div
      className={`rm-overlay${closing ? ' closing' : ''}`}
      onMouseDown={(e) => e.target === e.currentTarget && finish()}
      onKeyDown={(e) => e.key === 'Escape' && finish()}
    >
      <div className="rm-sheet" role="dialog" aria-modal="true" aria-labelledby="rmTitle">
        <header className="rm-head">
          <span className="rm-mega" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></svg>
          </span>
          <div>
            <h2 id="rmTitle">Đội trưởng nhắc bạn</h2>
            <p>
              {items.length} việc cần làm
              {captains.length > 0 && <> · từ <b>{captains.join(', ')}</b></>}
            </p>
          </div>
        </header>
        <ul className="rm-list">
          {items.map((r, i) => {
            const m = meta(r);
            const to = notifHref({ teamId, matchId: r.matchId, view: r.view, kind: r.kind });
            return (
              <li key={r.id} className={`rm-item ${m.tone}`} style={{ animationDelay: `${80 + i * 60}ms` }}>
                <span className="rm-ic" aria-hidden>{m.icon}</span>
                <div className="rm-body">
                  <p>{r.text}</p>
                  <small>{timeAgo(r.createdAt)}{r.actor ? ` · ${r.actor}` : ''}</small>
                </div>
                {to && (
                  <button ref={i === 0 ? firstBtn : undefined} type="button" className="rm-go" onClick={() => finish(to)} aria-label={`${m.cta}: ${r.text}`}>
                    {m.cta} <span aria-hidden>→</span>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <footer className="rm-foot">
          <button type="button" className="btn ghost" onClick={() => finish()}>Để sau</button>
          <button type="button" className="btn primary" onClick={() => finish()}>Đã hiểu</button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
