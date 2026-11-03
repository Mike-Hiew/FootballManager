import { prisma, type Db } from '@san7/db';

export type NotifyKind = 'vote' | 'mvp' | 'join' | 'edit' | 'claim' | 'result' | 'fund' | 'season' | 'transfer' | 'honor';

export interface EmitInput {
  kind: NotifyKind;
  teamId?: string | null;
  recipients: Iterable<string | null | undefined>;
  /** người gây sự kiện — không nhận thông báo của chính mình */
  actorId?: string | null;
  matchId?: string | null;
  view?: string | null;
  text: string;
  /** lời nhắc do ĐT bấm → hiện trong popup "Đội trưởng nhắc bạn" */
  remind?: boolean;
}

/**
 * Outbox: ghi notifications trong cùng transaction nghiệp vụ (ARCHITECTURE 6.3).
 * Web Push được đẩy sau commit bởi dispatchOutbox().
 */
export async function emit(db: Db, input: EmitInput): Promise<number> {
  const users = [...new Set([...input.recipients].filter((u): u is string => !!u && u !== input.actorId))];
  if (!users.length) return 0;
  await db.notification.createMany({
    data: users.map((userId) => ({
      userId,
      teamId: input.teamId ?? null,
      actorId: input.actorId ?? null,
      kind: input.kind,
      matchId: input.matchId ?? null,
      view: input.view ?? null,
      text: input.text,
      remind: !!input.remind,
    })),
  });
  return users.length;
}

export async function captainUserIds(db: Db, teamId: string): Promise<string[]> {
  return (await db.teamCaptain.findMany({ where: { teamId }, select: { userId: true } })).map((c) => c.userId);
}

export async function listNotifications(userId: string) {
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 30 }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { items, unread };
}

export async function markAllRead(userId: string, at: Date) {
  await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: at } });
}

export interface ReminderDTO {
  id: string;
  kind: string;
  text: string;
  view: string | null;
  matchId: string | null;
  createdAt: string;
  actor: string | null;
}

const REMIND_DAYS = 14;

/** Lời nhắc của ĐT chưa đọc (popup lần đầu vào app). */
export async function pendingReminders(userId: string, teamId: string, now: Date): Promise<ReminderDTO[]> {
  const rows = await prisma.notification.findMany({
    where: { userId, teamId, remind: true, readAt: null, createdAt: { gte: new Date(now.getTime() - REMIND_DAYS * 864e5) } },
    orderBy: { createdAt: 'desc' },
    take: 12,
  });
  const actorIds = [...new Set(rows.map((r) => r.actorId).filter((x): x is string => !!x))];
  const actors = actorIds.length ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } }) : [];
  // tên hiển thị trong đội (biệt danh) nếu có
  const players = actorIds.length ? await prisma.player.findMany({ where: { teamId, userId: { in: actorIds } }, select: { userId: true, nick: true, fullName: true } }) : [];
  const nameOf = (id: string | null) => {
    if (!id) return null;
    const p = players.find((x) => x.userId === id);
    return p ? p.nick || p.fullName : (actors.find((a) => a.id === id)?.name ?? null);
  };
  return rows.map((r) => ({ id: r.id, kind: r.kind, text: r.text, view: r.view, matchId: r.matchId, createdAt: r.createdAt.toISOString(), actor: nameOf(r.actorId) }));
}

/** Đánh dấu đã xem các lời nhắc (đóng popup / bấm đi tới chi tiết). */
export async function markRemindersSeen(userId: string, ids: string[], at: Date) {
  if (!ids.length) return 0;
  const r = await prisma.notification.updateMany({ where: { userId, id: { in: ids }, readAt: null }, data: { readAt: at } });
  return r.count;
}
