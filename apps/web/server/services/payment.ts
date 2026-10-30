import { z } from 'zod';
import { prisma, type Db } from '@san7/db';
import { currentMonth, dm, money, moneySchema, monthLabel } from '@san7/core';
import { type Ctx, requireManager } from '../authz';
import { audit } from '../audit';
import { forbidden, invalid, notFound, zodMessage } from '../errors';
import { captainUserIds, emit } from './notify';
import { effectivePayType } from './player';
import { syncDues, syncLe } from './fund';

/**
 * Yêu cầu đóng tiền: ĐT gửi yêu cầu đóng quỹ tháng (người Quỹ) hoặc trả tiền một trận (người Đá lẻ có Đi).
 * Ai còn nợ luôn tính từ dữ liệu gốc (dues_payments / attendance.lePaid) nên ✓ tay ở tab Quỹ vẫn đúng.
 * Thành viên bấm "Tôi đã đóng" → chờ ĐT xác nhận ở tab Duyệt → ghi sổ.
 */

/** Nhắc tự động cho người chưa đóng (và chưa báo đã đóng) sau mỗi khoảng này. */
export const AUTO_REMIND_MS = 3 * 864e5;
/** Yêu cầu cũ hơn thế thì job thôi nhắc tự động (ĐT vẫn nhắc tay được). */
export const AUTO_REMIND_MAX_AGE_MS = 30 * 864e5;

type Req = { id: string; teamId: string; kind: string; key: string; amount: number; note: string | null };
interface Owed {
  label: string;
  /** người chưa đóng — kể cả người đã báo đóng nhưng ĐT chưa xác nhận */
  players: Array<{ id: string; userId: string | null; name: string }>;
}

async function owedOf(db: Db, r: Req): Promise<Owed | null> {
  if (r.kind === 'dues') {
    const [players, paid] = await Promise.all([
      db.player.findMany({ where: { teamId: r.teamId, status: 'active' } }),
      db.duesPayment.findMany({ where: { teamId: r.teamId, month: r.key }, select: { playerId: true } }),
    ]);
    const ok = new Set(paid.map((p) => p.playerId));
    return {
      label: `quỹ ${monthLabel(r.key)}`,
      players: players.filter((p) => effectivePayType(p, r.key) === 'quy' && !ok.has(p.id)).map((p) => ({ id: p.id, userId: p.userId, name: p.nick || p.fullName })),
    };
  }
  const m = await db.match.findFirst({
    where: { id: r.key, teamId: r.teamId, deletedAt: null },
    include: { attendance: { where: { status: 'di', lePaid: false }, include: { player: true } } },
  });
  if (!m) return null;
  return {
    label: `đá lẻ trận vs ${m.opponent} ${dm(m.date)}`,
    players: m.attendance.filter((a) => effectivePayType(a.player, m.date.slice(0, 7)) === 'le').map((a) => ({ id: a.player.id, userId: a.player.userId, name: a.player.nick || a.player.fullName })),
  };
}

const withNote = (r: { note: string | null }) => (r.note ? ` · ${r.note}` : '');

async function pendingIds(db: Db, requestId: string) {
  return new Set((await db.paymentNotice.findMany({ where: { requestId, status: 'pending' }, select: { playerId: true } })).map((n) => n.playerId));
}

/** Gửi thông báo cho người còn nợ chưa báo đóng; trả về số người được báo. */
async function notifyOwed(db: Db, ctx: Ctx | null, r: Req, prefix: string): Promise<number> {
  const owed = await owedOf(db, r);
  if (!owed) return 0;
  const pend = await pendingIds(db, r.id);
  return emit(db, {
    // không gắn matchId: bấm thông báo mở Của tôi, nơi có nút "Tôi đã đóng"
    kind: 'fund', teamId: r.teamId, view: 'toi', actorId: ctx?.user.id ?? null,
    recipients: owed.players.filter((p) => !pend.has(p.id)).map((p) => p.userId),
    text: `${prefix} ${owed.label}: ${money(r.amount)}${withNote(r)}`,
  });
}

const duesSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Tháng không hợp lệ'),
  note: z.string().trim().max(80).optional().nullable(),
});

/** ĐT yêu cầu đóng quỹ một tháng (số tiền = mức quỹ tháng hiện tại). Gửi lại cho tháng đã có thì cập nhật và báo lại. */
export async function requestDues(ctx: Ctx, raw: unknown) {
  requireManager(ctx);
  const p = duesSchema.safeParse(raw);
  if (!p.success) throw invalid(zodMessage(p.error));
  const { month } = p.data;
  const note = p.data.note || null;
  const team = await prisma.team.findUniqueOrThrow({ where: { id: ctx.teamId }, select: { monthlyFee: true } });
  if (!team.monthlyFee) throw invalid('Chưa đặt mức quỹ tháng');
  return prisma.$transaction(async (tx) => {
    const r = await tx.paymentRequest.upsert({
      where: { teamId_kind_key: { teamId: ctx.teamId, kind: 'dues', key: month } },
      create: { teamId: ctx.teamId, kind: 'dues', key: month, amount: team.monthlyFee, note, createdById: ctx.user.id, remindedAt: ctx.now },
      update: { amount: team.monthlyFee, note, remindedAt: ctx.now },
    });
    const sent = await notifyOwed(tx, ctx, r, 'Đội trưởng yêu cầu đóng');
    await audit(tx, ctx, 'pay.request', 'payment_request', r.id, null, { kind: 'dues', month, amount: r.amount, sent });
    return { id: r.id, sent };
  });
}

/** Sau khi nhập tỉ số, ĐT chốt tiền đá lẻ trận đó (ghi vào match.fee) và báo người đá lẻ có Đi. */
export async function requestLe(ctx: Ctx, matchId: string, raw: unknown) {
  requireManager(ctx);
  const p = z.object({ amount: moneySchema.refine((n) => n > 0, 'Nhập số tiền') }).safeParse(raw);
  if (!p.success) throw invalid(zodMessage(p.error));
  const { amount } = p.data;
  const m = await prisma.match.findFirst({ where: { id: matchId, teamId: ctx.teamId, deletedAt: null } });
  if (!m) throw notFound('Không tìm thấy trận');
  if (m.scoreUs == null) throw invalid('Nhập tỉ số trước rồi mới yêu cầu trả tiền trận');
  return prisma.$transaction(async (tx) => {
    if (m.fee !== amount) {
      await tx.match.update({ where: { id: matchId }, data: { fee: amount } });
      await syncLe(tx, matchId);
    }
    const r = await tx.paymentRequest.upsert({
      where: { teamId_kind_key: { teamId: ctx.teamId, kind: 'le', key: matchId } },
      create: { teamId: ctx.teamId, kind: 'le', key: matchId, amount, createdById: ctx.user.id, remindedAt: ctx.now },
      update: { amount, remindedAt: ctx.now },
    });
    const sent = await notifyOwed(tx, ctx, r, 'Đội trưởng yêu cầu trả tiền');
    await audit(tx, ctx, 'pay.request', 'payment_request', r.id, { fee: m.fee }, { kind: 'le', matchId, amount, sent });
    return { id: r.id, sent };
  });
}

/** ĐT nhắc lại người chưa đóng (bỏ qua người đã báo đóng, đang chờ xác nhận). */
export async function remindRequest(ctx: Ctx, requestId: string): Promise<number> {
  requireManager(ctx);
  const r = await prisma.paymentRequest.findFirst({ where: { id: requestId, teamId: ctx.teamId } });
  if (!r) throw notFound('Không tìm thấy yêu cầu');
  return prisma.$transaction(async (tx) => {
    await tx.paymentRequest.update({ where: { id: r.id }, data: { remindedAt: ctx.now } });
    return notifyOwed(tx, ctx, r, 'Nhắc: bạn chưa đóng');
  });
}

/** Thành viên báo "Tôi đã đóng" → báo ĐT. Bị ĐT báo chưa nhận thì báo lại được. */
export async function declarePaid(ctx: Ctx, requestId: string) {
  if (!ctx.playerId) throw forbidden('Bạn không phải thành viên đội này');
  const r = await prisma.paymentRequest.findFirst({ where: { id: requestId, teamId: ctx.teamId } });
  if (!r) throw notFound('Không tìm thấy yêu cầu');
  const owed = await owedOf(prisma, r);
  const me = owed?.players.find((p) => p.id === ctx.playerId);
  if (!owed || !me) throw invalid('Khoản này bạn đã đóng hoặc không phải đóng');
  await prisma.$transaction(async (tx) => {
    await tx.paymentNotice.upsert({
      where: { requestId_playerId: { requestId, playerId: me.id } },
      create: { requestId, playerId: me.id, status: 'pending', declaredAt: ctx.now },
      update: { status: 'pending', declaredAt: ctx.now, decidedAt: null, decidedById: null },
    });
    await emit(tx, {
      kind: 'fund', teamId: ctx.teamId, view: 'duyet', actorId: ctx.user.id, recipients: await captainUserIds(tx, ctx.teamId),
      text: `${me.name} báo đã đóng ${owed.label} (${money(r.amount)})`,
    });
  });
}

/** Ghi đã đóng vào dữ liệu gốc + sổ quỹ (dùng chung cho xác nhận ở tab Duyệt). */
async function markPaid(tx: Db, r: Req, playerId: string) {
  if (r.kind === 'dues') {
    await tx.duesPayment.upsert({
      where: { teamId_playerId_month: { teamId: r.teamId, playerId, month: r.key } },
      create: { teamId: r.teamId, playerId, month: r.key, amount: r.amount },
      update: {},
    });
    await syncDues(tx, r.teamId, r.key);
  } else {
    await tx.attendance.update({ where: { matchId_playerId: { matchId: r.key, playerId } }, data: { lePaid: true } });
    await syncLe(tx, r.key);
  }
}

/** ĐT xác nhận đã nhận tiền (ghi sổ) hoặc báo chưa nhận; báo lại cho người đóng. */
export async function decidePayment(ctx: Ctx, requestId: string, playerId: string, ok: boolean) {
  requireManager(ctx);
  const n = await prisma.paymentNotice.findFirst({
    where: { requestId, playerId, status: 'pending', request: { teamId: ctx.teamId } },
    include: { request: true, player: true },
  });
  if (!n) throw notFound('Báo đóng tiền không còn chờ xác nhận');
  const owed = await owedOf(prisma, n.request);
  await prisma.$transaction(async (tx) => {
    if (ok && owed?.players.some((p) => p.id === playerId)) await markPaid(tx, n.request, playerId);
    await tx.paymentNotice.update({
      where: { requestId_playerId: { requestId, playerId } },
      data: { status: ok ? 'confirmed' : 'rejected', decidedAt: ctx.now, decidedById: ctx.user.id },
    });
    const label = owed?.label ?? 'khoản đóng tiền';
    await emit(tx, {
      kind: 'result', teamId: ctx.teamId, view: 'toi', actorId: ctx.user.id, recipients: [n.player.userId],
      text: ok ? `Đội trưởng đã xác nhận bạn đóng ${label} (${money(n.request.amount)})` : `Đội trưởng chưa nhận được tiền ${label}. Kiểm tra lại rồi báo đóng lại nhé`,
    });
    await audit(tx, ctx, ok ? 'pay.confirm' : 'pay.reject', 'payment_request', requestId, null, { playerId });
  });
}

/** ✓ tay ở tab Quỹ: báo đóng đang chờ của người đó coi như đã xác nhận. */
export async function settleNotices(db: Db, ctx: Ctx, kind: 'dues' | 'le', key: string, playerId: string) {
  await db.paymentNotice.updateMany({
    where: { playerId, status: 'pending', request: { teamId: ctx.teamId, kind, key } },
    data: { status: 'confirmed', decidedAt: ctx.now, decidedById: ctx.user.id },
  });
}

export interface MyPayment { id: string; kind: 'dues' | 'le'; label: string; amount: number; note: string | null; matchId: string | null; status: 'due' | 'pending' | 'rejected' }

/** Khoản người đang xem còn phải đóng (thẻ nhắc ở Đội / Của tôi). */
export async function myPayments(ctx: Ctx): Promise<MyPayment[]> {
  if (!ctx.playerId) return [];
  const reqs = await prisma.paymentRequest.findMany({
    where: { teamId: ctx.teamId, OR: [{ kind: 'le' }, { kind: 'dues', key: { lte: currentMonth(ctx.now) } }] },
    include: { notices: { where: { playerId: ctx.playerId } } },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  const out: MyPayment[] = [];
  for (const r of reqs) {
    const owed = await owedOf(prisma, r);
    if (!owed?.players.some((p) => p.id === ctx.playerId)) continue;
    const st = r.notices[0]?.status;
    out.push({
      id: r.id, kind: r.kind as MyPayment['kind'], label: owed.label, amount: r.amount, note: r.note, matchId: r.kind === 'le' ? r.key : null,
      status: st === 'pending' ? 'pending' : st === 'rejected' ? 'rejected' : 'due',
    });
  }
  return out;
}

export interface RequestRow { id: string; kind: 'dues' | 'le'; label: string; amount: number; createdAt: string; remindedAt: string | null; owed: string[]; pending: string[] }

/** Yêu cầu còn người nợ (tab Quỹ của ĐT). */
export async function openRequests(ctx: Ctx): Promise<RequestRow[]> {
  const reqs = await prisma.paymentRequest.findMany({
    where: { teamId: ctx.teamId },
    include: { notices: { where: { status: 'pending' }, select: { playerId: true } } },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  const out: RequestRow[] = [];
  for (const r of reqs) {
    const owed = await owedOf(prisma, r);
    if (!owed?.players.length) continue;
    const pend = new Set(r.notices.map((n) => n.playerId));
    out.push({
      id: r.id, kind: r.kind as RequestRow['kind'], label: owed.label, amount: r.amount, createdAt: r.createdAt.toISOString(),
      remindedAt: r.remindedAt?.toISOString() ?? null, owed: owed.players.filter((p) => !pend.has(p.id)).map((p) => p.id),
      pending: owed.players.filter((p) => pend.has(p.id)).map((p) => p.id),
    });
  }
  return out;
}

/** Báo đóng chờ ĐT xác nhận (tab Duyệt). */
export async function pendingNotices(teamId: string) {
  const ns = await prisma.paymentNotice.findMany({
    where: { status: 'pending', request: { teamId } },
    include: { request: true },
    orderBy: { declaredAt: 'asc' },
  });
  const out: Array<{ requestId: string; playerId: string; label: string; amount: number; declaredAt: string }> = [];
  for (const n of ns) {
    const owed = await owedOf(prisma, n.request);
    // đã được ✓ tay hoặc trận đã xoá → không còn gì để xác nhận
    if (!owed?.players.some((p) => p.id === n.playerId)) continue;
    out.push({ requestId: n.requestId, playerId: n.playerId, label: owed.label, amount: n.request.amount, declaredAt: n.declaredAt.toISOString() });
  }
  return out;
}

/** Job: nhắc lại mỗi 3 ngày người chưa đóng, cho yêu cầu trong 30 ngày gần đây. */
export async function autoRemind(now: Date): Promise<number> {
  const reqs = await prisma.paymentRequest.findMany({
    where: {
      createdAt: { gte: new Date(now.getTime() - AUTO_REMIND_MAX_AGE_MS) },
      OR: [{ remindedAt: null }, { remindedAt: { lte: new Date(now.getTime() - AUTO_REMIND_MS) } }],
      team: { hidden: false },
    },
  });
  let sent = 0;
  for (const r of reqs) {
    // cập nhật có điều kiện: hai lần tick chồng nhau không nhắc trùng
    const claimed = await prisma.paymentRequest.updateMany({ where: { id: r.id, remindedAt: r.remindedAt }, data: { remindedAt: now } });
    if (claimed.count) sent += await notifyOwed(prisma, null, r, 'Nhắc: bạn chưa đóng');
  }
  return sent;
}
