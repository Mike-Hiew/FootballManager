import type { Metadata, Viewport } from 'next';
import { Be_Vietnam_Pro, Jost } from 'next/font/google';
import './prototype.css';
import './app.css';
import { RegisterSW } from '@/components/Pwa';

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
  title: { default: process.env.APP_NAME ?? 'Sân 7 Manager', template: `%s · ${process.env.APP_NAME ?? 'Sân 7 Manager'}` },
  description: 'Quản lý đội bóng phong trào sân 7: cầu thủ, chiến thuật, lịch đấu, điểm danh, MVP và quỹ đội.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Sân 7', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#08090b' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" data-theme="light" className={`${body.variable} ${display.variable}`}>
      <body>
        <div className="room" aria-hidden="true">
          <i className="sky" /><i className="roof" /><i className="stand" /><i className="crowd" /><i className="fl l" /><i className="fl r" />
          <i className="field" /><i className="ring" /><i className="goal" />
        </div>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
