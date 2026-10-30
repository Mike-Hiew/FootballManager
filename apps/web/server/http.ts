import { NextResponse, type NextRequest } from 'next/server';
import { unstable_rethrow } from 'next/navigation';
import { AppError } from './errors';

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

/**
 * Chống CSRF cho Route Handler: request ghi phải cùng origin (Origin khớp Host
 * hoặc Sec-Fetch-Site = same-origin). Cookie phiên là SameSite=Lax nên đây là lớp thứ hai.
 */
export function assertSameOrigin(req: NextRequest) {
  if (req.method === 'GET' || req.method === 'HEAD') return;
  const site = req.headers.get('sec-fetch-site');
  if (site === 'same-origin') return;
  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (origin && host && new URL(origin).host === host) return;
  throw new AppError(403, 'Yêu cầu không hợp lệ (khác nguồn)');
}

export async function handle(fn: () => Promise<unknown>): Promise<NextResponse> {
  try {
    const r = await fn();
    return r instanceof NextResponse ? r : json(r ?? { ok: true });
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof AppError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: 'Lỗi máy chủ' }, 500);
  }
}
