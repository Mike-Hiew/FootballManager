import { headers } from 'next/headers';
import { prisma } from '@san7/db';
import { AppError } from './errors';
import { now } from './clock';

export interface Rule { max: number; windowMs: number }

const MIN = 60e3;
/** Ngưỡng theo IP cho các thao tác không cần đăng nhập. Khoá theo tài khoản (5 lần sai/15 phút) vẫn áp dụng riêng. */
export const RULES = {
  login: { max: 30, windowMs: 15 * MIN },
  register: { max: 10, windowMs: 60 * MIN },
  forgot: { max: 5, windowMs: 60 * MIN },
  // Theo email đích: chống dùng form quên mật khẩu để spam hộp thư người khác
  forgotEmail: { max: 3, windowMs: 60 * MIN },
  reset: { max: 10, windowMs: 15 * MIN },
  join: { max: 10, windowMs: 60 * MIN },
} satisfies Record<string, Rule>;

export type Scope = keyof typeof RULES;

/** Đếm số lần trong cửa sổ rồi ghi thêm một lần; quá ngưỡng → 429. */
export async function hit(key: string, rule: Rule, at = now()) {
  const n = await prisma.rateHit.count({ where: { key, at: { gt: new Date(at.getTime() - rule.windowMs) } } });
  if (n >= rule.max) throw new AppError(429, 'Bạn thao tác quá nhiều lần. Thử lại sau ít phút.');
  await prisma.rateHit.create({ data: { key, at } });
}

/**
 * IP người gọi. Vercel đặt x-real-ip / x-forwarded-for từ kết nối thật; tự host thì reverse proxy phải
 * ghi đè các header này. Ngoài request (test gọi thẳng service) trả về null và bỏ qua giới hạn.
 */
export async function clientIp(): Promise<string | null> {
  try {
    const h = await headers();
    return h.get('x-real-ip')?.trim() || h.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  } catch {
    return null;
  }
}

export async function limitIp(scope: Scope) {
  const ip = await clientIp();
  if (ip) await hit(`${scope}:ip:${ip}`, RULES[scope]);
}
