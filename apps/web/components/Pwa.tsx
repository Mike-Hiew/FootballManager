'use client';

import { useEffect, useRef, useState } from 'react';
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

// "Để sau" chỉ ẩn trong lần mở app này: mở app lần sau vẫn hỏi lại cho tới khi bật.
const DISMISS_KEY = 'san7-push-ask';
const dismissed = () => {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
};
const dismiss = () => {
  try {
    sessionStorage.setItem(DISMISS_KEY, '1');
  } catch {}
};

/** Hướng dẫn mở lại thông báo đã bị chặn: trình duyệt không cho app hỏi lại nữa. */
function UnblockSteps() {
  const ua = navigator.userAgent;
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone;
  if (/iphone|ipad|ipod/i.test(ua)) {
    return <p style={{ margin: 0 }}>Mở <b>Cài đặt</b> của iPhone → <b>Thông báo</b> → <b>{process.env.NEXT_PUBLIC_APP_NAME ?? 'Đom Đóm FC'}</b> → bật <b>Cho phép thông báo</b>, rồi quay lại app.</p>;
  }
  if (/android/i.test(ua)) {
    return standalone
      ? <p style={{ margin: 0 }}>Nhấn giữ icon app ngoài màn hình chính → <b>Thông tin ứng dụng</b> → <b>Thông báo</b> → bật, rồi quay lại app.</p>
      : <p style={{ margin: 0 }}>Bấm biểu tượng <b>ổ khoá / cài đặt</b> cạnh thanh địa chỉ → <b>Quyền</b> → <b>Thông báo</b> → <b>Cho phép</b>, rồi tải lại trang.</p>;
  }
  return <p style={{ margin: 0 }}>Bấm biểu tượng <b>ổ khoá</b> cạnh thanh địa chỉ → <b>Thông báo</b> → <b>Cho phép</b>, rồi tải lại trang.</p>;
}

/**
 * Mỗi lần mở app đều kiểm tra thông báo; chưa bật thì hiện popup (kể cả khi người dùng đã tắt đi).
 * Trình duyệt chỉ cho xin quyền khi người dùng bấm, nên đây là popup của app với nút "Bật thông báo";
 * đã chặn thì trình duyệt không cho hỏi lại, popup hướng dẫn bật trong cài đặt. Quay lại app (từ Cài đặt)
 * là kiểm tra lại; đã có quyền thì đăng ký lại lặng lẽ (máy mới / cài lại app vẫn nhận được thông báo).
 */
export function PushAsk() {
  const [state, setState] = useState<PushState>('hidden');
  const [busy, setBusy] = useState(false);
  const shown = useRef(false);
  shown.current = state !== 'hidden' && state !== 'done';
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const check = () => {
      if (document.visibilityState !== 'visible') return;
      const s = pushState();
      if (s === 'done') {
        setState('hidden');
        void subscribePush().catch(() => {});
        return;
      }
      clearInterval(timer);
      // iPhone chưa cài app: lời mời cài (InstallPrompt) đã hướng dẫn, không hỏi trùng ở đây
      if (s === 'hidden' || s === 'ios' || dismissed()) return setState('hidden');
      if (shown.current) return setState(s); // popup đang mở: chỉ cập nhật nội dung
      // nhường popup khác (tỉ số trận vừa đá…) hiện trước
      timer = setInterval(() => {
        if (document.querySelector('.overlay')) return;
        clearInterval(timer);
        if (!dismissed()) setState(s);
      }, 1500);
    };
    check();
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  if (state === 'hidden' || state === 'done') return null;
  const later = () => {
    dismiss();
    setState('hidden');
  };
  return (
    <Modal
      title={state === 'denied' ? 'Thông báo đang tắt' : 'Bật thông báo'}
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
      <p style={{ marginTop: 0 }}>{state === 'denied' ? 'Bạn đang không nhận được thông báo nên có thể bỏ lỡ:' : 'Nhận thông báo trên điện thoại để không bỏ lỡ:'}</p>
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
      {state === 'denied' && <div className="note"><UnblockSteps /></div>}
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
