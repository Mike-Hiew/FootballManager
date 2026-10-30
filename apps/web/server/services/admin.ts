import { prisma } from '@san7/db';
import { addDays, todayVN } from '@san7/core';
import type { SessionUser } from '../auth/session';
import { requireAdmin } from '../authz';
import { hashPassword } from '../auth/password';
import { invalid, notFound } from '../errors';
import { newToken } from '../auth/tokens';

export async function adminOverview(user: SessionUser, now: Date) {
  requireAdmin(user);
  const today = todayVN(now);
  const [users, teams, weekMatches, pending] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        players: { where: { status: 'active' }, include: { team: { select: { name: true } } } },
        captainOf: { include: { team: { select: { name: true } } } },
        joinRequests: { where: { status: 'pending' }, include: { team: { select: { name: true } } } },
      },
    }),
    prisma.team.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        captains: { include: { user: { select: { name: true, id: true } } } },
        invites: { where: { revokedAt: null }, select: { code: true } },
        _count: { select: { players: { where: { status: 'active' } }, matches: { where: { deletedAt: null } }, joinRequests: { where: { status: 'pending' } } } },
      },
    }),
    prisma.match.count({ where: { deletedAt: null, date: { gte: addDays(today, -6), lte: today } } }),
    prisma.joinRequest.count({ where: { status: 'pending' } }),
  ]);
  return {
    stats: { users: users.length, teams: teams.length, weekMatches, pending },
    users: users.map((u) => {
      const capOf = new Set(u.captainOf.map((c) => c.team.name));
      // Vai trò theo từng đội như prototype: ĐT / thành viên / chờ duyệt
      const roles: Array<{ kind: 'admin' | 'cap' | 'member' | 'pending'; team?: string }> = [];
      if (u.role === 'admin') roles.push({ kind: 'admin' });
      for (const t of capOf) roles.push({ kind: 'cap', team: t });
      for (const p of u.players) if (!capOf.has(p.team.name)) roles.push({ kind: 'member', team: p.team.name });
      for (const j of u.joinRequests) roles.push({ kind: 'pending', team: j.team.name });
      return { id: u.id, name: u.name, phone: u.phone, email: u.email, role: u.role, createdAt: u.createdAt.toISOString(), disabled: !!u.disabledAt, roles };
    }),
    teams: teams.map((t) => ({
      id: t.id, name: t.name, captains: t.captains.map((c) => ({ id: c.user.id, name: c.user.name })), members: t._count.players,
      pending: t._count.joinRequests, matches: t._count.matches, inviteCode: t.invites[0]?.code ?? null, createdAt: t.createdAt.toISOString(), hidden: t.hidden,
    })),
  };
}

export async function setUserDisabled(user: SessionUser, userId: string, disabled: boolean, now: Date) {
  requireAdmin(user);
  if (userId === user.id) throw invalid('Không tự khoá tài khoản của mình');
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { disabledAt: disabled ? now : null, lockedUntil: null } }),
    ...(disabled ? [prisma.session.deleteMany({ where: { userId } })] : []),
  ]);
}

/** Đặt lại mật khẩu: sinh mật khẩu tạm và trả cho admin chuyển cho người dùng. */
export async function resetUserPassword(user: SessionUser, userId: string) {
  requireAdmin(user);
  const temp = newToken().slice(0, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(temp), lockedUntil: null } });
  await prisma.session.deleteMany({ where: { userId } });
  return temp;
}

export async function setTeamHidden(user: SessionUser, teamId: string, hidden: boolean) {
  requireAdmin(user);
  await prisma.team.update({ where: { id: teamId }, data: { hidden } });
}

/** Chuyển đội trưởng: thay toàn bộ ĐT hiện tại bằng user mới. */
export async function transferCaptain(user: SessionUser, teamId: string, newUserId: string) {
  requireAdmin(user);
  const p = await prisma.player.findFirst({ where: { teamId, userId: newUserId, status: 'active' } });
  if (!p) throw notFound('Người này chưa là thành viên đội');
  await prisma.$transaction([
    prisma.teamCaptain.deleteMany({ where: { teamId } }),
    prisma.teamCaptain.create({ data: { teamId, userId: newUserId } }),
    prisma.player.updateMany({ where: { teamId }, data: { isCaptain: false } }),
    prisma.player.update({ where: { id: p.id }, data: { isCaptain: true } }),
  ]);
}
