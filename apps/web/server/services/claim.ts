import { z } from 'zod';
import { prisma } from '@san7/db';
import { type Ctx, requireManager } from '../authz';
import { audit } from '../audit';
import { forbidden, invalid, notFound } from '../errors';
import { captainUserIds, emit } from './notify';
import { getMatch, isPastRow } from './match';

const claimSchema = z.object({ goals: z.number().int().min(0).max(30), assists: z.number().int().min(0).max(30) });

/** Thành viên tự khai bàn/kiến tạo: trận đã qua + có Đi; gửi lại khi chờ thì ghi đè (BRD 6.5). */
export async function submitClaim(ctx: Ctx, matchId: string, raw: unknown) {
  if (!ctx.playerId) throw forbidden('Bạn không phải thành viên đội này');
  const p = claimSchema.safeParse(raw);
  if (!p.success) throw invalid('Số bàn/kiến tạo không hợp lệ');
  const m = await getMatch(ctx, matchId);
  if (m.scoreUs == null && !isPastRow(m, ctx.now)) throw forbidden('Chỉ khai báo được sau ngày đá');
  const att = await prisma.attendance.findUnique({ where: { matchId_playerId: { matchId, playerId: ctx.playerId } } });
  if (att?.status !== 'di') throw forbidden('Chỉ người có đi đá mới khai báo được');
  const me = await prisma.player.findUniqueOrThrow({ where: { id: ctx.playerId } });
  await prisma.$transaction(async (tx) => {
    await tx.claim.upsert({
      where: { matchId_playerId: { matchId, playerId: me.id } },
      create: { matchId, playerId: me.id, ...p.data },
      update: { ...p.data, status: 'pending', decidedAt: null, decidedById: null },
    });
    await emit(tx, {
      kind: 'claim', teamId: ctx.teamId, recipients: await captainUserIds(tx, ctx.teamId), actorId: ctx.user.id, matchId, view: 'duyet',
      text: `${me.nick || me.fullName} khai ${p.data.goals} bàn, ${p.data.assists} kiến tạo trận vs ${m.opponent}`,
    });
  });
}

export async function decideClaim(ctx: Ctx, claimId: string, approve: boolean) {
  requireManager(ctx);
  const c = await prisma.claim.findFirst({ where: { id: claimId, status: 'pending', match: { teamId: ctx.teamId } }, include: { match: true, player: true } });
  if (!c) throw notFound('Khai báo không còn chờ duyệt');
  await prisma.$transaction(async (tx) => {
    if (approve) {
      await tx.matchEvent.upsert({
        where: { matchId_playerId: { matchId: c.matchId, playerId: c.playerId } },
        create: { matchId: c.matchId, playerId: c.playerId, goals: c.goals, assists: c.assists },
        update: { goals: c.goals, assists: c.assists },
      });
    }
    await tx.claim.update({ where: { id: c.id }, data: { status: approve ? 'approved' : 'rejected', decidedById: ctx.user.id, decidedAt: ctx.now } });
    await emit(tx, {
      kind: 'result', teamId: ctx.teamId, recipients: [c.player.userId], actorId: ctx.user.id, matchId: c.matchId,
      text: `Khai báo trận vs ${c.match.opponent} ${approve ? 'đã được duyệt' : 'bị từ chối'}`,
    });
    await audit(tx, ctx, approve ? 'claim.approve' : 'claim.reject', 'claim', c.id, null, { goals: c.goals, assists: c.assists });
  });
}
