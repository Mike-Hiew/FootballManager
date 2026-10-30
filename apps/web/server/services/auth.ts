import { z } from 'zod';
import { prisma } from '@san7/db';
import { emailSchema, normLogin, passwordSchema, phoneSchema } from '@san7/core';
import { hashPassword, verifyPassword } from '../auth/password';
import { createSession } from '../auth/session';
import { assertNotLocked, recordAttempt } from '../auth/lockout';
import { newToken, sha256 } from '../auth/tokens';
import { AppError, conflict, invalid, isUniqueViolation, zodMessage } from '../errors';
import { now } from '../clock';

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Nhập họ tên').max(60),
    phone: phoneSchema,
    email: emailSchema,
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: 'Mật khẩu nhập lại không khớp', path: ['confirm'] });

/** Bước 1/2 đăng ký đội trưởng (BRD 3.2): tạo tài khoản + đăng nhập. Email bắt buộc với ĐT. */
export async function register(raw: unknown) {
  const p = registerSchema.safeParse(raw);
  if (!p.success) throw invalid(zodMessage(p.error));
  const { name, phone, email, password } = p.data;
  const dup = await prisma.user.findFirst({ where: { OR: [{ phone }, { email }] }, select: { phone: true } });
  if (dup) throw conflict(dup.phone === phone ? 'Số điện thoại đã có tài khoản, hãy đăng nhập' : 'Email đã có tài khoản, hãy đăng nhập');
  try {
    const user = await prisma.user.create({ data: { name, phone, email, passwordHash: await hashPassword(password) } });
    await createSession(user.id);
    return user;
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict('Số điện thoại đã có tài khoản, hãy đăng nhập');
    throw e;
  }
}

/** Đăng nhập bằng SĐT hoặc email; khoá 15 phút khi sai 5 lần (BRD 3.4). */
export async function login(identifier: string, password: string) {
  const at = now();
  const id = normLogin(identifier.trim());
  if (!id.value || !password) throw invalid('Nhập số điện thoại/email và mật khẩu');
  const key = `${id.kind}:${id.value}`;
  const user = await prisma.user.findFirst({ where: id.kind === 'email' ? { email: id.value } : { phone: id.value } });
  await assertNotLocked(key, at, user?.lockedUntil);
  const ok = !!user && !user.disabledAt && (await verifyPassword(user.passwordHash, password));
  const lockNow = await recordAttempt(key, ok, at);
  if (!ok || !user) {
    if (lockNow && user) await prisma.user.update({ where: { id: user.id }, data: { lockedUntil: new Date(at.getTime() + 15 * 60e3) } });
    if (user?.disabledAt) throw new AppError(403, 'Tài khoản đã bị khoá. Liên hệ quản trị hệ thống.');
    throw new AppError(401, lockNow ? 'Sai quá 5 lần. Tài khoản tạm khoá 15 phút.' : 'Sai số điện thoại/email hoặc mật khẩu');
  }
  if (user.lockedUntil) await prisma.user.update({ where: { id: user.id }, data: { lockedUntil: null } });
  await createSession(user.id, user.lastTeamId);
  return user;
}

/** Quên mật khẩu (phase 1 qua email). Luôn trả về như nhau để không lộ email có tồn tại. */
export async function forgotPassword(email: string): Promise<{ link: string | null }> {
  const e = emailSchema.safeParse(email);
  if (!e.success) throw invalid('Email không hợp lệ');
  const user = await prisma.user.findUnique({ where: { email: e.data } });
  if (!user) return { link: null };
  const token = newToken();
  await prisma.passwordReset.create({ data: { id: sha256(token), userId: user.id, expiresAt: new Date(now().getTime() + 3600e3) } });
  const link = `${process.env.APP_URL ?? 'http://localhost:3000'}/dat-lai-mat-khau/${token}`;
  await sendResetMail(user.email!, link);
  return { link: process.env.NODE_ENV === 'production' ? null : link };
}

async function sendResetMail(to: string, link: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info(`[mail] Đặt lại mật khẩu cho ${to}: ${link}`);
    return;
  }
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.MAIL_FROM ?? 'no-reply@example.com',
      to,
      subject: 'Đặt lại mật khẩu',
      text: `Bấm vào link sau trong 1 giờ để đặt lại mật khẩu: ${link}`,
    }),
  });
}

export async function resetPassword(token: string, password: string) {
  const p = passwordSchema.safeParse(password);
  if (!p.success) throw invalid(zodMessage(p.error));
  const r = await prisma.passwordReset.findUnique({ where: { id: sha256(token) } });
  if (!r || r.usedAt || r.expiresAt < now()) throw invalid('Link đặt lại mật khẩu không còn hiệu lực');
  await prisma.$transaction([
    prisma.user.update({ where: { id: r.userId }, data: { passwordHash: await hashPassword(p.data), lockedUntil: null } }),
    prisma.passwordReset.update({ where: { id: r.id }, data: { usedAt: now() } }),
    prisma.session.deleteMany({ where: { userId: r.userId } }),
  ]);
}

/** Danh sách đội của user để điều hướng sau đăng nhập (BRD 3.4). */
export async function userHome(userId: string, role: string) {
  const [captain, players, pending] = await Promise.all([
    prisma.teamCaptain.findMany({ where: { userId }, select: { teamId: true } }),
    prisma.player.findMany({ where: { userId, status: 'active' }, select: { teamId: true } }),
    prisma.joinRequest.findMany({ where: { userId, status: 'pending' }, include: { team: { select: { name: true } } } }),
  ]);
  let teamIds = [...new Set([...captain.map((c) => c.teamId), ...players.map((p) => p.teamId)])];
  if (role === 'admin') teamIds = (await prisma.team.findMany({ select: { id: true }, orderBy: { createdAt: 'asc' } })).map((t) => t.id);
  return { teamIds, pending };
}
