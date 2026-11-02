import { z } from 'zod';
import { prisma, type Db, type Prisma } from '@san7/db';
import {
  OPEN_OFFER, formatValue, marketValueSchema, offerSchema, overall, type OfferStatus, type Position,
} from '@san7/core';
import { type Ctx, canManage, requireManager } from '../authz';
import { audit } from '../audit';
import { conflict, forbidden, invalid, isUniqueViolation, notFound, zodMessage } from '../errors';
import { captainUserIds, emit } from './notify';
import { statsOf } from './mappers';

/**
 * Chuyển nhượng (BRD 12): giá trị cầu thủ (M/B đồng), thị trường chung, đề nghị mua giữa các đội.
 * Luồng đề nghị: ĐT đội mua gửi → ĐT đội bán chấp nhận / trả giá / từ chối → (trả giá thì ĐT đội mua đồng ý)
 * → cầu thủ đồng ý → hoàn tất: hồ sơ cũ chuyển "đã rời" (giữ thống kê), hồ sơ mới ở đội mua.
 */

const VIEW = 'chuyen-nhuong';
const nameOf = (p: { nick: string | null; fullName: string }) => p.nick || p.fullName;
const valueInput = z.object({ value: marketValueSchema });

/* ---------------- Giá trị ---------------- */

async function writeValue(db: Db, playerId: string, value: number, source: 'self' | 'captain' | 'transfer', by: string | null, at: Date) {
  await db.player.update({ where: { id: playerId }, data: { marketValue: value, marketValueAt: at } });
  await db.marketValueLog.create({ data: { playerId, value, source, setById: by, createdAt: at } });
}

/** Thành viên tự đặt giá trị của mình — áp dụng ngay (ĐT khoá thì không sửa được). */
export async function setMyValue(ctx: Ctx, raw: unknown) {
  if (!ctx.playerId) throw forbidden('Chỉ thành viên đội mới đặt được giá trị của mình');
  const p = valueInput.safeParse(raw);
  if (!p.success) throw invalid(zodMessage(p.error));
  const me = await prisma.player.findUniqueOrThrow({ where: { id: ctx.playerId } });
  if (me.valueLocked && !canManage(ctx.role)) throw forbidden('Đội trưởng đã khoá giá trị của bạn');
  if (me.marketValue === p.data.value) return;
  await prisma.$transaction(async (tx) => {
    await writeValue(tx, me.id, p.data.value, 'self', ctx.user.id, ctx.now);
    await audit(tx, ctx, 'market.value', 'player', me.id, { value: me.marketValue }, { value: p.data.value, source: 'self' });
  });
}

/** ĐT đặt / sửa giá trị của bất kỳ thành viên nào. */
export async function setPlayerValue(ctx: Ctx, playerId: string, raw: unknown) {
  requireManager(ctx);
  const p = valueInput.safeParse(raw);
  if (!p.success) throw invalid(zodMessage(p.error));
  const pl = await prisma.player.findFirst({ where: { id: playerId, teamId: ctx.teamId, status: 'active' } });
  if (!pl) throw notFound('Không tìm thấy cầu thủ');
  if (pl.marketValue === p.data.value) return;
  await prisma.$transaction(async (tx) => {
    await writeValue(tx, pl.id, p.data.value, 'captain', ctx.user.id, ctx.now);
    await audit(tx, ctx, 'market.value', 'player', pl.id, { value: pl.marketValue }, { value: p.data.value, source: 'captain' });
    await emit(tx, {
      kind: 'transfer', teamId: ctx.teamId, recipients: [pl.userId], actorId: ctx.user.id, view: VIEW,
      text: `Đội trưởng đặt giá trị chuyển nhượng của bạn: ${formatValue(p.data.value)}`,
    });
  });
}

/** ĐT khoá / mở giá của một người. */
export async function setValueLock(ctx: Ctx, playerId: string, locked: boolean) {
  requireManager(ctx);
  const n = await prisma.player.updateMany({ where: { id: playerId, teamId: ctx.teamId, status: 'active' }, data: { valueLocked: locked } });
  if (!n.count) throw notFound('Không tìm thấy cầu thủ');
  await audit(prisma, ctx, locked ? 'market.lock' : 'market.unlock', 'player', playerId);
}

/** ĐT rao bán / gỡ rao một cầu thủ trên thị trường chung. */
export async function setListed(ctx: Ctx, playerId: string, listed: boolean) {
  requireManager(ctx);
  const pl = await prisma.player.findFirst({ where: { id: playerId, teamId: ctx.teamId, status: 'active' } });
  if (!pl) throw notFound('Không tìm thấy cầu thủ');
  if (listed && pl.marketValue == null) throw invalid('Cần định giá trước khi rao bán');
  await prisma.player.update({ where: { id: pl.id }, data: { listedAt: listed ? ctx.now : null } });
  await audit(prisma, ctx, listed ? 'market.list' : 'market.unlist', 'player', pl.id);
  if (listed) {
    await emit(prisma, {
      kind: 'transfer', teamId: ctx.teamId, recipients: [pl.userId], actorId: ctx.user.id, view: VIEW,
      text: `Bạn được đưa lên thị trường chuyển nhượng với giá ${formatValue(pl.marketValue)}`,
    });
  }
}

/** ĐT nhắc người chưa định giá: một người hoặc tất cả. Trả về số người được nhắc. */
export async function remindValue(ctx: Ctx, playerId?: string | null) {
  requireManager(ctx);
  const targets = await prisma.player.findMany({
    where: { teamId: ctx.teamId, status: 'active', marketValue: null, userId: { not: null }, ...(playerId ? { id: playerId } : {}) },
    select: { userId: true },
  });
  if (!targets.length) throw invalid(playerId ? 'Người này đã định giá hoặc chưa có tài khoản' : 'Mọi người đã định giá');
  return emit(prisma, {
    kind: 'transfer', teamId: ctx.teamId, recipients: targets.map((t) => t.userId), actorId: ctx.user.id, view: VIEW,
    text: 'Đội trưởng nhắc: đặt giá trị chuyển nhượng của bạn (tab Chuyển nhượng)',
  });
}

/* ---------------- Đề nghị chuyển nhượng ---------------- */

async function isCaptainOf(ctx: Ctx, teamId: string) {
  if (ctx.user.role === 'admin') return true;
  return !!(await prisma.teamCaptain.findUnique({ where: { teamId_userId: { teamId, userId: ctx.user.id } } }));
}

const offerCtx = (ctx: Ctx, teamId: string): Ctx => ({ ...ctx, teamId });

/**
 * ĐT đội mua gửi đề nghị (hoặc sửa giá đề nghị đang mở). Không mua được: cầu thủ đội mình, đội trưởng đội bạn,
 * người đã ở đội mua.
 */
export async function makeOffer(ctx: Ctx, playerId: string, raw: unknown) {
  const p = offerSchema.extend({ buyerTeamId: z.string().min(1) }).safeParse(raw);
  if (!p.success) throw invalid(zodMessage(p.error));
  const { amount, buyerTeamId } = p.data;
  const message = p.data.message || null;
  if (!(await isCaptainOf(ctx, buyerTeamId))) throw forbidden('Chỉ đội trưởng đội mua mới gửi được đề nghị');
  const pl = await prisma.player.findFirst({ where: { id: playerId, status: 'active' }, include: { team: { select: { id: true, name: true, hidden: true } } } });
  if (!pl || pl.team.hidden) throw notFound('Không tìm thấy cầu thủ');
  if (pl.teamId === buyerTeamId) throw invalid('Cầu thủ đã ở đội của bạn');
  const buyer = await prisma.team.findUniqueOrThrow({ where: { id: buyerTeamId }, select: { id: true, name: true } });
  if (pl.userId) {
    const [cap, already] = await Promise.all([
      prisma.teamCaptain.findUnique({ where: { teamId_userId: { teamId: pl.teamId, userId: pl.userId } } }),
      prisma.player.findFirst({ where: { teamId: buyerTeamId, userId: pl.userId, status: 'active' } }),
    ]);
    if (cap) throw invalid('Không chuyển nhượng đội trưởng — đội bạn cần đổi đội trưởng trước');
    if (already) throw invalid('Cầu thủ này đã là thành viên đội của bạn');
  }
  const open = await prisma.transferOffer.findFirst({ where: { playerId, buyerTeamId, status: { in: OPEN_OFFER } } });
  if (open?.status === 'agreed') throw conflict('Hai đội đã thống nhất giá, đang chờ cầu thủ đồng ý');
  try {
    return await prisma.$transaction(async (tx) => {
      const o = open
        ? await tx.transferOffer.update({ where: { id: open.id }, data: { amount, message, status: 'pending', counter: null, createdById: ctx.user.id } })
        : await tx.transferOffer.create({ data: { playerId, sellerTeamId: pl.teamId, buyerTeamId, amount, message, createdById: ctx.user.id } });
      const verb = open ? 'nâng đề nghị' : 'muốn mua';
      await emit(tx, {
        kind: 'transfer', teamId: pl.teamId, recipients: await captainUserIds(tx, pl.teamId), actorId: ctx.user.id, view: VIEW,
        text: `${buyer.name} ${verb} ${nameOf(pl)} với giá ${formatValue(amount)}`,
      });
      await emit(tx, {
        kind: 'transfer', teamId: pl.teamId, recipients: [pl.userId], actorId: ctx.user.id, view: VIEW,
        text: `${buyer.name} gửi đề nghị chiêu mộ bạn: ${formatValue(amount)}`,
      });
      await audit(tx, offerCtx(ctx, buyerTeamId), open ? 'transfer.raise' : 'transfer.offer', 'transfer_offer', o.id, open ? { amount: open.amount } : null, { playerId, amount });
      return o;
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict('Đội bạn đã có đề nghị đang mở cho cầu thủ này');
    throw e;
  }
}

export type OfferAction = 'accept' | 'counter' | 'reject' | 'withdraw';
const respondSchema = z.object({
  action: z.enum(['accept', 'counter', 'reject', 'withdraw']),
  counter: marketValueSchema.optional(),
  reason: z.string().trim().max(120).optional().nullable(),
});

/**
 * Trả lời đề nghị. Vai trò xét theo đề nghị (không theo đội đang xem):
 * - ĐT đội bán: chấp nhận / trả giá / từ chối khi đang chờ đội bán.
 * - ĐT đội mua: đồng ý giá đội bán trả (accept khi countered) / rút.
 * - Cầu thủ: đồng ý / từ chối khi hai đội đã thống nhất.
 */
export async function respondOffer(ctx: Ctx, offerId: string, raw: unknown) {
  const p = respondSchema.safeParse(raw);
  if (!p.success) throw invalid(zodMessage(p.error));
  const { action } = p.data;
  const reason = p.data.reason || null;
  const o = await prisma.transferOffer.findUnique({ where: { id: offerId }, include: { player: true, seller: { select: { name: true } }, buyer: { select: { name: true } } } });
  if (!o) throw notFound('Không tìm thấy đề nghị');
  const status = o.status as OfferStatus;
  if (!OPEN_OFFER.includes(status)) throw invalid('Đề nghị này đã kết thúc');
  const [sellerCap, buyerCap] = await Promise.all([isCaptainOf(ctx, o.sellerTeamId), isCaptainOf(ctx, o.buyerTeamId)]);
  const isPlayer = !!o.player.userId && o.player.userId === ctx.user.id;
  const pn = nameOf(o.player);
  const sellerCaps = () => captainUserIds(prisma, o.sellerTeamId);
  const buyerCaps = () => captainUserIds(prisma, o.buyerTeamId);

  // Đội mua rút
  if (action === 'withdraw') {
    if (!buyerCap) throw forbidden('Chỉ đội trưởng đội mua mới rút được đề nghị');
    await prisma.$transaction(async (tx) => {
      await tx.transferOffer.update({ where: { id: o.id }, data: { status: 'withdrawn', decidedById: ctx.user.id, reason } });
      await emit(tx, { kind: 'transfer', teamId: o.sellerTeamId, recipients: [...(await sellerCaps()), o.player.userId], actorId: ctx.user.id, view: VIEW, text: `${o.buyer.name} đã rút đề nghị mua ${pn}` });
      await audit(tx, offerCtx(ctx, o.buyerTeamId), 'transfer.withdraw', 'transfer_offer', o.id);
    });
    return { status: 'withdrawn' as const };
  }

  if (status === 'pending') {
    if (!sellerCap) throw forbidden('Chỉ đội trưởng đội bán mới trả lời được đề nghị này');
    if (action === 'reject') return close(ctx, o.id, o.sellerTeamId, 'rejected', reason, await buyerCaps(), o.buyerTeamId, `${o.seller.name} từ chối bán ${pn}${reason ? ` · ${reason}` : ''}`);
    if (action === 'counter') {
      if (!p.data.counter) throw invalid('Nhập giá trả lại');
      if (p.data.counter <= o.amount) throw invalid('Giá trả lại phải cao hơn giá đội mua đề nghị');
      await prisma.$transaction(async (tx) => {
        await tx.transferOffer.update({ where: { id: o.id }, data: { status: 'countered', counter: p.data.counter, decidedById: ctx.user.id, reason } });
        await emit(tx, { kind: 'transfer', teamId: o.buyerTeamId, recipients: await buyerCaps(), actorId: ctx.user.id, view: VIEW, text: `${o.seller.name} trả giá ${pn}: ${formatValue(p.data.counter!)}` });
        await audit(tx, offerCtx(ctx, o.sellerTeamId), 'transfer.counter', 'transfer_offer', o.id, { amount: o.amount }, { counter: p.data.counter });
      });
      return { status: 'countered' as const };
    }
    return agree(ctx, o.id, o.amount, o.sellerTeamId);
  }

  if (status === 'countered') {
    if (action === 'reject' && sellerCap) return close(ctx, o.id, o.sellerTeamId, 'rejected', reason, await buyerCaps(), o.buyerTeamId, `${o.seller.name} từ chối bán ${pn}`);
    if (!buyerCap) throw forbidden('Đang chờ đội mua trả lời giá đội bán đưa ra');
    if (action === 'reject') return close(ctx, o.id, o.buyerTeamId, 'withdrawn', reason, await sellerCaps(), o.sellerTeamId, `${o.buyer.name} không đồng ý giá ${pn}, đã rút đề nghị`);
    if (action !== 'accept') throw invalid('Đồng ý giá đội bán hoặc nâng đề nghị mới');
    return agree(ctx, o.id, o.counter!, o.buyerTeamId);
  }

  // agreed → chờ cầu thủ
  if (!isPlayer) {
    if (action === 'reject' && sellerCap) return close(ctx, o.id, o.sellerTeamId, 'cancelled', reason, [...(await buyerCaps()), o.player.userId], o.buyerTeamId, `${o.seller.name} huỷ thương vụ ${pn}`);
    throw forbidden('Đang chờ cầu thủ đồng ý chuyển đội');
  }
  if (action === 'reject') return close(ctx, o.id, o.sellerTeamId, 'rejected', reason, [...(await buyerCaps()), ...(await sellerCaps())], o.buyerTeamId, `${pn} từ chối chuyển sang ${o.buyer.name}`);
  if (action !== 'accept') throw invalid('Đồng ý hoặc từ chối chuyển đội');
  return completeTransfer(ctx, o.id);
}

async function close(ctx: Ctx, offerId: string, actorTeamId: string, status: OfferStatus, reason: string | null, recipients: Array<string | null>, notifyTeamId: string, text: string) {
  await prisma.$transaction(async (tx) => {
    await tx.transferOffer.update({ where: { id: offerId }, data: { status, decidedById: ctx.user.id, reason } });
    await emit(tx, { kind: 'transfer', teamId: notifyTeamId, recipients, actorId: ctx.user.id, view: VIEW, text });
    await audit(tx, offerCtx(ctx, actorTeamId), `transfer.${status}`, 'transfer_offer', offerId, null, { reason });
  });
  return { status };
}

/** Hai đội thống nhất giá → chờ cầu thủ; cầu thủ không có tài khoản thì hoàn tất luôn. */
async function agree(ctx: Ctx, offerId: string, price: number, actorTeamId: string) {
  const o = await prisma.transferOffer.update({
    where: { id: offerId }, data: { status: 'agreed', amount: price, decidedById: ctx.user.id },
    include: { player: true, seller: { select: { name: true } }, buyer: { select: { name: true } } },
  });
  await audit(prisma, offerCtx(ctx, actorTeamId), 'transfer.agree', 'transfer_offer', o.id, null, { amount: price });
  if (!o.player.userId) return completeTransfer(ctx, o.id);
  const pn = nameOf(o.player);
  await emit(prisma, {
    kind: 'transfer', teamId: o.sellerTeamId, recipients: [o.player.userId], actorId: ctx.user.id, view: VIEW,
    text: `${o.seller.name} và ${o.buyer.name} đã thống nhất ${formatValue(price)} — bạn đồng ý chuyển đội không?`,
  });
  await emit(prisma, {
    kind: 'transfer', teamId: o.buyerTeamId, recipients: [...(await captainUserIds(prisma, o.buyerTeamId)), ...(await captainUserIds(prisma, o.sellerTeamId))],
    actorId: ctx.user.id, view: VIEW, text: `Đã thống nhất giá ${pn}: ${formatValue(price)} — chờ cầu thủ đồng ý`,
  });
  return { status: 'agreed' as const };
}

/** Hoàn tất: hồ sơ cũ "đã rời" (giữ thống kê), tạo / mở lại hồ sơ ở đội mua, huỷ các đề nghị khác. */
async function completeTransfer(ctx: Ctx, offerId: string) {
  return prisma.$transaction(async (tx) => {
    const o = await tx.transferOffer.findUniqueOrThrow({ where: { id: offerId }, include: { player: true, seller: { select: { name: true } }, buyer: { select: { name: true } } } });
    const old = o.player;
    if (old.status !== 'active' || old.teamId !== o.sellerTeamId) throw invalid('Cầu thủ không còn ở đội bán');
    const pn = nameOf(old);

    // Rời đội bán: bỏ khỏi đội hình chính, gỡ rao
    await tx.player.update({ where: { id: old.id }, data: { status: 'left', isCaptain: false, listedAt: null } });
    const seller = await tx.team.findUniqueOrThrow({ where: { id: o.sellerTeamId }, select: { lineup: true } });
    const lu = Array.isArray(seller.lineup) ? (seller.lineup as Array<string | null>) : [];
    if (lu.includes(old.id)) await tx.team.update({ where: { id: o.sellerTeamId }, data: { lineup: lu.map((x) => (x === old.id ? null : x)) } });

    // Vào đội mua: giữ hồ sơ, số áo nếu còn trống
    const numTaken = old.num != null && (await tx.player.count({ where: { teamId: o.buyerTeamId, status: 'active', num: old.num } })) > 0;
    const profile = {
      fullName: old.fullName, nick: old.nick, dob: old.dob, avatarUrl: old.avatarUrl, num: numTaken ? null : old.num, foot: old.foot,
      stats: old.stats ?? {}, styles: old.styles, payType: 'quy', payTypeFrom: null, prevPayType: null, isCaptain: false, status: 'active',
      marketValue: o.amount, marketValueAt: ctx.now, valueLocked: false, listedAt: null,
    };
    const prev = old.userId ? await tx.player.findFirst({ where: { teamId: o.buyerTeamId, userId: old.userId } }) : null;
    const np = prev
      ? await tx.player.update({ where: { id: prev.id }, data: profile })
      : await tx.player.create({ data: { ...profile, teamId: o.buyerTeamId, userId: old.userId } });
    await tx.marketValueLog.create({ data: { playerId: np.id, value: o.amount, source: 'transfer', setById: ctx.user.id, createdAt: ctx.now } });

    await tx.transferOffer.update({ where: { id: o.id }, data: { status: 'completed', completedAt: ctx.now, newPlayerId: np.id } });
    // Các đội khác đang hỏi mua người này → huỷ
    const others = await tx.transferOffer.findMany({ where: { playerId: old.id, id: { not: o.id }, status: { in: OPEN_OFFER } } });
    for (const x of others) {
      await tx.transferOffer.update({ where: { id: x.id }, data: { status: 'cancelled', reason: `Đã chuyển sang ${o.buyer.name}` } });
      await emit(tx, { kind: 'transfer', teamId: x.buyerTeamId, recipients: await captainUserIds(tx, x.buyerTeamId), view: VIEW, text: `Đề nghị mua ${pn} đã huỷ: cầu thủ chuyển sang ${o.buyer.name}` });
    }

    const members = async (teamId: string) =>
      (await tx.player.findMany({ where: { teamId, status: 'active', userId: { not: null } }, select: { userId: true } })).map((m) => m.userId);
    await emit(tx, {
      kind: 'transfer', teamId: o.buyerTeamId, recipients: await members(o.buyerTeamId), actorId: old.userId, view: VIEW,
      text: `HERE WE GO! ${pn} gia nhập đội từ ${o.seller.name} · ${formatValue(o.amount)}`,
    });
    await emit(tx, {
      kind: 'transfer', teamId: o.sellerTeamId, recipients: await members(o.sellerTeamId), actorId: old.userId, view: VIEW,
      text: `${pn} chia tay đội, chuyển sang ${o.buyer.name} · ${formatValue(o.amount)}`,
    });
    if (old.userId && old.userId !== ctx.user.id) {
      await emit(tx, { kind: 'transfer', teamId: o.buyerTeamId, recipients: [old.userId], view: 'doi', text: `Chào mừng bạn đến ${o.buyer.name}!` });
    }
    await audit(tx, offerCtx(ctx, o.sellerTeamId), 'transfer.complete', 'transfer_offer', o.id, { playerId: old.id }, { newPlayerId: np.id, buyerTeamId: o.buyerTeamId, amount: o.amount });
    return { status: 'completed' as const, newPlayerId: np.id };
  });
}

/* ---------------- Dữ liệu tab Chuyển nhượng ---------------- */

export interface MarketPlayer {
  id: string;
  teamId: string;
  teamName: string;
  fullName: string;
  nick: string | null;
  num: number | null;
  avatarUrl: string | null;
  foot: string;
  pos: Position;
  ovr: number;
  value: number | null;
  prevValue: number | null;
  valueAt: string | null;
  listedAt: string | null;
  locked: boolean;
  hasAccount: boolean;
  isCaptain: boolean;
  history: Array<{ value: number; at: string; source: string }>;
}

export interface OfferDTO {
  id: string;
  status: OfferStatus;
  amount: number;
  counter: number | null;
  message: string | null;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  player: { id: string; name: string; avatarUrl: string | null; pos: Position; ovr: number; value: number | null };
  seller: { id: string; name: string };
  buyer: { id: string; name: string };
  /** người xem có thể làm gì với đề nghị này */
  can: Array<'accept' | 'counter' | 'reject' | 'withdraw' | 'raise'>;
}

type PlayerRow = Awaited<ReturnType<typeof loadPlayers>>[number];
function loadPlayers(where: Prisma.PlayerWhereInput, take?: number) {
  return prisma.player.findMany({
    where,
    include: { team: { select: { name: true } }, valueHistory: { orderBy: { createdAt: 'desc' }, take: 12 } },
    orderBy: [{ marketValue: { sort: 'desc', nulls: 'last' } }, { fullName: 'asc' }],
    take,
  });
}

async function captainSet(teamIds: string[]) {
  const caps = await prisma.teamCaptain.findMany({ where: { teamId: { in: teamIds } }, select: { teamId: true, userId: true } });
  return new Set(caps.map((c) => `${c.teamId}:${c.userId}`));
}

function toMarket(p: PlayerRow, caps: Set<string>): MarketPlayer {
  const { pos, ovr } = overall(statsOf(p.stats), p.foot);
  const hist = p.valueHistory;
  // giá trước = bản ghi gần nhất khác giá hiện tại
  const prev = hist.find((h, i) => i > 0 && h.value !== p.marketValue) ?? null;
  return {
    id: p.id, teamId: p.teamId, teamName: p.team.name, fullName: p.fullName, nick: p.nick, num: p.num, avatarUrl: p.avatarUrl, foot: p.foot,
    pos, ovr, value: p.marketValue, prevValue: prev?.value ?? null, valueAt: p.marketValueAt?.toISOString() ?? null,
    listedAt: p.listedAt?.toISOString() ?? null, locked: p.valueLocked, hasAccount: !!p.userId,
    isCaptain: !!p.userId && caps.has(`${p.teamId}:${p.userId}`),
    history: hist.map((h) => ({ value: h.value, at: h.createdAt.toISOString(), source: h.source })).reverse(),
  };
}

export async function marketView(ctx: Ctx) {
  const manager = canManage(ctx.role);
  const insider = ctx.role !== 'guest';
  const myCaptaincies =
    ctx.user.role === 'admin'
      ? await prisma.team.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } })
      : (await prisma.teamCaptain.findMany({ where: { userId: ctx.user.id }, include: { team: { select: { id: true, name: true } } } })).map((c) => c.team);

  const [squadRows, listedRows, offerRows, newsRows] = await Promise.all([
    loadPlayers({ teamId: ctx.teamId, status: 'active' }),
    loadPlayers({ status: 'active', listedAt: { not: null }, marketValue: { not: null }, team: { hidden: false } }, 80),
    prisma.transferOffer.findMany({
      where: {
        OR: [
          ...(manager ? [{ sellerTeamId: ctx.teamId }, { buyerTeamId: ctx.teamId }] : []),
          ...(ctx.playerId ? [{ playerId: ctx.playerId }] : []),
          ...(myCaptaincies.length ? [{ buyerTeamId: { in: myCaptaincies.map((t) => t.id) }, sellerTeamId: ctx.teamId }] : []),
        ],
      },
      include: { player: true, seller: { select: { id: true, name: true } }, buyer: { select: { id: true, name: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 60,
    }),
    prisma.transferOffer.findMany({
      where: { status: 'completed', seller: { hidden: false }, buyer: { hidden: false } },
      include: { player: true, seller: { select: { id: true, name: true } }, buyer: { select: { id: true, name: true } } },
      orderBy: { completedAt: 'desc' },
      take: 20,
    }),
  ]);
  const caps = await captainSet([...new Set([...squadRows, ...listedRows].map((p) => p.teamId))]);
  const squad = squadRows.map((p) => toMarket(p, caps));
  const market = listedRows.map((p) => toMarket(p, caps));
  const capOf = new Set(myCaptaincies.map((t) => t.id));

  const offerDTO = (o: (typeof offerRows)[number]): OfferDTO => {
    const { pos, ovr } = overall(statsOf(o.player.stats), o.player.foot);
    const s = o.status as OfferStatus;
    const sellerCap = capOf.has(o.sellerTeamId);
    const buyerCap = capOf.has(o.buyerTeamId);
    const isPlayer = !!o.player.userId && o.player.userId === ctx.user.id;
    const can: OfferDTO['can'] = [];
    if (s === 'pending' && sellerCap) can.push('accept', 'counter', 'reject');
    if (s === 'countered' && buyerCap) can.push('accept', 'reject');
    if (s === 'countered' && sellerCap) can.push('reject');
    if (s === 'agreed' && isPlayer) can.push('accept', 'reject');
    if (s === 'agreed' && sellerCap && !isPlayer) can.push('reject');
    if ((s === 'pending' || s === 'countered') && buyerCap) can.push('raise', 'withdraw');
    if (s === 'agreed' && buyerCap) can.push('withdraw');
    return {
      id: o.id, status: s, amount: o.amount, counter: o.counter, message: o.message, reason: o.reason,
      createdAt: o.createdAt.toISOString(), updatedAt: o.updatedAt.toISOString(), completedAt: o.completedAt?.toISOString() ?? null,
      player: { id: o.player.id, name: nameOf(o.player), avatarUrl: o.player.avatarUrl, pos, ovr, value: o.player.marketValue },
      seller: o.seller, buyer: o.buyer, can: [...new Set(can)],
    };
  };

  const valued = squad.filter((p) => p.value != null);
  return {
    teamId: ctx.teamId,
    canEdit: manager,
    insider,
    myPlayerId: ctx.playerId,
    /** các đội người xem làm ĐT (đội mua khi gửi đề nghị; bỏ đội của chính cầu thủ ở giao diện) */
    buyerTeams: myCaptaincies,
    myTeamIds: [...capOf],
    squad,
    totals: {
      value: valued.reduce((a, p) => a + (p.value ?? 0), 0),
      valued: valued.length,
      players: squad.length,
      top: valued[0]?.id ?? null,
      avg: valued.length ? Math.round(valued.reduce((a, p) => a + (p.value ?? 0), 0) / valued.length) : 0,
    },
    market,
    offers: insider || myCaptaincies.length ? offerRows.map(offerDTO) : [],
    news: newsRows.map((o) => ({
      id: o.id, at: o.completedAt!.toISOString(), amount: o.amount,
      player: { id: o.newPlayerId ?? o.player.id, name: nameOf(o.player), avatarUrl: o.player.avatarUrl, ...overall(statsOf(o.player.stats), o.player.foot) },
      seller: o.seller, buyer: o.buyer,
    })),
  };
}

export type MarketData = Awaited<ReturnType<typeof marketView>>;
