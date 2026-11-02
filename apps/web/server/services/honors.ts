import { z } from 'zod';
import { prisma, type Db } from '@san7/db';
import {
  addMonths, cardOf, currentMonth, fillStats, monthLabel, vnDateTime, type CardSnapshot, type Stats,
} from '@san7/core';
import { type Ctx, canManage, requireManager } from '../authz';
import { audit } from '../audit';
import { forbidden, invalid, isUniqueViolation, notFound, zodMessage } from '../errors';
import { emit } from './notify';

/**
 * Vinh danh (BRD 13). Tự động: MVP trận, Vua phá lưới / Vua kiến tạo tháng (chỉ sự kiện sau team.honorsFrom).
 * Đội trưởng vinh danh thủ công. Chỉ số mới → thẻ "lên chỉ số". Mỗi lần vinh danh lưu ảnh chụp thẻ.
 */

export type HonorKind = 'mvp' | 'top_scorer' | 'top_assist' | 'captain' | 'stats';
export const HONOR_LABEL: Record<HonorKind, string> = {
  mvp: 'MVP trận', top_scorer: 'Vua phá lưới', top_assist: 'Vua kiến tạo', captain: 'Đội trưởng vinh danh', stats: 'Chỉ số mới',
};
const VIEW = 'vinh-danh';
const nameOf = (p: { nick: string | null; fullName: string }) => p.nick || p.fullName;

type PlayerRow = { id: string; teamId: string; userId: string | null; nick: string | null; fullName: string; num: number | null; avatarUrl: string | null; foot: string; styles: string[]; stats: unknown };

const members = async (db: Db, teamId: string) =>
  (await db.player.findMany({ where: { teamId, status: 'active', userId: { not: null } }, select: { userId: true } })).map((m) => m.userId);

/** Tạo một lần vinh danh + báo cả đội. Trùng (đã vinh danh sự kiện này) thì bỏ qua. */
async function createHonor(db: Db, input: { pl: PlayerRow; kind: HonorKind; title: string; note?: string | null; periodKey?: string | null; by?: string | null; card?: CardSnapshot }) {
  const { pl } = input;
  const card = input.card ?? cardOf(pl, fillStats((pl.stats ?? {}) as Record<string, number>));
  try {
    const h = await db.honor.create({
      data: { teamId: pl.teamId, playerId: pl.id, kind: input.kind, title: input.title, note: input.note ?? null, periodKey: input.periodKey ?? null, card: card as object, createdById: input.by ?? null },
    });
    const who = nameOf(pl);
    if (input.kind === 'stats') {
      await emit(db, { kind: 'honor', teamId: pl.teamId, recipients: [pl.userId], actorId: input.by, view: VIEW, text: `Chỉ số của bạn vừa được cập nhật: OVR ${card.prevOvr ?? card.ovr} → ${card.ovr} — mở thẻ mới` });
      await emit(db, { kind: 'honor', teamId: pl.teamId, recipients: (await members(db, pl.teamId)).filter((u) => u !== pl.userId), actorId: input.by, view: VIEW, text: `${who} vừa lên thẻ mới: OVR ${card.prevOvr ?? card.ovr} → ${card.ovr}` });
    } else {
      await emit(db, { kind: 'honor', teamId: pl.teamId, recipients: [pl.userId], actorId: input.by, view: VIEW, text: `Bạn được vinh danh: ${input.title} — mở thẻ!` });
      await emit(db, { kind: 'honor', teamId: pl.teamId, recipients: (await members(db, pl.teamId)).filter((u) => u !== pl.userId), actorId: input.by, view: VIEW, text: `Vinh danh ${who}: ${input.title}` });
    }
    return h;
  } catch (e) {
    if (isUniqueViolation(e)) return null;
    throw e;
  }
}

/** Đầu tháng sau (giờ VN) — mốc kết thúc tháng. */
const monthEnd = (month: string) => vnDateTime(`${addMonths(month, 1)}-01`, '00:00');

/** Chốt lười các vinh danh tự động (gọi khi tải trang đội, như sweep MVP). */
export async function syncHonors(teamId: string, now: Date) {
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { honorsFrom: true } });
  if (!team) return;
  const from = team.honorsFrom;

  // MVP trận
  const mvps = await prisma.match.findMany({
    where: { teamId, deletedAt: null, mvpPlayerId: { not: null }, kickoffAt: { gte: from } },
    select: { id: true, opponent: true, mvpPlayerId: true },
  });
  if (mvps.length) {
    const done = new Set((await prisma.honor.findMany({ where: { teamId, kind: 'mvp', periodKey: { in: mvps.map((m) => m.id) } }, select: { periodKey: true } })).map((h) => h.periodKey));
    for (const m of mvps.filter((x) => !done.has(x.id))) {
      const pl = await prisma.player.findUnique({ where: { id: m.mvpPlayerId! } });
      if (pl) await createHonor(prisma, { pl, kind: 'mvp', title: `MVP trận vs ${m.opponent}`, periodKey: m.id });
    }
  }

  // Vua phá lưới / kiến tạo của tháng đã kết thúc
  const cm = currentMonth(now);
  for (const month of [addMonths(cm, -1), addMonths(cm, -2)]) {
    const end = monthEnd(month);
    if (end <= from || end > now) continue;
    const have = await prisma.honor.count({ where: { teamId, periodKey: month, kind: { in: ['top_scorer', 'top_assist'] } } });
    if (have) continue;
    const evs = await prisma.matchEvent.findMany({
      where: { match: { teamId, deletedAt: null, scoreUs: { not: null }, date: { gte: `${month}-01`, lt: `${addMonths(month, 1)}-01` } } },
      select: { playerId: true, goals: true, assists: true },
    });
    const sum = (k: 'goals' | 'assists') => {
      const t = new Map<string, number>();
      for (const e of evs) t.set(e.playerId, (t.get(e.playerId) ?? 0) + e[k]);
      const best = Math.max(0, ...t.values());
      return { best, ids: best > 0 ? [...t].filter(([, v]) => v === best).map(([id]) => id) : [] };
    };
    for (const [kind, k, label] of [['top_scorer', 'goals', 'bàn'], ['top_assist', 'assists', 'kiến tạo']] as const) {
      const { best, ids } = sum(k);
      for (const id of ids) {
        const pl = await prisma.player.findUnique({ where: { id } });
        if (pl) await createHonor(prisma, { pl, kind, title: `${HONOR_LABEL[kind]} ${monthLabel(month)} · ${best} ${label}`, periodKey: month });
      }
    }
  }
}

/** Thẻ "lên chỉ số": gọi trong transaction khi chỉ số một người đổi (ĐT chốt / ĐT sửa). */
export async function statsHonor(db: Db, ctx: Ctx, pl: PlayerRow, before: Partial<Stats>, after: Partial<Stats>) {
  const prev = cardOf(pl, fillStats(before as Record<string, number>));
  const next = cardOf(pl, fillStats(after as Record<string, number>));
  const changed = prev.ovr !== next.ovr || prev.stats.some(([, v], i) => v !== next.stats[i][1]);
  if (!changed) return null;
  return createHonor(db, {
    pl: { ...pl, stats: after }, kind: 'stats', by: ctx.user.id,
    title: `Chỉ số mới · OVR ${prev.ovr} → ${next.ovr}`,
    card: { ...next, prevOvr: prev.ovr, prevStats: prev.stats },
  });
}

const giveSchema = z.object({
  playerId: z.string().min(1),
  title: z.string().trim().min(2, 'Nhập danh hiệu').max(48),
  note: z.string().trim().max(160).optional().nullable(),
});

/** ĐT vinh danh một người bất kỳ kèm lời khen. */
export async function giveHonor(ctx: Ctx, raw: unknown) {
  requireManager(ctx);
  const p = giveSchema.safeParse(raw);
  if (!p.success) throw invalid(zodMessage(p.error));
  const pl = await prisma.player.findFirst({ where: { id: p.data.playerId, teamId: ctx.teamId, status: 'active' } });
  if (!pl) throw notFound('Không tìm thấy cầu thủ');
  return prisma.$transaction(async (tx) => {
    const h = await createHonor(tx, { pl, kind: 'captain', title: p.data.title, note: p.data.note || null, by: ctx.user.id });
    await audit(tx, ctx, 'honor.give', 'honor', h!.id, null, p.data);
    return h!;
  });
}

export async function removeHonor(ctx: Ctx, honorId: string) {
  requireManager(ctx);
  const h = await prisma.honor.findFirst({ where: { id: honorId, teamId: ctx.teamId } });
  if (!h) throw notFound('Không tìm thấy lần vinh danh');
  if (h.kind !== 'captain' && h.kind !== 'stats') throw invalid('Vinh danh tự động không xoá được');
  await prisma.honor.delete({ where: { id: h.id } });
  await audit(prisma, ctx, 'honor.remove', 'honor', h.id, h, null);
}

/** Đánh dấu đã mở thẻ (popup không hiện lại). */
export async function markHonorSeen(ctx: Ctx, honorId: string) {
  if (ctx.role === 'guest') throw forbidden('Chỉ thành viên đội');
  const h = await prisma.honor.findFirst({ where: { id: honorId, teamId: ctx.teamId }, select: { id: true } });
  if (!h) throw notFound('Không tìm thấy lần vinh danh');
  await prisma.honorView.upsert({ where: { honorId_userId: { honorId, userId: ctx.user.id } }, create: { honorId, userId: ctx.user.id, seenAt: ctx.now }, update: {} });
}

export interface HonorDTO {
  id: string;
  kind: HonorKind;
  title: string;
  note: string | null;
  createdAt: string;
  playerId: string;
  card: CardSnapshot;
  seen: boolean;
  mine: boolean;
}

const POPUP_DAYS = 30;

const toDTO = (h: { id: string; kind: string; title: string; note: string | null; createdAt: Date; playerId: string; card: unknown; views?: Array<{ userId: string }>; player: { userId: string | null } }, userId: string): HonorDTO => ({
  id: h.id, kind: h.kind as HonorKind, title: h.title, note: h.note, createdAt: h.createdAt.toISOString(), playerId: h.playerId,
  card: h.card as CardSnapshot, seen: !!h.views?.length, mine: h.player.userId === userId,
});

/** Thẻ cần tự mở cho chính người được vinh danh / lên chỉ số (popup ở mọi tab). */
export async function myHonorPopup(ctx: Ctx): Promise<HonorDTO | null> {
  if (!ctx.playerId) return null;
  const h = await prisma.honor.findFirst({
    where: { teamId: ctx.teamId, player: { userId: ctx.user.id }, createdAt: { gte: new Date(ctx.now.getTime() - POPUP_DAYS * 864e5) }, views: { none: { userId: ctx.user.id } } },
    include: { player: { select: { userId: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return h ? toDTO(h, ctx.user.id) : null;
}

/** Dữ liệu tab Vinh danh (công khai như Thống kê). */
export async function honorsView(ctx: Ctx) {
  const insider = ctx.role !== 'guest';
  const rows = await prisma.honor.findMany({
    where: { teamId: ctx.teamId },
    include: { player: { select: { userId: true, status: true } }, views: { where: { userId: ctx.user.id }, select: { userId: true } } },
    orderBy: { createdAt: 'desc' },
    take: 120,
  });
  const honors = rows.map((h) => toDTO(h, ctx.user.id));
  // Bảng vàng: số lần vinh danh theo người (không tính thẻ lên chỉ số)
  const fame = new Map<string, { playerId: string; total: number; kinds: Partial<Record<HonorKind, number>>; card: CardSnapshot }>();
  for (const h of honors) {
    if (h.kind === 'stats') continue;
    const f = fame.get(h.playerId) ?? { playerId: h.playerId, total: 0, kinds: {}, card: h.card };
    f.total++;
    f.kinds[h.kind] = (f.kinds[h.kind] ?? 0) + 1;
    fame.set(h.playerId, f);
  }
  const recent = new Date(ctx.now.getTime() - POPUP_DAYS * 864e5);
  return {
    canEdit: canManage(ctx.role),
    honors,
    fame: [...fame.values()].sort((a, b) => b.total - a.total || b.card.ovr - a.card.ovr),
    /** thẻ mới người xem chưa mở — tab tự mở lần lượt */
    unseen: insider ? honors.filter((h) => !h.seen && (h.kind !== 'stats' || h.mine) && new Date(h.createdAt) >= recent).map((h) => h.id).reverse() : [],
  };
}

export type HonorsData = Awaited<ReturnType<typeof honorsView>>;
