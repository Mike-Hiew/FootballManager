import { prisma } from '@san7/db';
import { AppError } from '../errors';

export const MAX_FAILS = 5;
export const WINDOW_MS = 15 * 60e3;

/** Sai 5 lần trong 15 phút → khoá 15 phút (BRD 3.4). */
export async function assertNotLocked(key: string, at: Date, lockedUntil?: Date | null) {
  if (lockedUntil && lockedUntil > at) {
    const mins = Math.ceil((lockedUntil.getTime() - at.getTime()) / 60e3);
    throw new AppError(423, `Tài khoản tạm khoá do đăng nhập sai nhiều lần. Thử lại sau ${mins} phút.`);
  }
  const fails = await prisma.loginAttempt.count({ where: { key, ok: false, at: { gt: new Date(at.getTime() - WINDOW_MS) } } });
  if (fails >= MAX_FAILS) throw new AppError(429, 'Đăng nhập sai quá nhiều lần. Thử lại sau 15 phút.');
}

/** Ghi lần thử; trả về true nếu vừa chạm ngưỡng khoá. */
export async function recordAttempt(key: string, ok: boolean, at: Date): Promise<boolean> {
  await prisma.loginAttempt.create({ data: { key, ok, at } });
  if (ok) return false;
  const fails = await prisma.loginAttempt.count({ where: { key, ok: false, at: { gt: new Date(at.getTime() - WINDOW_MS) } } });
  return fails >= MAX_FAILS;
}
