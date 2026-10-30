/**
 * Content-Security-Policy theo hướng dẫn Next (nonce + 'strict-dynamic'): chỉ script mang nonce của
 * request mới chạy, nên nội dung người dùng có lọt HTML cũng không chạy được script.
 * - Ảnh: avatar/ảnh đội là URL https bất kỳ (imageUrlSchema), data: khi chưa có R2, blob: khi xem trước.
 * - Kết nối: upload presigned PUT thẳng lên R2.
 * - style-src-attr: component dùng thuộc tính style (React `style={{…}}`), không phải thẻ <style>.
 * - Dev: Turbopack chèn CSS bằng thẻ <style> không có nonce (HMR) nên nới style-src; production giữ nonce.
 */
export function contentSecurityPolicy(nonce: string, opts: { dev?: boolean; r2AccountId?: string } = {}) {
  const r2 = opts.r2AccountId ? ` https://${opts.r2AccountId}.r2.cloudflarestorage.com` : '';
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${opts.dev ? ` 'unsafe-eval'` : ''}`,
    opts.dev ? `style-src 'self' 'unsafe-inline'` : `style-src 'self' 'nonce-${nonce}'`,
    `style-src-attr 'unsafe-inline'`,
    `img-src 'self' https: data: blob:`,
    `font-src 'self'`,
    `connect-src 'self'${r2}`,
    `worker-src 'self'`,
    `manifest-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    ...(opts.dev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
}
