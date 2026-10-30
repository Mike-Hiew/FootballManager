import { cache } from 'react';
import { prisma } from '@san7/db';
import { getSession, type SessionUser } from './auth/session';
import { forbidden, notFound, unauthorized } from './errors';
import { now } from './clock';

/** 4 vai trò, xét theo từng đội (BRD 2). Admin có mọi quyền của ĐT ở mọi đội. */
export type Role = 'admin' | 'captain' | 'member' | 'guest';

export interface Ctx {
  user: SessionUser;
  teamId: string;
  role: Role;
  /** cầu thủ active của user trong đội này (nếu có) */
  playerId: string | null;
  now: Date;
}

export const canManage = (r: Role) => r === 'admin' || r === 'captain';
export const isInsider = (r: Role) => r !== 'guest';

/** Tính vai trò của user trong một đội. */
export async function roleIn(user: SessionUser, teamId: string): Promise<{ role: Role; playerId: string | null }> {
  const [cap, player] = await Promise.all([
    prisma.teamCaptain.findUnique({ where: { teamId_userId: { teamId, userId: user.id } } }),
    prisma.player.findFirst({ where: { teamId, userId: user.id, status: 'active' }, select: { id: true } }),
  ]);
  const role: Role = user.role === 'admin' ? 'admin' : cap ? 'captain' : player ? 'member' : 'guest';
  return { role, playerId: player?.id ?? null };
}

export const requireUser = cache(async (): Promise<SessionUser> => {
  const s = await getSession();
  if (!s) throw unauthorized();
  return s.user;
});

/** Ngữ cảnh đội đã xác thực; mọi service nhận ctx này, không tự đọc cookie (ARCHITECTURE 5). */
export const teamCtx = cache(async (teamId: string): Promise<Ctx> => {
  const user = await requireUser();
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true, hidden: true } });
  if (!team) throw notFound('Không tìm thấy đội');
  const { role, playerId } = await roleIn(user, teamId);
  if (team.hidden && role === 'guest') throw notFound('Không tìm thấy đội');
  return { user, teamId, role, playerId, now: now() };
});

export function requireManager(ctx: Ctx) {
  if (!canManage(ctx.role)) throw forbidden();
}

export function requireInsider(ctx: Ctx) {
  if (!isInsider(ctx.role)) throw forbidden('Chỉ thành viên đội mới xem được mục này');
}

export function requireAdmin(user: SessionUser) {
  if (user.role !== 'admin') throw forbidden('Chỉ quản trị hệ thống mới làm được việc này');
}

/** Các tab được phép theo vai trò (BRD 2.2). */
export function allowedViews(role: Role, hasPlayer: boolean): string[] {
  if (role === 'guest') return ['doi', 'cau-thu', 'lich', 'thong-ke'];
  const v = ['doi'];
  if (hasPlayer) v.push('toi');
  v.push('chien-thuat', 'tran-toi', 'cau-thu', 'lich', 'thong-ke', 'quy');
  if (canManage(role)) v.push('duyet');
  return v;
}
