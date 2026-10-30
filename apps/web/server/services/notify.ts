import { prisma, type Db } from '@san7/db';

export type NotifyKind = 'vote' | 'mvp' | 'join' | 'edit' | 'claim' | 'result' | 'fund' | 'season';

export interface EmitInput {
  kind: NotifyKind;
  teamId?: string | null;
  recipients: Iterable<string | null | undefined>;
  /** người gây sự kiện — không nhận thông báo của chính mình */
  actorId?: string | null;
  matchId?: string | null;
  view?: string | null;
  text: string;
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
