'use client';

/**
 * Resize ảnh ở trình duyệt trước khi gửi (ARCHITECTURE D9): avatar ≤ 320 px (cắt vuông),
 * ảnh đội ≤ 1200 px JPEG 80 %, ảnh cúp ≤ 320 px PNG. Nếu server cấu hình R2 thì upload
 * thẳng bằng presigned URL; không thì trả về data URL (dev/staging).
 */
export type ImageKind = 'avatar' | 'team' | 'award';
const SPEC: Record<ImageKind, { max: number; square: boolean; type: string; q: number }> = {
  avatar: { max: 320, square: true, type: 'image/jpeg', q: 0.82 },
  team: { max: 1200, square: false, type: 'image/jpeg', q: 0.8 },
  award: { max: 320, square: false, type: 'image/png', q: 1 },
};

function load(file: File): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      res(img);
    };
    img.onerror = () => rej(new Error('Không đọc được ảnh này'));
    img.src = url;
  });
}

export async function resizeImage(file: File, kind: ImageKind): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Chọn một file ảnh (jpg, png…)');
  const img = await load(file);
  const spec = SPEC[kind];
  const c = document.createElement('canvas');
  const g = c.getContext('2d')!;
  if (spec.square) {
    const s = Math.min(img.width, img.height);
    const out = Math.min(spec.max, s);
    c.width = c.height = out;
    g.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, out, out);
  } else {
    const k = Math.min(1, spec.max / Math.max(img.width, img.height));
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    g.drawImage(img, 0, 0, c.width, c.height);
  }
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Không nén được ảnh'))), spec.type, spec.q));
}

const toDataUrl = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error('Không đọc được ảnh'));
    r.readAsDataURL(b);
  });

export async function uploadImage(file: File, kind: ImageKind): Promise<string> {
  const blob = await resizeImage(file, kind);
  const sign = await fetch('/api/uploads/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, contentType: blob.type, size: blob.size }),
  }).catch(() => null);
  if (sign?.ok) {
    const { uploadUrl, publicUrl } = (await sign.json()) as { uploadUrl: string; publicUrl: string };
    const put = await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': blob.type } });
    if (put.ok) return publicUrl;
  }
  return toDataUrl(blob);
}
