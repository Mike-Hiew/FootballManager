import type { Metadata, Viewport } from 'next';
import { Be_Vietnam_Pro, Jost } from 'next/font/google';
import { connection } from 'next/server';
import './prototype.css';
import './app.css';
import { RegisterSW, UpdateBanner } from '@/components/Pwa';
import { InstallPrompt } from '@/components/InstallPrompt';

// Cùng subset và chuỗi font dự phòng với prototype: Jost không có chữ tiếng Việt (Ư, Ộ…) nên các
// ký tự đó rơi xuống font sau. Font "Fallback" co giãn của next/font sẽ làm chữ khác prototype và khác theo máy.
const body = Be_Vietnam_Pro({
  subsets: ['latin', 'latin-ext', 'vietnamese'], weight: ['300', '400', '500', '600', '700'], variable: '--font-body', display: 'swap',
  adjustFontFallback: false, fallback: ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
});
const display = Jost({
  subsets: ['latin', 'latin-ext'], weight: ['300', '400', '500', '600', '700'], variable: '--font-display', display: 'swap',
  adjustFontFallback: false, fallback: ['Futura', 'Century Gothic', 'system-ui', 'sans-serif'],
});

export const metadata: Metadata = {
  title: { default: process.env.APP_NAME ?? 'Đom Đóm FC', template: `%s · ${process.env.APP_NAME ?? 'Đom Đóm FC'}` },
  description: 'Quản lý đội bóng phong trào sân 7: cầu thủ, chiến thuật, lịch đấu, điểm danh, MVP và quỹ đội.',
  manifest: '/manifest.webmanifest',
  // iOS không dùng SVG cho icon màn hình chính: thiếu PNG thì icon là ảnh chụp trang
  icons: { icon: [{ url: '/icon.svg', type: 'image/svg+xml' }, { url: '/icon-192.png', sizes: '192x192', type: 'image/png' }], apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }] },
  appleWebApp: { capable: true, title: process.env.APP_NAME ?? 'Đom Đóm FC', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#08090b' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // CSP dùng nonce theo từng request (proxy.ts) nên mọi trang phải render động, không prerender lúc build.
  await connection();
  return (
    <html lang="vi" data-theme="light" className={`${body.variable} ${display.variable}`}>
      <body>
        <div className="room" aria-hidden="true">
          <i className="sky" /><i className="roof" /><i className="stand" /><i className="crowd" /><i className="fl l" /><i className="fl r" />
          <i className="field" /><i className="ring" /><i className="goal" />
        </div>
        {children}
        <RegisterSW />
        <UpdateBanner />
        <InstallPrompt />
      </body>
    </html>
  );
}
