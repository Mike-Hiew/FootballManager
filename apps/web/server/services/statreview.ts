import { prisma, type Db } from '@san7/db';
import { averageStats, fillStats, statsSchema, type Stats } from '@san7/core';
import { type Ctx, requireManager } from '../authz';
import { audit } from '../audit';
import { forbidden, invalid, notFound } from '../errors';
import { captainUserIds, emit } from './notify';
import { statsOf } from './mappers';

/**
 * Cả đội chấm chỉ số (BRD 4.7): khi một người tự sửa / vừa vào đội / ĐT yêu cầu, mọi thành viên khác
 * xác nhận hoặc chỉnh. Chỉ số đề xuất = trung bình bản tự khai + phiếu đồng đội; ĐT chốt (sửa được).
 */

const name = (p: { nick: string | null; fullName: string }) => p.nick || p.fullName;

/** Thành viên đang hoạt động có tài khoản, trừ người được chấm — người được mời chấm. */
export async function reviewers(db: Db, teamId: string, subjectId: string) {
  return db.player.findMany({ where: { teamId, status: 'active', userId: { not: null }, id: { not: subjectId } }, select: { id: true, userId: true, nick: true, fullName: true } });
}

/** Báo cả đội chấm một bản cập nhật (gọi trong transaction tạo bản cập nhật). */
export async function announceReview(db: Db, ctx: Ctx, teamId: string, subject: { id: string; nick: string | null; fullName: string }, origin: string) {
  const who = await reviewers(db, teamId, subject.id);
  const text =
    origin === 'join' ? `${name(subject)} vừa vào đội — chấm giúp chỉ số của ${name(subject)}`
    : origin === 'captain' ? `Đội trưởng nhờ cả đội chấm lại chỉ số của ${name(subject)}`
    : `${name(subject)} vừa cập nhật chỉ số — xác nhận hoặc chỉnh giúp`;
  return emit(db, { kind: 'edit', teamId, recipients: who.map((p) => p.userId), actorId: ctx.user.id, view: 'doi', text });
}

/** Thành viên chấm (xác nhận = gửi đúng bản khai). Gửi lại thì ghi đè phiếu cũ. */
export async function castStatVote(ctx: Ctx, editId: string, raw: unknown) {
  if (!ctx.playerId) throw forbidden('Chỉ thành viên đội mới chấm được');
  const p = statsSchema.safeParse(raw);
  if (!p.success) throw invalid('Chỉ số không hợp lệ (1–10, bước 0.5)');
  const e = await prisma.profileEdit.findFirst({ where: { id: editId, teamId: ctx.teamId, status: 'pending' }, select: { id: true, playerId: true } });
  if (!e) throw notFound('Bản chỉ số này đã được chốt hoặc không còn');
  if (e.playerId === ctx.playerId) throw forbidden('Không tự chấm cho mình — bản khai của bạn đã được tính');
  await prisma.statVote.upsert({
    where: { editId_playerId: { editId, playerId: ctx.playerId } },
    create: { editId, playerId: ctx.playerId, stats: p.data },
    update: { stats: p.data },
  });
}

/** ĐT yêu cầu cả đội chấm lại chỉ số một người (không cần người đó tự sửa). */
export async function requestReview(ctx: Ctx, playerId: string) {
  requireManager(ctx);
  const pl = await prisma.player.findFirst({ where: { id: playerId, teamId: ctx.teamId, status: 'active' } });
  if (!pl) throw notFound('Không tìm thấy cầu thủ');
  return prisma.$transaction(async (tx) => {
    const cur = await tx.profileEdit.findFirst({ where: { playerId, status: 'pending' } });
    if (!cur) {
      const payload = { fullName: pl.fullName, nick: pl.nick, dob: pl.dob, num: pl.num, foot: pl.foot, styles: pl.styles, avatarUrl: pl.avatarUrl, stats: statsOf(pl.stats) };
      await tx.profileEdit.create({ data: { teamId: ctx.teamId, playerId, payload, origin: 'captain', remindedAt: ctx.now } });
    } else {
      await tx.profileEdit.update({ where: { id: cur.id }, data: { remindedAt: ctx.now } });
    }
    const sent = await announceReview(tx, ctx, ctx.teamId, pl, 'captain');
    await audit(tx, ctx, 'stats.request_review', 'player', playerId);
    return sent;
  });
}

/** ĐT nhắc chấm: mọi người chưa chấm, hoặc một người cụ thể. Trả về số người được nhắc. */
export async function remindReview(ctx: Ctx, editId: string, voterId?: string | null) {
  requireManager(ctx);
  const e = await prisma.profileEdit.findFirst({ where: { id: editId, teamId: ctx.teamId, status: 'pending' }, include: { player: true, votes: { select: { playerId: true } } } });
  if (!e) throw notFound('Bản chỉ số này đã được chốt hoặc không còn');
  const voted = new Set(e.votes.map((v) => v.playerId));
  const all = await reviewers(prisma, ctx.teamId, e.playerId);
  const targets = all.filter((p) => !voted.has(p.id) && (!voterId || p.id === voterId));
  if (!targets.length) throw invalid(voterId ? 'Người này đã chấm rồi' : 'Mọi người đã chấm');
  return prisma.$transaction(async (tx) => {
    await tx.profileEdit.update({ where: { id: e.id }, data: { remindedAt: ctx.now } });
    return emit(tx, { kind: 'edit', teamId: ctx.teamId, recipients: targets.map((p) => p.userId), actorId: ctx.user.id, view: 'doi', text: `Nhắc: chấm giúp chỉ số của ${name(e.player)}` });
  });
}

/** ĐT nhắc một thành viên tự cập nhật hồ sơ & chỉ số của mình. */
export async function remindUpdateStats(ctx: Ctx, playerId: string) {
  requireManager(ctx);
  const pl = await prisma.player.findFirst({ where: { id: playerId, teamId: ctx.teamId, status: 'active' } });
  if (!pl) throw notFound('Không tìm thấy cầu thủ');
  if (!pl.userId) throw invalid('Cầu thủ này chưa có tài khoản để nhận nhắc');
  return emit(prisma, { kind: 'edit', teamId: ctx.teamId, recipients: [pl.userId], actorId: ctx.user.id, view: 'toi', text: 'Đội trưởng nhờ bạn cập nhật hồ sơ & chỉ số (tab Của tôi)' });
}

export interface ReviewSummary {
  editId: string;
  playerId: string;
  origin: 'self' | 'join' | 'captain';
  proposed: Stats;
  /** trung bình bản khai + phiếu đồng đội — đề xuất cho ĐT chốt */
  average: Stats;
  votes: Array<{ playerId: string; stats: Stats }>;
  /** người được mời chấm mà chưa chấm */
  pending: string[];
  remindedAt: string | null;
}

/** Tổng hợp các bản chỉ số đang chờ của đội (ĐT dùng ở tab Duyệt; thành viên chỉ thấy phần của mình). */
export async function reviewSummaries(teamId: string): Promise<ReviewSummary[]> {
  const [edits, members] = await Promise.all([
    prisma.profileEdit.findMany({ where: { teamId, status: 'pending' }, include: { votes: true }, orderBy: { createdAt: 'asc' } }),
    prisma.player.findMany({ where: { teamId, status: 'active', userId: { not: null } }, select: { id: true } }),
  ]);
  return edits.map((e) => {
    const proposed = fillStats(((e.payload as { stats?: Record<string, number> }).stats) ?? {});
    const votes = e.votes.map((v) => ({ playerId: v.playerId, stats: fillStats(v.stats as Record<string, number>) }));
    const voted = new Set(votes.map((v) => v.playerId));
    return {
      editId: e.id,
      playerId: e.playerId,
      origin: (e.origin as ReviewSummary['origin']) ?? 'self',
      proposed,
      average: averageStats([proposed, ...votes.map((v) => v.stats)]),
      votes,
      pending: members.filter((m) => m.id !== e.playerId && !voted.has(m.id)).map((m) => m.id),
      remindedAt: e.remindedAt?.toISOString() ?? null,
    };
  });
}

/** Báo ĐT khi bản chỉ số mở do vào đội (để ĐT biết có đợt chấm). */
export async function notifyCaptainsReview(db: Db, ctx: Ctx, teamId: string, subject: { nick: string | null; fullName: string }) {
  return emit(db, { kind: 'edit', teamId, recipients: await captainUserIds(db, teamId), actorId: ctx.user.id, view: 'duyet', text: `Cả đội đang chấm chỉ số của ${name(subject)} — chốt ở tab Duyệt` });
}
