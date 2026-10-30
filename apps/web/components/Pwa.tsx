'use client';

import { useEffect, useState } from 'react';
import { pushSubscribeAction } from '@/app/actions';

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Đăng ký service worker (chỉ production). */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  return null;
}

/** Báo "Có phiên bản mới" khi server đã chạy bản build khác (kiểm khi mở lại app và mỗi 5 phút). */
export function UpdateBanner() {
  const [stale, setStale] = useState(false);
  useEffect(() => {
    const mine = process.env.NEXT_PUBLIC_BUILD_ID;
    if (process.env.NODE_ENV !== 'production' || !mine || mine === 'dev') return;
    let found = false;
    const check = async () => {
      if (found || document.visibilityState !== 'visible') return;
      try {
        const { version } = (await (await fetch('/api/version', { cache: 'no-store' })).json()) as { version?: string };
        if (version && version !== 'dev' && version !== mine) {
          found = true;
          setStale(true);
        }
      } catch {}
    };
    const timer = setInterval(check, 5 * 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  if (!stale) return null;
  return (
    <div className="toast" role="status" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <span>Có phiên bản mới</span>
      <button type="button" className="btn primary sm" onClick={() => location.reload()}>
        Cập nhật
      </button>
    </div>
  );
}

/**
 * Bật thông báo đẩy + hướng dẫn cài PWA trên iPhone (iOS chỉ nhận push khi đã
 * "Thêm vào màn hình chính" — ARCHITECTURE 7.1).
 */
export function PushPrompt() {
  const [state, setState] = useState<'hidden' | 'ask' | 'ios' | 'done' | 'denied'>('hidden');
  useEffect(() => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone;
    if (ios && !standalone) return setState('ios');
    if (!VAPID || !('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (Notification.permission === 'granted') return setState('done');
    if (Notification.permission === 'denied') return setState('denied');
    setState('ask');
  }, []);
  if (state === 'hidden' || state === 'done') return null;
  if (state === 'ios') {
    return (
      <div className="note">
        <b>Nhận thông báo trên iPhone:</b> bấm nút Chia sẻ của Safari rồi chọn <b>“Thêm vào màn hình chính”</b>, mở app từ màn hình chính và bật thông báo.
      </div>
    );
  }
  if (state === 'denied') return null;
  return (
    <div className="note" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <span>Bật thông báo để điểm danh ngay từ màn hình khoá.</span>
      <button
        type="button"
        className="btn primary sm"
        onClick={async () => {
          try {
            const reg = await navigator.serviceWorker.register('/sw.js');
            const perm = await Notification.requestPermission();
            if (perm !== 'granted') return setState('denied');
            const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID) });
            const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
            await pushSubscribeAction({ endpoint: j.endpoint, keys: j.keys });
            setState('done');
          } catch {
            setState('denied');
          }
        }}
      >
        Bật thông báo
      </button>
    </div>
  );
}
