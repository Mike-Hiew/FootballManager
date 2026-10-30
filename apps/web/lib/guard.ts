import { redirect } from 'next/navigation';
import { allowedViews } from '@/server/authz';
import { loadCtx } from '@/app/t/[teamId]/layout';

/** Route không được phép thì chuyển về tab Đội (BRD 2.2). */
export async function guardView(teamId: string, view: string) {
  const ctx = await loadCtx(teamId);
  if (!allowedViews(ctx.role, !!ctx.playerId).includes(view)) redirect(`/t/${teamId}/doi`);
  return ctx;
}
