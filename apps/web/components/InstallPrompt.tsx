'use client';
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from 'react';

/**
 * Lời mời cài app lên màn hình chính.
 * - Android / Chrome desktop: trình duyệt bắn `beforeinstallprompt` → nút "Cài app" mở hộp cài đặt thật.
 * - iPhone / iPad: Safari không có hộp cài tự động → hướng dẫn Chia sẻ → "Thêm vào MH chính".
 * - Trình duyệt trong Zalo / Facebook / Messenger…: không cài được → hướng dẫn mở bằng Safari / Chrome.
 * Không chặn thao tác; "Để sau" ẩn tới lần mở app sau; đã mở từ icon (standalone) thì không hiện.
 */

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Kind = 'ios' | 'ipad' | 'inapp-ios' | 'inapp-android' | 'android';

const KEY = 'san7-install-later';
const later = () => {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};
const setLater = () => {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {}
};

export function isStandalone() {
  return matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

/** Loại thiết bị/trình duyệt cần hướng dẫn riêng (null = để trình duyệt tự lo hoặc không hỗ trợ). */
export function installKind(ua: string, touchPoints: number): Exclude<Kind, 'android'> | null {
  const ipad = /ipad/i.test(ua) || (/macintosh/i.test(ua) && touchPoints > 1);
  const ios = /iphone|ipod/i.test(ua) || ipad;
  const inapp = /zalo|fban|fbav|fb_iab|messenger|instagram|line\/|tiktok|musical_ly|bytedance/i.test(ua);
  if (inapp) return ios ? 'inapp-ios' : /android/i.test(ua) ? 'inapp-android' : null;
  if (ipad) return 'ipad';
  if (ios) return 'ios';
  return null;
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
    </svg>
  );
}

function AddIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

export function InstallPrompt() {
  const [kind, setKind] = useState<Kind | null>(null);
  const [bip, setBip] = useState<BIPEvent | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isStandalone() || later()) return;
    const k = installKind(navigator.userAgent, navigator.maxTouchPoints || 0);
    // nhường popup khác (tỉ số trận, bật thông báo…) hiện trước, xong mới mời cài
    const t = setInterval(() => {
      if (!k || document.querySelector('.overlay')) return;
      clearInterval(t);
      setKind((cur) => cur ?? k);
    }, 1200);
    const onBip = (e: Event) => {
      e.preventDefault(); // giữ lại để mở bằng nút của app
      setBip(e as BIPEvent);
      if (later()) return;
      const show = setInterval(() => {
        if (document.querySelector('.overlay')) return;
        clearInterval(show);
        setKind('android');
      }, 1200);
    };
    const onInstalled = () => setKind(null);
    window.addEventListener('beforeinstallprompt', onBip);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      clearInterval(t);
      window.removeEventListener('beforeinstallprompt', onBip);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!kind) return null;
  const close = () => {
    setLater();
    setKind(null);
  };
  const name = process.env.NEXT_PUBLIC_APP_NAME ?? 'Đom Đóm FC';

  return (
    <div className={`install-sheet k-${kind}`} role="dialog" aria-label={`Cài ${name} lên màn hình chính`}>
      <button type="button" className="is-x" aria-label="Để sau" onClick={close}>✕</button>
      <div className="is-head">
        <img src="/apple-touch-icon.png" alt="" width={52} height={52} />
        <div>
          <b>Cài {name} lên điện thoại</b>
          <span>Mở nhanh như app, nhận thông báo điểm danh, tỉ số, đóng quỹ.</span>
        </div>
      </div>

      {(kind === 'ios' || kind === 'ipad') && (
        <ol className="is-steps">
          <li><i>1</i>Bấm nút <b className="is-key"><ShareIcon /> Chia sẻ</b> {kind === 'ipad' ? 'ở góc trên bên phải Safari' : 'ở thanh dưới cùng của Safari'}</li>
          <li><i>2</i>Kéo xuống, chọn <b className="is-key"><AddIcon /> Thêm vào MH chính</b></li>
          <li><i>3</i>Bấm <b>Thêm</b>, rồi mở app từ icon đom đóm ngoài màn hình chính</li>
        </ol>
      )}

      {(kind === 'inapp-ios' || kind === 'inapp-android') && (
        <>
          <ol className="is-steps">
            <li><i>1</i>Bạn đang mở trong Zalo / Facebook nên chưa cài được</li>
            <li><i>2</i>Bấm <b>⋯</b> ở góc trên, chọn <b>{kind === 'inapp-ios' ? 'Mở bằng Safari' : 'Mở bằng trình duyệt / Chrome'}</b> — hoặc sao chép link dán vào {kind === 'inapp-ios' ? 'Safari' : 'Chrome'}</li>
            <li><i>3</i>Trong {kind === 'inapp-ios' ? 'Safari: Chia sẻ → Thêm vào MH chính' : 'Chrome: chọn Cài đặt ứng dụng'}</li>
          </ol>
          <div className="is-acts">
            <button
              type="button"
              className="btn primary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(location.href);
                  setCopied(true);
                } catch {}
              }}
            >
              {copied ? 'Đã sao chép link' : 'Sao chép link'}
            </button>
            <button type="button" className="btn" onClick={close}>Để sau</button>
          </div>
        </>
      )}

      {kind === 'android' && (
        <div className="is-acts">
          <button
            type="button"
            className="btn primary"
            onClick={async () => {
              if (!bip) return;
              await bip.prompt();
              const r = await bip.userChoice.catch(() => null);
              setBip(null);
              if (r?.outcome === 'accepted') setKind(null);
              else close();
            }}
          >
            Cài app
          </button>
          <button type="button" className="btn" onClick={close}>Để sau</button>
        </div>
      )}

      {(kind === 'ios' || kind === 'ipad') && (
        <div className="is-acts"><button type="button" className="btn" onClick={close}>Để sau</button></div>
      )}
      {kind === 'ios' && <div className="is-arrow" aria-hidden="true" />}
    </div>
  );
}
