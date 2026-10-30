import type { Db } from '@san7/db';
import type { Ctx } from './authz';

/** Nhật ký thao tác của ĐT (BRD 9.4). */
export async function audit(db: Db, ctx: Ctx, action: string, entity: string, entityId: string | null, before?: unknown, after?: unknown) {
  await db.auditLog.create({
    data: {
      teamId: ctx.teamId,
      actorId: ctx.user.id,
      action,
      entity,
      entityId,
      before: before === undefined ? undefined : (JSON.parse(JSON.stringify(before)) as object),
      after: after === undefined ? undefined : (JSON.parse(JSON.stringify(after)) as object),
    },
  });
}
