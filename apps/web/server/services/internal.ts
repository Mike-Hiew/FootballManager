import { z } from 'zod';
import { prisma, type Db } from '@san7/db';
import { balanceTeams, isInternal, moneySchema, sharesOf, splitItemsOf, splitTotal, type Sides } from '@san7/core';
import { type Ctx, requireManager } from '../authz';
import { audit } from '../audit';
import { invalid, notFound, zodMessage } from '../errors';
import { statsOf } from './mappers';
import { syncLe } from './fund';

/**
 * Đá nội bộ (BRD 15): chia người Đi thành Đội A / Đội B cân bằng, ĐT chia tiền (tiền sân + khoản thêm).
 */

async function internalMatch(ctx: Ctx, matchId: string) {
  const m = await prisma.match.findFirst({ where: { id: matchId, teamId: ctx.teamId, deletedAt: null }, include: { attendance: true } });
  if (!m) throw notFound('Không tìm thấy trận');
  if (!isInternal(m)) throw invalid('Chỉ trận đá nội bộ mới chia đội / chia tiền kiểu này');
  return m;
}

export const sidesOf = (raw: unknown): Sides => {
  const s = (raw ?? {}) as Partial<Sides>;
  return { a: Array.isArray(s.a) ? s.a.filter((x): x is string => typeof x === 'string') : [], b: Array.isArray(s.b) ? s.b.filter((x): x is string => typeof x === 'string') : [] };
};


/**
 * ĐT bấm "Chia ngẫu nhiên cân bằng": chia lại toàn bộ người Đi.
 * `keep`: giữ người ĐT đã tự xếp, chỉ chia nốt người chưa có đội.
 */
export async function shuffleSides(ctx: Ctx, matchId: string, opts: { keep?: boolean } = {}) {
  requireManager(ctx);
  const m = await internalMatch(ctx, matchId);
  const goers = m.attendance.filter((a) => a.status === 'di').map((a) => a.playerId);
  if (goers.length < 2) throw invalid('Cần ít nhất 2 người điểm danh Đi để chia đội');
  const players = await prisma.player.findMany({ where: { id: { in: goers }, teamId: ctx.teamId } });
  const fixed = opts.keep && m.sides ? sidesOf(m.sides) : undefined;
  const sides = balanceTeams(players.map((p) => ({ id: p.id, stats: statsOf(p.stats), foot: p.foot })), Math.random, fixed);
  await prisma.match.update({ where: { id: m.id }, data: { sides: sides as object } });
  await audit(prisma, ctx, opts.keep ? 'internal.fill' : 'internal.shuffle', 'match', m.id, m.sides, sides);
  return sides;
}

const sidesSchema = z.object({ a: z.array(z.string()).max(40), b: z.array(z.string()).max(40) });

/** ĐT sửa tay (chuyển người sang đội kia). Chỉ người Đi, không trùng. */
export async function setSides(ctx: Ctx, matchId: string, raw: unknown) {
  requireManager(ctx);
  const p = sidesSchema.safeParse(raw);
  if (!p.success) throw invalid('Chia đội không hợp lệ');
  const m = await internalMatch(ctx, matchId);
  const goers = new Set(m.attendance.filter((a) => a.status === 'di').map((a) => a.playerId));
  const all = [...p.data.a, ...p.data.b];
  if (new Set(all).size !== all.length) throw invalid('Một người không thể ở cả hai đội');
  if (all.some((id) => !goers.has(id))) throw invalid('Chỉ chia những người đã điểm danh Đi');
  await prisma.match.update({ where: { id: m.id }, data: { sides: p.data } });
  await audit(prisma, ctx, 'internal.sides', 'match', m.id, m.sides, p.data);
}

/** Người không còn Đi thì gỡ khỏi đội (gọi khi điểm danh đổi). */
export async function dropFromSides(db: Db, matchId: string, playerId: string) {
  const m = await db.match.findUnique({ where: { id: matchId }, select: { sides: true } });
  if (!m?.sides) return;
  const s = sidesOf(m.sides);
  if (!s.a.includes(playerId) && !s.b.includes(playerId)) return;
  await db.match.update({ where: { id: matchId }, data: { sides: { a: s.a.filter((x) => x !== playerId), b: s.b.filter((x) => x !== playerId) } } });
}

const splitSchema = z.object({
  items: z.array(z.object({ label: z.string().trim().min(1, 'Nhập tên khoản').max(40), amount: moneySchema })).max(12),
  /** phần riêng từng người (đ); null = chia đều */
  shares: z.record(z.string(), moneySchema.nullable()).optional(),
});

/** ĐT chia tiền: khoản thêm (nước, lôi, …) + sửa phần từng người. Ghi lại sổ quỹ. */
export async function setSplit(ctx: Ctx, matchId: string, raw: unknown) {
  requireManager(ctx);
  const p = splitSchema.safeParse(raw);
  if (!p.success) throw invalid(zodMessage(p.error));
  const m = await internalMatch(ctx, matchId);
  const goers = new Set(m.attendance.filter((a) => a.status === 'di').map((a) => a.playerId));
  const shares = p.data.shares ?? {};
  if (Object.keys(shares).some((id) => !goers.has(id))) throw invalid('Chỉ chia tiền cho người đã điểm danh Đi');
  await prisma.$transaction(async (tx) => {
    await tx.match.update({ where: { id: m.id }, data: { splitItems: p.data.items } });
    for (const [playerId, share] of Object.entries(shares)) {
      await tx.attendance.update({ where: { matchId_playerId: { matchId: m.id, playerId } }, data: { share } });
    }
    await syncLe(tx, m.id);
    await audit(tx, ctx, 'internal.split', 'match', m.id, { items: m.splitItems }, p.data);
  });
}

/** Phần tiền từng người Đi của trận nội bộ (đã tính khoản thêm, phần sửa riêng). */
export function internalShares(m: { cost: number; splitItems: unknown; attendance: Array<{ playerId: string; status: string; share: number | null }> }) {
  const goers = m.attendance.filter((a) => a.status === 'di');
  const total = splitTotal(m.cost, splitItemsOf(m.splitItems));
  return sharesOf(goers.map((a) => a.playerId), total, Object.fromEntries(goers.map((a) => [a.playerId, a.share])));
}
