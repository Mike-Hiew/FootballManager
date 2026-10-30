'use client';

import { useEffect, useState } from 'react';
import { pushSubscribeAction } from '@/app/actions';
import { Modal } from './ui';

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

/** Đăng ký Web Push với server. Gọi khi đã có quyền, hoặc trong lúc người dùng bấm (iOS bắt buộc). */
async function subscribePush(): Promise<NotificationPermission> {
  // xin quyền trước mọi await khác: Safari chỉ hiện hộp xin quyền khi còn trong lượt bấm của người dùng
  const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (perm !== 'granted') return perm;
  await navigator.serviceWorker.register('/sw.js');
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID) }));
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await pushSubscribeAction({ endpoint: j.endpoint, keys: j.keys });
  return perm;
}

type PushState = 'hidden' | 'ask' | 'ios' | 'done' | 'denied';

function pushState(): PushState {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone;
  if (ios && !standalone) return 'ios';
  if (!VAPID || !('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return 'hidden';
  if (Notification.permission === 'granted') return 'done';
  if (Notification.permission === 'denied') return 'denied';
  return 'ask';
}

const SNOOZE_KEY = 'san7-push-ask';
const snoozed = () => {
  try {
    return Number(localStorage.getItem(SNOOZE_KEY) ?? 0) > Date.now();
  } catch {
    return false;
  }
};
const snooze = (days: number) => {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + days * 864e5));
  } catch {}
};

/**
 * Mở app là hỏi bật thông báo. Trình duyệt chỉ cho xin quyền khi người dùng bấm, nên đây là popup của app
 * với nút "Bật thông báo"; "Để sau" thì 3 ngày sau hỏi lại. Đã có quyền thì đăng ký lại lặng lẽ
 * (máy mới / cài lại app vẫn nhận được thông báo).
 */
export function PushAsk() {
  const [state, setState] = useState<PushState>('hidden');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const s = pushState();
    if (s === 'done') {
      void subscribePush().catch(() => {});
      return;
    }
    if ((s !== 'ask' && s !== 'ios') || snoozed()) return;
    // nhường popup khác (tỉ số trận vừa đá…) hiện trước
    const timer = setInterval(() => {
      if (document.querySelector('.overlay')) return;
      clearInterval(timer);
      setState(s);
    }, 1500);
    return () => clearInterval(timer);
  }, []);
  if (state !== 'ask' && state !== 'ios') return null;
  const later = () => {
    snooze(state === 'ios' ? 7 : 3);
    setState('hidden');
  };
  return (
    <Modal
      title="Bật thông báo"
      onClose={later}
      footer={
        state === 'ask' ? (
          <>
            <button type="button" className="btn ghost" onClick={later}>Để sau</button>
            <button
              type="button"
              className="btn primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const perm = await subscribePush().catch(() => 'denied' as const);
                setBusy(false);
                if (perm === 'default') return later();
                setState(perm === 'granted' ? 'done' : 'denied');
              }}
            >
              Bật thông báo
            </button>
          </>
        ) : (
          <button type="button" className="btn primary" onClick={later}>Đã hiểu</button>
        )
      }
    >
      <p style={{ marginTop: 0 }}>Nhận thông báo trên điện thoại để không bỏ lỡ:</p>
      <ul style={{ margin: '0 0 12px', paddingLeft: 20, lineHeight: 1.7 }}>
        <li>Điểm danh trận mới, bấm Đi / Nghỉ ngay trên màn hình khoá</li>
        <li>Tỉ số và kết quả trận</li>
        <li>Yêu cầu đóng quỹ, tiền đá lẻ và kết quả duyệt</li>
      </ul>
      {state === 'ios' && (
        <p className="note" style={{ margin: 0 }}>
          Trên iPhone, thông báo chỉ hoạt động khi đã cài app: bấm nút <b>Chia sẻ</b> của Safari, chọn <b>“Thêm vào màn hình chính”</b>, rồi mở app từ icon ngoài màn hình chính.
        </p>
      )}
    </Modal>
  );
}

/** Nút bật thông báo ở màn Của tôi (cho người đã bấm "Để sau"). */
export function PushPrompt() {
  const [state, setState] = useState<PushState>('hidden');
  useEffect(() => setState(pushState()), []);
  if (state === 'hidden' || state === 'done') return null;
  if (state === 'ios') {
    return (
      <div className="note">
        <b>Nhận thông báo trên iPhone:</b> bấm nút Chia sẻ của Safari rồi chọn <b>“Thêm vào màn hình chính”</b>, mở app từ màn hình chính và bật thông báo.
      </div>
    );
  }
  if (state === 'denied') {
    return <div className="note">Thông báo đang bị chặn. Mở cài đặt trang web (biểu tượng ổ khoá cạnh địa chỉ) hoặc cài đặt thông báo của điện thoại, cho phép thông báo rồi mở lại app.</div>;
  }
  return (
    <div className="note" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <span>Bật thông báo để điểm danh ngay từ màn hình khoá.</span>
      <button
        type="button"
        className="btn primary sm"
        onClick={async () => {
          const perm = await subscribePush().catch(() => 'denied' as const);
          setState(perm === 'granted' ? 'done' : perm === 'denied' ? 'denied' : 'ask');
        }}
      >
        Bật thông báo
      </button>
    </div>
  );
}
