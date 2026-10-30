import { prisma } from '@san7/db';
import type { Ctx } from '../authz';
import { forbidden, notFound } from '../errors';

/** Chỉ báo/nhắc cho trận có tỉ số trong 7 ngày gần đây — người lâu không vào không bị dồn popup trận cũ. */
export const RECENT_MS = 7 * 864e5;

export interface PostMatch {
  /** Trận vừa kết thúc cần hiện popup tỉ số (mỗi người một lần), hoặc null. */
  resultMatchId: string | null;
  /** Trận mình có Đi, đã có tỉ số, chưa khai báo và chưa bấm "Không có" — nhắc trên tab Đội. */
  claimMatchIds: string[];
}

/**
 * Việc sau trận cho người đang xem (BRD 6.8). Trận "đã kết thúc" khi qua giờ đá và ĐT đã nhập tỉ số.
 * Popup chỉ cho trận mới nhất, chỉ thành viên/ĐT của đội, và không báo trận đá trước khi người đó vào đội.
 */
export async function postMatch(ctx: Ctx): Promise<PostMatch> {
  const none: PostMatch = { resultMatchId: null, claimMatchIds: [] };
  if (ctx.role !== 'member' && ctx.role !== 'captain') return none;
  const recent = await prisma.match.findMany({
    where: { teamId: ctx.teamId, deletedAt: null, scoreUs: { not: null }, kickoffAt: { lte: ctx.now }, resultAt: { gte: new Date(ctx.now.getTime() - RECENT_MS) } },
    select: {
      id: true, kickoffAt: true,
      receipts: { where: { userId: ctx.user.id } },
      attendance: ctx.playerId ? { where: { playerId: ctx.playerId } } : false,
      claims: ctx.playerId ? { where: { playerId: ctx.playerId }, select: { id: true } } : false,
    },
    orderBy: { kickoffAt: 'desc' },
  });
  if (!recent.length) return none;
  const me = ctx.playerId ? await prisma.player.findUnique({ where: { id: ctx.playerId }, select: { createdAt: true } }) : null;

  const latest = recent[0];
  const joinedBefore = !me || me.createdAt <= latest.kickoffAt;
  const resultMatchId = joinedBefore && !latest.receipts[0]?.seenAt ? latest.id : null;

  const claimMatchIds = ctx.playerId
    ? recent
        .filter((m) => m.attendance?.[0]?.status === 'di' && !m.claims?.length && !m.receipts[0]?.claimSkippedAt)
        .map((m) => m.id)
    : [];
  return { resultMatchId, claimMatchIds };
}

async function receipt(ctx: Ctx, matchId: string, data: { seenAt?: Date; claimSkippedAt?: Date }) {
  if (ctx.role !== 'member' && ctx.role !== 'captain') throw forbidden('Bạn không phải thành viên đội này');
  const m = await prisma.match.findFirst({ where: { id: matchId, teamId: ctx.teamId, deletedAt: null }, select: { id: true } });
  if (!m) throw notFound('Không tìm thấy trận');
  await prisma.matchReceipt.upsert({ where: { matchId_userId: { matchId, userId: ctx.user.id } }, create: { matchId, userId: ctx.user.id, ...data }, update: data });
}

/** Đã xem popup tỉ số — không hiện lại. */
export const markResultSeen = (ctx: Ctx, matchId: string) => receipt(ctx, matchId, { seenAt: ctx.now });

/** "Không có bàn/kiến tạo" — tắt nhắc khai báo trận này. */
export const skipClaim = (ctx: Ctx, matchId: string) => receipt(ctx, matchId, { claimSkippedAt: ctx.now });
