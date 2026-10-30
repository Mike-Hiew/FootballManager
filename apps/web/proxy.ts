import { NextResponse, type NextRequest } from 'next/server';
import { contentSecurityPolicy } from './server/csp';

/** Gắn CSP có nonce riêng cho mỗi lần tải trang (Next tự gắn nonce vào script/style của framework). */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = contentSecurityPolicy(nonce, { dev: process.env.NODE_ENV === 'development', r2AccountId: process.env.R2_ACCOUNT_ID });
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set('Content-Security-Policy', csp);
  return res;
}

export const config = {
  matcher: [
    {
      // Bỏ qua API, file tĩnh và file trong public/ (sw.js, manifest, offline.html, icon)
      source: '/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|offline.html|icon.svg).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
