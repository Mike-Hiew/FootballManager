import { z } from 'zod';
import { prisma } from '@san7/db';
import { dateSchema, dm, DAY_SHORT, dayOfWeek, moneySchema, timeSchema, todayVN, vnDateTime } from '@san7/core';
import { type Ctx, requireManager } from '../authz';
import { audit } from '../audit';
import { forbidden, invalid, notFound, zodMessage } from '../errors';
import { emit } from './notify';
import { syncLe, syncPitch } from './fund';

export const matchSchema = z.object({
  date: dateSchema,
  time: timeSchema.optional().nullable().or(z.literal('')),
  opponent: z.string().trim().min(1, 'Nhập tên đối thủ').max(60),
  venue: z.string().trim().max(60).optional().nullable(),
  type: z.enum(['Giao hữu', 'Giải đấu', 'Nội bộ']).default('Giao hữu'),
  cost: moneySchema.default(0),
  fee: moneySchema.optional(),
  note: z.string().trim().max(200).optional().nullable(),
  openVote: z.boolean().optional(),
});

export const matchLabel = (m: { date: string; time: string | null; opponent: string }) =>
  `Trận ${DAY_SHORT[dayOfWeek(m.date)]} ${dm(m.date)}${m.time ? ' ' + m.time : ''} vs ${m.opponent}`;

export async function getMatch(ctx: Ctx, matchId: string) {
  const m = await prisma.match.findFirst({ where: { id: matchId, teamId: ctx.teamId, deletedAt: null } });
  if (!m) throw notFound('Không tìm thấy trận');
  return m;
}

export const isPlayedRow = (m: { scoreUs: number | null }) => m.scoreUs != null;
export const isPastRow = (m: { date: string }, now: Date) => m.date < todayVN(now);

async function activeMemberUserIds(teamId: string) {
  return (await prisma.player.findMany({ where: { teamId, status: 'active', userId: { not: null } }, select: { userId: true } })).map((p) => p.userId);
}

/** Tạo trận (BRD 6.1). fee chép từ perMatchFee lúc tạo. */
export async function createMatch(ctx: Ctx, raw: unknown) {
  requireManager(ctx);
  const p = matchSchema.safeParse(raw);
  if (!p.success) throw invalid(zodMessage(p.error));
  const d = p.data;
  const team = await prisma.team.findUniqueOrThrow({ where: { id: ctx.teamId } });
  const time = d.time || team.homeFrom || null;
  const recipients = d.openVote ? await activeMemberUserIds(ctx.teamId) : [];
  return prisma.$transaction(async (tx) => {
    const m = await tx.match.create({
      data: {
        teamId: ctx.teamId, date: d.date, time, kickoffAt: vnDateTime(d.date, time), opponent: d.opponent,
        venue: d.venue || team.homeName || null, type: d.type, cost: d.cost, fee: d.fee ?? team.perMatchFee, note: d.note || null,
        voteState: d.openVote ? 'open' : null, voteOpenedAt: d.openVote ? ctx.now : null,
      },
    });
    if (d.openVote) {
      await emit(tx, { kind: 'vote', teamId: ctx.teamId, recipients, actorId: ctx.user.id, matchId: m.id, text: `${matchLabel(m)}: bạn đi được không?` });
    }
    await syncPitch(tx, m.id, ctx.now);
    await audit(tx, ctx, 'match.create', 'match', m.id, null, m);
    return m;
  });
}

export async function updateMatch(ctx: Ctx, matchId: string, raw: unknown) {
  requireManager(ctx);
  const p = matchSchema.safeParse(raw);
  if (!p.success) throw invalid(zodMessage(p.error));
  const d = p.data;
  const before = await getMatch(ctx, matchId);
  return prisma.$transaction(async (tx) => {
    const time = d.time || null;
    const m = await tx.match.update({
      where: { id: matchId },
      data: {
        date: d.date, time, kickoffAt: vnDateTime(d.date, time), opponent: d.opponent, venue: d.venue || null, type: d.type,
        cost: d.cost, fee: d.fee ?? before.fee, note: d.note || null,
      },
    });
    await syncPitch(tx, m.id, ctx.now);
    await syncLe(tx, m.id);
    await audit(tx, ctx, 'match.update', 'match', m.id, before, m);
    return m;
  });
}

/** Xoá trận: đã có tỉ số thì xoá mềm (BRD 6.1). */
export async function deleteMatch(ctx: Ctx, matchId: string) {
  requireManager(ctx);
  const m = await getMatch(ctx, matchId);
  await prisma.$transaction(async (tx) => {
    if (m.scoreUs != null) {
      await tx.match.update({ where: { id: matchId }, data: { deletedAt: ctx.now } });
      await syncPitch(tx, matchId, ctx.now);
      await syncLe(tx, matchId);
    } else {
      await tx.fundEntry.deleteMany({ where: { teamId: ctx.teamId, source: { in: ['pitch', 'le'] }, sourceKey: matchId } });
      await tx.match.delete({ where: { id: matchId } });
    }
    await audit(tx, ctx, 'match.delete', 'match', matchId, m, null);
  });
}

const resultSchema = z.object({
  scoreUs: z.number().int().min(0).max(99).nullable(),
  scoreThem: z.number().int().min(0).max(99).nullable(),
  events: z.array(z.object({ playerId: z.string(), goals: z.number().int().min(0).max(30), assists: z.number().int().min(0).max(30) })).default([]),
});

/** Nhập tỉ số + bàn/kiến tạo (ĐT). Cảnh báo mềm, không chặn (BRD 6.4). */
export async function saveResult(ctx: Ctx, matchId: string, raw: unknown) {
  requireManager(ctx);
  const p = resultSchema.safeParse(raw);
  if (!p.success) throw invalid(zodMessage(p.error));
  const d = p.data;
  if ((d.scoreUs == null) !== (d.scoreThem == null)) throw invalid('Nhập đủ tỉ số hai đội');
  const before = await prisma.match.findFirst({ where: { id: matchId, teamId: ctx.teamId, deletedAt: null }, include: { events: true } });
  if (!before) throw notFound('Không tìm thấy trận');
  const ids = new Set((await prisma.player.findMany({ where: { teamId: ctx.teamId }, select: { id: true } })).map((x) => x.id));
  const events = d.events.filter((e) => ids.has(e.playerId) && (e.goals || e.assists));
  await prisma.$transaction(async (tx) => {
    // resultAt: lần đầu có tỉ số (sửa tỉ số sau đó không bật lại popup); xoá tỉ số thì xoá mốc
    const resultAt = d.scoreUs == null ? null : (before.resultAt ?? ctx.now);
    await tx.match.update({ where: { id: matchId }, data: { scoreUs: d.scoreUs, scoreThem: d.scoreThem, resultAt, voteState: d.scoreUs != null && before.voteState === 'open' ? 'closed' : before.voteState } });
    // Người nhập tỉ số không cần popup báo tỉ số
    if (d.scoreUs != null) {
      await tx.matchReceipt.upsert({ where: { matchId_userId: { matchId, userId: ctx.user.id } }, create: { matchId, userId: ctx.user.id, seenAt: ctx.now }, update: { seenAt: ctx.now } });
    }
    await tx.matchEvent.deleteMany({ where: { matchId } });
    if (d.scoreUs != null && events.length) await tx.matchEvent.createMany({ data: events.map((e) => ({ matchId, ...e })) });
    if (d.scoreUs == null) {
      await tx.mvpBallot.deleteMany({ where: { matchId } });
      await tx.mvpVote.deleteMany({ where: { matchId } });
      await tx.match.update({ where: { id: matchId }, data: { mvpPlayerId: null } });
    }
    await syncPitch(tx, matchId, ctx.now);
    await audit(tx, ctx, 'match.result', 'match', matchId, { scoreUs: before.scoreUs, scoreThem: before.scoreThem, events: before.events }, d);
  });
  const goals = events.reduce((a, e) => a + e.goals, 0);
  const assists = events.reduce((a, e) => a + e.assists, 0);
  const warnings: string[] = [];
  if (d.scoreUs != null && goals !== d.scoreUs) warnings.push(`Tổng bàn của cầu thủ (${goals}) khác tỉ số đội (${d.scoreUs})`);
  if (assists > goals) warnings.push('Tổng kiến tạo nhiều hơn tổng bàn');
  return { warnings };
}

/** Mở / đóng điểm danh. Lần mở đầu tiên gửi thông báo cho mọi thành viên (BRD 6.3). */
export async function setVoteState(ctx: Ctx, matchId: string, state: 'open' | 'closed') {
  requireManager(ctx);
  const m = await getMatch(ctx, matchId);
  const first = state === 'open' && !m.voteOpenedAt;
  const recipients = first ? await activeMemberUserIds(ctx.teamId) : [];
  await prisma.$transaction(async (tx) => {
    await tx.match.update({ where: { id: matchId }, data: { voteState: state, voteOpenedAt: m.voteOpenedAt ?? (state === 'open' ? ctx.now : null) } });
    if (first) await emit(tx, { kind: 'vote', teamId: ctx.teamId, recipients, actorId: ctx.user.id, matchId, text: `${matchLabel(m)}: bạn đi được không?` });
  });
}

/** Nhắc người chưa trả lời. */
export async function remindVote(ctx: Ctx, matchId: string, auto = false): Promise<number> {
  if (!auto) requireManager(ctx);
  const m = await getMatch(ctx, matchId);
  const [players, att] = await Promise.all([
    prisma.player.findMany({ where: { teamId: ctx.teamId, status: 'active', userId: { not: null } } }),
    prisma.attendance.findMany({ where: { matchId } }),
  ]);
  const answered = new Set(att.map((a) => a.playerId));
  const targets = players.filter((p) => !answered.has(p.id)).map((p) => p.userId);
  const n = await prisma.$transaction(async (tx) => {
    await tx.match.update({ where: { id: matchId }, data: { voteRemindedAt: ctx.now } });
    return emit(tx, { kind: 'vote', teamId: ctx.teamId, recipients: targets, actorId: auto ? null : ctx.user.id, matchId, text: `Nhắc: bạn chưa vote trận vs ${m.opponent} ngày ${dm(m.date)}` });
  });
  return n;
}

const attSchema = z.object({ status: z.enum(['di', 'nghi']).nullable() });

/**
 * Điểm danh (BRD 6.3): thành viên chỉ đổi vote của mình khi vote mở và trận chưa qua;
 * ĐT sửa hộ bất kỳ lúc nào (đánh dấu setByCaptain). status=null = bỏ chọn.
 */
export async function setAttendance(ctx: Ctx, matchId: string, playerId: string, raw: unknown) {
  const p = attSchema.safeParse(raw);
  if (!p.success) throw invalid('Trạng thái không hợp lệ');
  const status = p.data.status;
  const m = await getMatch(ctx, matchId);
  const player = await prisma.player.findFirst({ where: { id: playerId, teamId: ctx.teamId, status: 'active' } });
  if (!player) throw notFound('Không tìm thấy cầu thủ');
  const self = ctx.playerId === playerId;
  const manager = ctx.role === 'admin' || ctx.role === 'captain';
  const byCaptain = manager && !self;
  if (!manager) {
    if (!self) throw forbidden('Bạn chỉ điểm danh được cho chính mình');
    if (m.voteState !== 'open') throw forbidden('Điểm danh đã đóng hoặc chưa mở');
    if (m.scoreUs != null || isPastRow(m, ctx.now)) throw forbidden('Trận đã qua, không đổi điểm danh được');
  }
  const before = await prisma.attendance.findUnique({ where: { matchId_playerId: { matchId, playerId } } });
  await prisma.$transaction(async (tx) => {
    if (status === null) await tx.attendance.deleteMany({ where: { matchId, playerId } });
    else {
      await tx.attendance.upsert({
        where: { matchId_playerId: { matchId, playerId } },
        create: { matchId, playerId, status, setByCaptain: byCaptain },
        update: { status, setByCaptain: byCaptain, ...(status === 'nghi' ? { lePaid: false } : {}) },
      });
    }
    if (before?.lePaid && status !== 'di') await syncLe(tx, matchId);
    if (byCaptain) await audit(tx, ctx, 'attendance.set', 'attendance', `${matchId}:${playerId}`, before, { status });
  });
}

/** Lưu đội hình trận tới (ĐT). */
export async function saveMatchLineup(ctx: Ctx, matchId: string, formation: string, lineup: Array<string | null>) {
  requireManager(ctx);
  await getMatch(ctx, matchId);
  await prisma.match.update({ where: { id: matchId }, data: { formation, lineup } });
}
