/**
 * Đồng hồ hệ thống. Ở môi trường test/staging có thể đặt SAN7_FAKE_NOW (ISO) hoặc
 * SAN7_TIME_OFFSET_DAYS để thử "đổi năm" hay "qua 24 giờ" (BRD 11.1) mà không đổi giờ máy.
 */
export function now(): Date {
  if (process.env.NODE_ENV !== 'production' || process.env.SAN7_ALLOW_FAKE_TIME === 'true') {
    if (process.env.SAN7_FAKE_NOW) return new Date(process.env.SAN7_FAKE_NOW);
    const off = Number(process.env.SAN7_TIME_OFFSET_DAYS || 0);
    if (off) return new Date(Date.now() + off * 864e5);
  }
  return new Date();
}
