import type { Metadata, Viewport } from 'next';
import { Barlow_Condensed, Be_Vietnam_Pro } from 'next/font/google';
import { connection } from 'next/server';
import './v2.css';
import './app.css';
import { RegisterSW, UpdateBanner } from '@/components/Pwa';
import { InstallPrompt } from '@/components/InstallPrompt';

// Cùng font với prototype v2: Barlow Condensed (tiêu đề, số, có chữ tiếng Việt và kiểu nghiêng) + Be Vietnam Pro.
// Tắt font "Fallback" co giãn của next/font để chữ giống prototype trên mọi máy.
const body = Be_Vietnam_Pro({
  subsets: ['latin', 'latin-ext', 'vietnamese'], weight: ['400', '500', '600', '700'], variable: '--font-body', display: 'swap',
  adjustFontFallback: false, fallback: ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
});
const display = Barlow_Condensed({
  subsets: ['latin', 'latin-ext', 'vietnamese'], weight: ['500', '600', '700'], style: ['normal', 'italic'], variable: '--font-display', display: 'swap',
  adjustFontFallback: false, fallback: ['Arial Narrow', 'Roboto Condensed', 'system-ui', 'sans-serif'],
});

export const metadata: Metadata = {
  title: { default: process.env.APP_NAME ?? 'Đom Đóm FC', template: `%s · ${process.env.APP_NAME ?? 'Đom Đóm FC'}` },
  description: 'Quản lý đội bóng phong trào sân 7: cầu thủ, chiến thuật, lịch đấu, điểm danh, MVP và quỹ đội.',
  manifest: '/manifest.webmanifest',
  // iOS không dùng SVG cho icon màn hình chính: thiếu PNG thì icon là ảnh chụp trang
  icons: { icon: [{ url: '/icon.svg', type: 'image/svg+xml' }, { url: '/icon-192.png', sizes: '192x192', type: 'image/png' }], apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }] },
  appleWebApp: { capable: true, title: process.env.APP_NAME ?? 'Đom Đóm FC', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#090c12' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // CSP dùng nonce theo từng request (proxy.ts) nên mọi trang phải render động, không prerender lúc build.
  await connection();
  return (
    <html lang="vi" data-theme="dark" className={`${body.variable} ${display.variable}`}>
      <body>
        {children}
        <RegisterSW />
        <UpdateBanner />
        <InstallPrompt />
      </body>
    </html>
  );
}
