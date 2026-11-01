import { z } from 'zod';
import { prisma } from '@san7/db';
import { addMonths, averageStats, currentMonth, payTypeSchema, profileSchema } from '@san7/core';
import { type Ctx, requireManager } from '../authz';
import { audit } from '../audit';
import { forbidden, invalid, notFound, zodMessage } from '../errors';
import { captainUserIds, emit } from './notify';
import { announceReview } from './statreview';
import { statsOf } from './mappers';

const captainEdit = profileSchema.extend({ payType: payTypeSchema, isCaptain: z.boolean().optional() });

async function numWarning(teamId: string, num: number | null | undefined, exceptId?: string) {
  if (num == null) return null;
  const n = await prisma.player.count({ where: { teamId, status: 'active', num, id: exceptId ? { not: exceptId } : undefined } });
  return n ? `Số áo ${num} đã có người mặc` : null;
}

/** ĐT thêm cầu thủ trực tiếp (không có tài khoản). */
export async function createPlayer(ctx: Ctx, raw: unknown) {
  requireManager(ctx);
  const p = captainEdit.safeParse(raw);
  if (!p.success) throw invalid(zodMessage(p.error));
  const d = p.data;
  const warning = await numWarning(ctx.teamId, d.num);
  const player = await prisma.player.create({
    data: {
      teamId: ctx.teamId, fullName: d.fullName, nick: d.nick || null, dob: d.dob || null, num: d.num ?? null, foot: d.foot,
      payType: d.payType, styles: d.styles, stats: d.stats, avatarUrl: d.avatarUrl || null, isCaptain: !!d.isCaptain,
    },
  });
  await audit(prisma, ctx, 'player.create', 'player', player.id, null, d);
  return { player, warning };
}

/**
 * ĐT sửa trực tiếp. Đổi quỹ ↔ đá lẻ có hiệu lực từ tháng sau (BRD 7.4):
 * lưu payType mới + payTypeFrom = tháng sau + prevPayType = loại cũ.
 */
export async function updatePlayer(ctx: Ctx, playerId: string, raw: unknown) {
  requireManager(ctx);
  const p = captainEdit.safeParse(raw);
  if (!p.success) throw invalid(zodMessage(p.error));
  const d = p.data;
  const before = await prisma.player.findFirst({ where: { id: playerId, teamId: ctx.teamId } });
  if (!before) throw notFound('Không tìm thấy cầu thủ');
  const payChange =
    d.payType !== before.payType
      ? { payType: d.payType, payTypeFrom: addMonths(currentMonth(ctx.now), 1), prevPayType: effectivePayType(before, currentMonth(ctx.now)) }
      : {};
  const warning = await numWarning(ctx.teamId, d.num, playerId);
  const player = await prisma.player.update({
    where: { id: playerId },
    data: {
      fullName: d.fullName, nick: d.nick || null, dob: d.dob || null, num: d.num ?? null, foot: d.foot, styles: d.styles,
      stats: d.stats, avatarUrl: d.avatarUrl || null, isCaptain: d.isCaptain ?? before.isCaptain, ...payChange,
    },
  });
  await audit(prisma, ctx, 'player.update', 'player', playerId, before, player);
  return { player, warning };
}

/** Loại quỹ/đá lẻ áp dụng cho một tháng. */
export function effectivePayType(p: { payType: string; payTypeFrom: string | null; prevPayType: string | null }, month: string): string {
  if (p.payTypeFrom && month < p.payTypeFrom && p.prevPayType) return p.prevPayType;
  return p.payType;
}

/** Xoá cầu thủ: đã có dữ liệu trận thì chuyển `left` để giữ thống kê cũ (BRD 4.1). */
export async function removePlayer(ctx: Ctx, playerId: string) {
  requireManager(ctx);
  const p = await prisma.player.findFirst({ where: { id: playerId, teamId: ctx.teamId }, include: { _count: { select: { attendance: true, events: true, dues: true } } } });
  if (!p) throw notFound('Không tìm thấy cầu thủ');
  const hasHistory = p._count.attendance + p._count.events + p._count.dues > 0 || !!p.userId;
  await prisma.$transaction(async (tx) => {
    if (hasHistory) await tx.player.update({ where: { id: playerId }, data: { status: 'left', isCaptain: false } });
    else await tx.player.delete({ where: { id: playerId } });
    const team = await tx.team.findUniqueOrThrow({ where: { id: ctx.teamId }, select: { lineup: true } });
    const lu = Array.isArray(team.lineup) ? (team.lineup as Array<string | null>) : [];
    if (lu.includes(playerId)) await tx.team.update({ where: { id: ctx.teamId }, data: { lineup: lu.map((x) => (x === playerId ? null : x)) } });
    await audit(tx, ctx, hasHistory ? 'player.leave' : 'player.delete', 'player', playerId, p, null);
  });
  return { soft: hasHistory };
}

/** Thành viên tự sửa hồ sơ → bản chờ duyệt, ghi đè bản chờ cũ (BRD 3.5). */
export async function submitProfileEdit(ctx: Ctx, raw: unknown) {
  if (!ctx.playerId) throw forbidden('Bạn không phải thành viên đội này');
  const p = profileSchema.safeParse(raw);
  if (!p.success) throw invalid(zodMessage(p.error));
  const me = await prisma.player.findUniqueOrThrow({ where: { id: ctx.playerId } });
  await prisma.$transaction(async (tx) => {
    const cur = await tx.profileEdit.findFirst({ where: { playerId: me.id, status: 'pending' } });
    if (cur) await tx.profileEdit.update({ where: { id: cur.id }, data: { payload: p.data } });
    else await tx.profileEdit.create({ data: { teamId: ctx.teamId, playerId: me.id, payload: p.data } });
    if (!cur) {
      await emit(tx, {
        kind: 'edit', teamId: ctx.teamId, recipients: await captainUserIds(tx, ctx.teamId), actorId: ctx.user.id, view: 'duyet',
        text: `${me.nick || me.fullName} gửi cập nhật hồ sơ, chỉ số`,
      });
      await announceReview(tx, ctx, ctx.teamId, me, 'self');
    }
  });
}

export async function approveProfileEdit(ctx: Ctx, editId: string, edited?: unknown) {
  requireManager(ctx);
  const e = await prisma.profileEdit.findFirst({ where: { id: editId, teamId: ctx.teamId, status: 'pending' }, include: { player: true, votes: true } });
  if (!e) throw notFound('Bản cập nhật không còn chờ duyệt');
  // Không sửa gì thêm → chốt theo trung bình bản khai + phiếu đồng đội (cả đội chấm, BRD 4.7)
  const payload = e.payload as Record<string, unknown>;
  const fallback = { ...payload, stats: averageStats([statsOf(payload.stats), ...e.votes.map((v) => statsOf(v.stats))]) };
  const p = profileSchema.safeParse(edited ?? fallback);
  if (!p.success) throw invalid(zodMessage(p.error));
  const d = p.data;
  await prisma.$transaction(async (tx) => {
    await tx.player.update({
      where: { id: e.playerId },
      data: { fullName: d.fullName, nick: d.nick || null, dob: d.dob || null, num: d.num ?? null, foot: d.foot, styles: d.styles, stats: d.stats, avatarUrl: d.avatarUrl || null },
    });
    await tx.profileEdit.update({ where: { id: e.id }, data: { status: 'approved', payload: d, decidedById: ctx.user.id, decidedAt: ctx.now } });
    await emit(tx, { kind: 'result', teamId: ctx.teamId, recipients: [e.player.userId], actorId: ctx.user.id, view: 'toi', text: e.votes.length ? `Đội trưởng đã chốt chỉ số của bạn (${e.votes.length} đồng đội chấm)` : 'Đội trưởng đã duyệt cập nhật hồ sơ của bạn' });
    await audit(tx, ctx, 'profile.approve', 'player', e.playerId, e.player, d);
  });
}

export async function rejectProfileEdit(ctx: Ctx, editId: string, reason?: string | null) {
  requireManager(ctx);
  const e = await prisma.profileEdit.findFirst({ where: { id: editId, teamId: ctx.teamId, status: 'pending' }, include: { player: true } });
  if (!e) throw notFound('Bản cập nhật không còn chờ duyệt');
  const why = reason?.trim().slice(0, 200) || null;
  await prisma.$transaction(async (tx) => {
    await tx.profileEdit.update({ where: { id: e.id }, data: { status: 'rejected', reason: why, decidedById: ctx.user.id, decidedAt: ctx.now } });
    await emit(tx, { kind: 'result', teamId: ctx.teamId, recipients: [e.player.userId], actorId: ctx.user.id, text: `Cập nhật hồ sơ bị từ chối${why ? ': ' + why : ''}` });
    await audit(tx, ctx, 'profile.reject', 'player', e.playerId, null, { reason: why });
  });
}
