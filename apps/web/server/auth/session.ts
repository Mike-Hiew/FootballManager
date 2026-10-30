import { cookies } from 'next/headers';
import { cache } from 'react';
import { prisma } from '@san7/db';
import { newToken, sha256 } from './tokens';
import { now } from '../clock';

export const SESSION_COOKIE = 'san7_session';
const DAY = 864e5;
const TTL = 30 * DAY;

export interface SessionUser {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: string;
}

export async function createSession(userId: string, currentTeamId?: string | null) {
  const token = newToken();
  const expiresAt = new Date(now().getTime() + TTL);
  await prisma.session.create({ data: { id: sha256(token), userId, expiresAt, currentTeamId: currentTeamId ?? null } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
}

/** Đọc phiên từ cookie; gia hạn trượt khi còn < 15 ngày. Cache theo request. */
export const getSession = cache(async (): Promise<{ user: SessionUser; sessionId: string; currentTeamId: string | null } | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const id = sha256(token);
  const s = await prisma.session.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, phone: true, email: true, role: true, disabledAt: true } } },
  });
  const t = now();
  if (!s || s.expiresAt <= t || s.user.disabledAt) {
    if (s) await prisma.session.delete({ where: { id } }).catch(() => {});
    return null;
  }
  if (s.expiresAt.getTime() - t.getTime() < TTL / 2) {
    const expiresAt = new Date(t.getTime() + TTL);
    await prisma.session.update({ where: { id }, data: { expiresAt } });
    try {
      jar.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', expires: expiresAt });
    } catch {
      // Server Component không ghi cookie được — lần gọi Action/Route sau sẽ ghi.
    }
  }
  const { disabledAt: _d, ...user } = s.user;
  return { user, sessionId: id, currentTeamId: s.currentTeamId };
});

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { id: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

/** Nhớ đội đang chọn (BRD 3.4). */
export async function rememberTeam(teamId: string) {
  const s = await getSession();
  if (!s || s.currentTeamId === teamId) return;
  await prisma.session.update({ where: { id: s.sessionId }, data: { currentTeamId: teamId } });
  await prisma.user.update({ where: { id: s.user.id }, data: { lastTeamId: teamId } });
}
