import { z } from 'zod';
import { prisma, type Db } from '@san7/db';
import {
  currentMonth, dateSchema, duesAmount, monthLabel, moneySchema, outstanding, sortLedger, todayVN,
} from '@san7/core';
import { type Ctx, requireInsider, requireManager } from '../authz';
import { audit } from '../audit';
import { invalid, notFound, zodMessage } from '../errors';
import { effectivePayType } from './player';
import { randomUUID } from 'node:crypto';

/**
 * Sổ quỹ có khoá nguồn (ARCHITECTURE 6.4): mọi khoản tự sinh là một dòng fund_entries
 * UNIQUE(team_id, source, source_key); sửa dữ liệu gốc chỉ cập nhật đúng dòng đó.
 */
async function upsertEntry(db: Db, teamId: string, source: 'dues' | 'pitch' | 'le', sourceKey: string, date: string, amount: number, note: string) {
  if (!amount) {
    await db.fundEntry.deleteMany({ where: { teamId, source, sourceKey } });
    return;
  }
  await db.fundEntry.upsert({
    where: { teamId_source_sourceKey: { teamId, source, sourceKey } },
    create: { teamId, source, sourceKey, date, amount, note },
    update: { date, amount, note },
  });
}

const settled = (m: { scoreUs: number | null; date: string }, now: Date) => m.scoreUs != null || m.date < todayVN(now);

/** Tiền sân: ghi khi trận đã qua (job) hoặc khi sửa cost; xoá khi trận bị xoá. */
export async function syncPitch(db: Db, matchId: string, now: Date) {
  const m = await db.match.findUnique({ where: { id: matchId } });
  if (!m) return;
  const amount = !m.deletedAt && settled(m, now) ? -m.cost : 0;
  await upsertEntry(db, m.teamId, 'pitch', m.id, m.date, amount, `Tiền sân vs ${m.opponent}`);
}

/** Đá lẻ: số người đã trả × match.fee. */
export async function syncLe(db: Db, matchId: string) {
  const m = await db.match.findUnique({ where: { id: matchId } });
  if (!m) return;
  const paid = m.deletedAt ? 0 : await db.attendance.count({ where: { matchId, lePaid: true } });
  await upsertEntry(db, m.teamId, 'le', m.id, m.date, paid * m.fee, `Đá lẻ vs ${m.opponent} · ${paid} người`);
}

/** Quỹ tháng: Σ số tiền đã đóng của tháng, ghi ngày 01. */
export async function syncDues(db: Db, teamId: string, month: string) {
  const pays = await db.duesPayment.findMany({ where: { teamId, month } });
  await upsertEntry(db, teamId, 'dues', month, `${month}-01`, duesAmount(pays), `Quỹ ${monthLabel(month)} · ${pays.length} người`);
}

const feesSchema = z.object({ monthlyFee: moneySchema, perMatchFee: moneySchema });

/** Đổi mức đóng; đá lẻ chỉ áp dụng cho trận tạo sau (match.fee đã chốt). */
export async function setFees(ctx: Ctx, raw: unknown) {
  requireManager(ctx);
  const p = feesSchema.safeParse(raw);
  if (!p.success) throw invalid(zodMessage(p.error));
  const before = await prisma.team.findUniqueOrThrow({ where: { id: ctx.teamId }, select: { monthlyFee: true, perMatchFee: true } });
  await prisma.team.update({ where: { id: ctx.teamId }, data: p.data });
  await audit(prisma, ctx, 'fund.fees', 'team', ctx.teamId, before, p.data);
}

export async function setDuesReminder(ctx: Ctx, on: boolean) {
  requireManager(ctx);
  await prisma.team.update({ where: { id: ctx.teamId }, data: { duesReminder: on } });
}

/** Bật/tắt ✓ đã đóng quỹ tháng (chỉ ĐT). Lưu số tiền tại lúc đóng. */
export async function setDues(ctx: Ctx, month: string, playerId: string, paid: boolean) {
  requireManager(ctx);
  if (!/^\d{4}-\d{2}$/.test(month)) throw invalid('Tháng không hợp lệ');
  const [team, player] = await Promise.all([
    prisma.team.findUniqueOrThrow({ where: { id: ctx.teamId }, select: { monthlyFee: true } }),
    prisma.player.findFirst({ where: { id: playerId, teamId: ctx.teamId } }),
  ]);
  if (!player) throw notFound('Không tìm thấy cầu thủ');
  if (paid && effectivePayType(player, month) !== 'quy') throw invalid('Người này không đóng quỹ tháng trong tháng đó');
  await prisma.$transaction(async (tx) => {
    if (paid) {
      await tx.duesPayment.upsert({
        where: { teamId_playerId_month: { teamId: ctx.teamId, playerId, month } },
        create: { teamId: ctx.teamId, playerId, month, amount: team.monthlyFee },
        update: {},
      });
    } else await tx.duesPayment.deleteMany({ where: { teamId: ctx.teamId, playerId, month } });
    await syncDues(tx, ctx.teamId, month);
  });
}

/** Đánh dấu đã trả đá lẻ: chỉ người đá lẻ có trạng thái Đi (BRD 7.4). */
export async function setLePaid(ctx: Ctx, matchId: string, playerId: string, paid: boolean) {
  requireManager(ctx);
  const m = await prisma.match.findFirst({ where: { id: matchId, teamId: ctx.teamId, deletedAt: null } });
  if (!m) throw notFound('Không tìm thấy trận');
  const [a, player] = await Promise.all([
    prisma.attendance.findUnique({ where: { matchId_playerId: { matchId, playerId } } }),
    prisma.player.findFirst({ where: { id: playerId, teamId: ctx.teamId } }),
  ]);
  if (!player || effectivePayType(player, m.date.slice(0, 7)) !== 'le') throw invalid('Chỉ người đá lẻ mới cần trả tiền trận');
  if (!a || a.status !== 'di') throw invalid('Người này chưa điểm danh Đi trận này');
  await prisma.$transaction(async (tx) => {
    await tx.attendance.update({ where: { matchId_playerId: { matchId, playerId } }, data: { lePaid: paid } });
    await syncLe(tx, matchId);
  });
}

const manualSchema = z.object({
  kind: z.enum(['in', 'out']),
  amount: z.number().int().positive('Nhập số tiền').max(1_000_000_000),
  date: dateSchema,
  note: z.string().trim().min(1, 'Nhập nội dung').max(80),
});

export async function addManualEntry(ctx: Ctx, raw: unknown) {
  requireManager(ctx);
  const p = manualSchema.safeParse(raw);
  if (!p.success) throw invalid(zodMessage(p.error));
  const d = p.data;
  const e = await prisma.fundEntry.create({
    data: {
      teamId: ctx.teamId, date: d.date, amount: d.kind === 'in' ? d.amount : -d.amount, note: d.note,
      source: 'manual', sourceKey: randomUUID(), createdById: ctx.user.id,
    },
  });
  await audit(prisma, ctx, 'fund.add', 'fund_entry', e.id, null, e);
  return e;
}

/** Chỉ khoản ghi tay xoá được; xoá mềm + nhật ký người xoá (BRD 7.2). */
export async function deleteManualEntry(ctx: Ctx, entryId: string) {
  requireManager(ctx);
  const e = await prisma.fundEntry.findFirst({ where: { id: entryId, teamId: ctx.teamId, deletedAt: null } });
  if (!e) throw notFound('Không tìm thấy khoản thu chi');
  if (e.source !== 'manual') throw invalid('Khoản tự sinh không xoá tay được');
  await prisma.fundEntry.update({ where: { id: e.id }, data: { deletedAt: ctx.now, deletedById: ctx.user.id } });
  await audit(prisma, ctx, 'fund.delete', 'fund_entry', e.id, e, null);
}

/** Dữ liệu tab Quỹ (thành viên xem chỉ đọc, khách không thấy). */
export async function fundView(ctx: Ctx) {
  requireInsider(ctx);
  const month = currentMonth(ctx.now);
  const today = todayVN(ctx.now);
  const [team, entries, dues, players, matches] = await Promise.all([
    prisma.team.findUniqueOrThrow({ where: { id: ctx.teamId }, select: { monthlyFee: true, perMatchFee: true, duesReminder: true } }),
    prisma.fundEntry.findMany({ where: { teamId: ctx.teamId, deletedAt: null } }),
    prisma.duesPayment.findMany({ where: { teamId: ctx.teamId } }),
    prisma.player.findMany({ where: { teamId: ctx.teamId, status: 'active' } }),
    prisma.match.findMany({
      where: { teamId: ctx.teamId, deletedAt: null, OR: [{ scoreUs: { not: null } }, { date: { lt: today } }] },
      include: { attendance: true },
      orderBy: [{ date: 'desc' }, { time: 'desc' }],
    }),
  ]);
  const paidNow = new Set(dues.filter((d) => d.month === month).map((d) => d.playerId));
  const quyIds = players.filter((p) => effectivePayType(p, month) === 'quy').map((p) => p.id);
  const leTurns = matches.flatMap((m) =>
    m.attendance
      .filter((a) => a.status === 'di' && players.some((p) => p.id === a.playerId && effectivePayType(p, m.date.slice(0, 7)) === 'le'))
      .map((a) => ({ playerId: a.playerId, matchId: m.id, fee: m.fee, paid: a.lePaid })),
  );
  return {
    ...team,
    month,
    entries: sortLedger(entries).map((e) => ({ id: e.id, date: e.date, amount: e.amount, source: e.source, note: e.note })),
    dues: dues.map((d) => ({ playerId: d.playerId, month: d.month, amount: d.amount })),
    debts: outstanding({ month, monthlyFee: team.monthlyFee, quyPlayerIds: quyIds, paidThisMonth: paidNow, leTurns }),
    matchMoney: matches.map((m) => {
      const le = m.attendance.filter((a) => a.status === 'di' && players.some((p) => p.id === a.playerId && effectivePayType(p, m.date.slice(0, 7)) === 'le'));
      const paid = le.filter((a) => a.lePaid).length;
      return { id: m.id, date: m.date, opponent: m.opponent, cost: m.cost, fee: m.fee, lePaid: paid, leTotal: le.length };
    }),
  };
}
