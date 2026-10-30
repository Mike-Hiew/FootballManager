import { prisma } from '@san7/db';
import { dm, resolveMvp, shortName } from '@san7/core';
import { type Ctx, requireManager } from '../authz';
import { audit } from '../audit';
import { forbidden, invalid, notFound } from '../errors';
import { captainUserIds, emit } from './notify';
import { getMatch } from './match';

const DAY_MS = 24 * 3600e3;

async function goers(matchId: string) {
  return prisma.attendance.findMany({ where: { matchId, status: 'di' }, include: { player: { select: { id: true, userId: true, nick: true, fullName: true } } } });
}

/** Mở vote MVP sau khi trận có tỉ số; hạn 24 giờ (BRD 6.6). */
export async function openMvp(ctx: Ctx, matchId: string) {
  requireManager(ctx);
  const m = await getMatch(ctx, matchId);
  if (m.scoreUs == null) throw invalid('Nhập tỉ số trước khi mở vote MVP');
  const existing = await prisma.mvpVote.findUnique({ where: { matchId } });
  if (existing && existing.status === 'open') throw invalid('Vote MVP đang mở');
  if (m.mvpPlayerId) throw invalid('Trận đã có MVP');
  const g = await goers(matchId);
  await prisma.$transaction(async (tx) => {
    await tx.mvpBallot.deleteMany({ where: { matchId } });
    await tx.mvpVote.upsert({
      where: { matchId },
      create: { matchId, status: 'open', openedAt: ctx.now, closesAt: new Date(ctx.now.getTime() + DAY_MS) },
      update: { status: 'open', openedAt: ctx.now, closesAt: new Date(ctx.now.getTime() + DAY_MS), closedAt: null, decidedBy: null },
    });
    await emit(tx, {
      kind: 'mvp', teamId: ctx.teamId, recipients: g.map((a) => a.player.userId), actorId: ctx.user.id, matchId,
      text: `Vote MVP trận vs ${m.opponent} (${dm(m.date)}) đã mở, hạn 24 giờ`,
    });
  });
}

/** Bỏ phiếu: chỉ người Đi, không tự bầu, đổi được đến khi đóng. */
export async function castBallot(ctx: Ctx, matchId: string, candidateId: string) {
  const m = await getMatch(ctx, matchId);
  if (!ctx.playerId) throw forbidden('Bạn không phải thành viên đội này');
  await closeMvpIfDue(matchId, ctx.now);
  const v = await prisma.mvpVote.findUnique({ where: { matchId } });
  if (!v || v.status !== 'open') throw forbidden('Vote MVP không mở');
  const g = await goers(m.id);
  const ids = new Set(g.map((a) => a.playerId));
  if (!ids.has(ctx.playerId)) throw forbidden('Chỉ người có đá trận này mới được bỏ phiếu');
  if (!ids.has(candidateId)) throw invalid('Chỉ bầu được người có đá trận này');
  if (candidateId === ctx.playerId) throw invalid('Không tự bầu cho mình');
  await prisma.mvpBallot.upsert({
    where: { matchId_voterId: { matchId, voterId: ctx.playerId } },
    create: { matchId, voterId: ctx.playerId, candidateId },
    update: { candidateId },
  });
}

/** ĐT chỉ định MVP bất kỳ lúc nào (kể cả không mở vote). */
export async function assignMvp(ctx: Ctx, matchId: string, playerId: string) {
  requireManager(ctx);
  const m = await getMatch(ctx, matchId);
  const g = await goers(matchId);
  const w = g.find((a) => a.playerId === playerId);
  if (!w) throw invalid('MVP phải là người có đá trận này');
  await prisma.$transaction(async (tx) => {
    await tx.match.update({ where: { id: matchId }, data: { mvpPlayerId: playerId } });
    await tx.mvpVote.upsert({
      where: { matchId },
      create: { matchId, status: 'done', openedAt: ctx.now, closesAt: ctx.now, closedAt: ctx.now, decidedBy: 'captain' },
      update: { status: 'done', closedAt: ctx.now, decidedBy: 'captain' },
    });
    await emit(tx, {
      kind: 'mvp', teamId: ctx.teamId, recipients: g.map((a) => a.player.userId), actorId: ctx.user.id, matchId,
      text: `MVP trận vs ${m.opponent}: ${shortName(w.player)} (đội trưởng chỉ định)`,
    });
    await audit(tx, ctx, 'mvp.assign', 'match', matchId, { mvp: m.mvpPlayerId }, { mvp: playerId });
  });
}

/**
 * Chốt vote MVP quá hạn — idempotent: khoá hàng mvp_votes, chỉ xử lý khi
 * status='open' AND closes_at <= now. Gọi bởi job tick và khi đọc (chốt lười).
 */
export async function closeMvpIfDue(matchId: string, now: Date): Promise<'done' | 'need' | null> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ status: string; closesAt: Date }>>`
      SELECT "status", "closesAt" FROM "mvp_votes" WHERE "matchId" = ${matchId} FOR UPDATE`;
    const v = rows[0];
    if (!v || v.status !== 'open' || v.closesAt > now) return null;
    const m = await tx.match.findUniqueOrThrow({ where: { id: matchId } });
    const g = await tx.attendance.findMany({ where: { matchId, status: 'di' }, include: { player: true } });
    const ballots = await tx.mvpBallot.findMany({ where: { matchId } });
    const r = resolveMvp(ballots.map((b) => b.candidateId), g.length);
    const caps = await captainUserIds(tx, m.teamId);
    if (r.status === 'done') {
      const w = g.find((a) => a.playerId === r.winner)?.player;
      await tx.match.update({ where: { id: matchId }, data: { mvpPlayerId: r.winner } });
      await tx.mvpVote.update({ where: { matchId }, data: { status: 'done', closedAt: now, decidedBy: 'vote' } });
      await emit(tx, {
        kind: 'mvp', teamId: m.teamId, recipients: [...g.map((a) => a.player.userId), ...caps], matchId,
        text: `MVP trận vs ${m.opponent}: ${w ? shortName(w) : '?'} với ${r.votes}/${r.total} phiếu`,
      });
    } else {
      await tx.mvpVote.update({ where: { matchId }, data: { status: 'need', closedAt: now } });
      await emit(tx, {
        kind: 'mvp', teamId: m.teamId, recipients: caps, matchId, view: 'duyet',
        text: `Vote MVP trận vs ${m.opponent} chưa đủ điều kiện (${r.total}/${g.length} phiếu, cần ${r.need}${r.tie ? ', hoặc đang hoà phiếu' : ''}). Đội trưởng cần chỉ định MVP.`,
      });
    }
    return r.status;
  });
}

/** Quét mọi vote quá hạn của một đội (gọi khi đọc dashboard / lịch). */
export async function sweepTeamMvp(teamId: string, now: Date) {
  const due = await prisma.mvpVote.findMany({ where: { status: 'open', closesAt: { lte: now }, match: { teamId } }, select: { matchId: true } });
  for (const d of due) await closeMvpIfDue(d.matchId, now);
}

export async function mvpTally(matchId: string) {
  const b = await prisma.mvpBallot.findMany({ where: { matchId } });
  if (!b) throw notFound();
  return b;
}
