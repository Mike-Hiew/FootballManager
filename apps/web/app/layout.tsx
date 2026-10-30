import type { Metadata, Viewport } from 'next';
import { Be_Vietnam_Pro, Jost } from 'next/font/google';
import './prototype.css';
import './app.css';

const body = Be_Vietnam_Pro({ subsets: ['latin', 'vietnamese'], weight: ['300', '400', '500', '600', '700'], variable: '--font-body', display: 'swap' });
const display = Jost({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'], variable: '--font-display', display: 'swap' });

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
      </body>
    </html>
  );
}
