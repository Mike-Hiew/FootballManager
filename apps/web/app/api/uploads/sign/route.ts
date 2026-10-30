import { createHmac, createHash, randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { requireUser } from '@/server/authz';
import { assertSameOrigin, handle, json } from '@/server/http';
import { invalid } from '@/server/errors';

const MAX: Record<string, number> = { avatar: 300_000, team: 2_000_000, award: 400_000 };
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Presigned PUT lên Cloudflare R2 (S3 SigV4, ARCHITECTURE D9). Không cấu hình R2 → 501,
 * client tự dùng data URL (chỉ cho dev/staging).
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = await requireUser();
    const { R2_ACCOUNT_ID: acc, R2_ACCESS_KEY_ID: key, R2_SECRET_ACCESS_KEY: secret, R2_BUCKET: bucket, R2_PUBLIC_URL: pub } = process.env;
    if (!acc || !key || !secret || !bucket || !pub) return json({ error: 'R2 chưa cấu hình' }, 501);
    const b = (await req.json().catch(() => ({}))) as { kind?: string; contentType?: string; size?: number };
    if (!b.kind || !(b.kind in MAX)) throw invalid('Loại ảnh không hợp lệ');
    if (!b.contentType || !TYPES.has(b.contentType)) throw invalid('Chỉ nhận ảnh JPEG/PNG/WebP');
    if (!b.size || b.size > MAX[b.kind]) throw invalid('Ảnh quá lớn');
    const ext = b.contentType.split('/')[1].replace('jpeg', 'jpg');
    const objectKey = `${b.kind}/${user.id}/${randomUUID()}.${ext}`;
    const host = `${acc}.r2.cloudflarestorage.com`;
    const uploadUrl = presign({ host, bucket, objectKey, key, secret, contentType: b.contentType });
    return { uploadUrl, publicUrl: `${pub.replace(/\/$/, '')}/${objectKey}` };
  });
}

function presign(o: { host: string; bucket: string; objectKey: string; key: string; secret: string; contentType: string }) {
  const t = new Date();
  const amz = t.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const day = amz.slice(0, 8);
  const scope = `${day}/auto/s3/aws4_request`;
  const path = `/${o.bucket}/${o.objectKey.split('/').map(encodeURIComponent).join('/')}`;
  const q = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${o.key}/${scope}`,
    'X-Amz-Date': amz,
    'X-Amz-Expires': '300',
    'X-Amz-SignedHeaders': 'content-type;host',
  });
  q.sort();
  const canonical = ['PUT', path, q.toString().replace(/\+/g, '%20'), `content-type:${o.contentType}\nhost:${o.host}\n`, 'content-type;host', 'UNSIGNED-PAYLOAD'].join('\n');
  const toSign = ['AWS4-HMAC-SHA256', amz, scope, createHash('sha256').update(canonical).digest('hex')].join('\n');
  const h = (k: Buffer | string, d: string) => createHmac('sha256', k).update(d).digest();
  const kSign = h(h(h(h('AWS4' + o.secret, day), 'auto'), 's3'), 'aws4_request');
  const sig = createHmac('sha256', kSign).update(toSign).digest('hex');
  return `https://${o.host}${path}?${q.toString().replace(/\+/g, '%20')}&X-Amz-Signature=${sig}`;
}
