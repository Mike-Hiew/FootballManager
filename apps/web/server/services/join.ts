import { z } from 'zod';
import { prisma } from '@san7/db';
import {
  dateSchema, footSchema, inferStats, passwordSchema, payTypeSchema, phoneSchema, ratingsSchema, statsSchema, styleSchema,
} from '@san7/core';
import { hashPassword, verifyPassword } from '../auth/password';
import { createSession, type SessionUser } from '../auth/session';
import { type Ctx, requireManager } from '../authz';
import { audit } from '../audit';
import { AppError, conflict, invalid, notFound, zodMessage } from '../errors';
import { captainUserIds, emit } from './notify';

const joinSchema = z.object({
  fullName: z.string().trim().min(1, 'Nhập họ tên').max(60),
  nick: z.string().trim().max(24).optional().nullable(),
  dob: dateSchema.optional().nullable().or(z.literal('')),
  phone: phoneSchema,
  password: z.string().min(1, 'Nhập mật khẩu'),
  num: z.number().int().min(0).max(99).optional().nullable(),
  foot: footSchema,
  payType: payTypeSchema,
  avatarUrl: z.string().max(2000).optional().nullable(),
  styles: z.array(styleSchema).max(14).default([]),
  ratings: ratingsSchema.refine((r) => Object.values(r).some((v) => (v ?? 0) > 0), 'Tự chấm điểm ít nhất một vị trí sở trường'),
});

export const joinPayloadSchema = z.object({
  fullName: z.string().trim().min(1).max(60),
  nick: z.string().trim().max(24).optional().nullable(),
  dob: z.string().optional().nullable(),
  num: z.number().int().min(0).max(99).optional().nullable(),
  foot: footSchema,
  payType: payTypeSchema,
  avatarUrl: z.string().optional().nullable(),
  styles: z.array(styleSchema).default([]),
  ratings: ratingsSchema.optional(),
  stats: statsSchema,
});
export type JoinPayload = z.infer<typeof joinPayloadSchema>;

/** Nộp đơn xin vào đội qua link mời (BRD 3.3). */
export async function submitJoin(code: string, raw: unknown, current: SessionUser | null) {
  const inv = await prisma.invite.findUnique({ where: { code: code.toLowerCase() }, include: { team: true } });
  if (!inv || inv.revokedAt || inv.team.hidden) throw notFound('Link mời không còn hiệu lực, xin link mới từ đội trưởng');
  const p = joinSchema.safeParse(current ? { ...(raw as object), phone: current.phone, password: 'x' } : raw);
  if (!p.success) throw invalid(zodMessage(p.error));
  const d = p.data;
  const teamId = inv.teamId;

  // Tài khoản: đã đăng nhập → dùng luôn; SĐT đã có → xác thực mật khẩu cũ; chưa có → tạo mới.
  let userId: string;
  if (current) userId = current.id;
  else {
    const existing = await prisma.user.findUnique({ where: { phone: d.phone } });
    if (existing) {
      if (!(await verifyPassword(existing.passwordHash, d.password))) {
        throw new AppError(401, 'Số điện thoại đã có tài khoản. Nhập đúng mật khẩu cũ để xác thực.');
      }
      userId = existing.id;
    } else {
      const pw = passwordSchema.safeParse(d.password);
      if (!pw.success) throw invalid(zodMessage(pw.error));
      userId = (await prisma.user.create({ data: { name: d.fullName, phone: d.phone, passwordHash: await hashPassword(d.password) } })).id;
    }
  }

  const [member, pending] = await Promise.all([
    prisma.player.findFirst({ where: { teamId, userId, status: 'active' } }),
    prisma.joinRequest.findFirst({ where: { teamId, phone: d.phone, status: 'pending' } }),
  ]);
  if (member) throw conflict('Bạn đã là thành viên của đội này');
  if (pending) throw conflict('Bạn đã gửi đơn, đang chờ đội trưởng duyệt');

  const payload: JoinPayload = {
    fullName: d.fullName, nick: d.nick || null, dob: d.dob || null, num: d.num ?? null, foot: d.foot, payType: d.payType,
    avatarUrl: d.avatarUrl || null, styles: d.styles, ratings: d.ratings, stats: inferStats(d.ratings, d.foot),
  };
  const req = await prisma.$transaction(async (tx) => {
    const r = await tx.joinRequest.create({ data: { teamId, userId, phone: d.phone, payload } });
    await emit(tx, { kind: 'join', teamId, recipients: await captainUserIds(tx, teamId), actorId: userId, view: 'duyet', text: `${d.fullName} xin vào đội ${inv.team.name}` });
    return r;
  });
  if (!current) await createSession(userId, null);
  return req;
}

/** Duyệt đơn: ĐT có thể sửa mọi trường và chỉ số (BRD 3.3 bước 5–6). */
export async function approveJoin(ctx: Ctx, requestId: string, edited?: unknown) {
  requireManager(ctx);
  const r = await prisma.joinRequest.findFirst({ where: { id: requestId, teamId: ctx.teamId, status: 'pending' }, include: { team: true } });
  if (!r) throw notFound('Đơn không còn chờ duyệt');
  const parsed = joinPayloadSchema.safeParse(edited ?? r.payload);
  if (!parsed.success) throw invalid(zodMessage(parsed.error));
  const d = parsed.data;
  const warnNum =
    d.num != null && (await prisma.player.count({ where: { teamId: ctx.teamId, status: 'active', num: d.num } })) > 0
      ? `Số áo ${d.num} đã có người mặc`
      : null;
  await prisma.$transaction(async (tx) => {
    const data = {
      fullName: d.fullName, nick: d.nick ?? null, dob: d.dob ?? null, num: d.num ?? null, foot: d.foot, payType: d.payType,
      avatarUrl: d.avatarUrl ?? null, styles: d.styles, stats: d.stats, status: 'active', payTypeFrom: null, prevPayType: null,
    };
    await tx.player.upsert({
      where: { teamId_userId: { teamId: ctx.teamId, userId: r.userId } },
      create: { ...data, teamId: ctx.teamId, userId: r.userId },
      update: data,
    });
    await tx.joinRequest.update({ where: { id: r.id }, data: { status: 'approved', payload: d, decidedById: ctx.user.id, decidedAt: ctx.now } });
    await emit(tx, { kind: 'result', teamId: ctx.teamId, recipients: [r.userId], actorId: ctx.user.id, view: 'doi', text: `Bạn đã vào đội ${r.team.name}` });
    await audit(tx, ctx, 'join.approve', 'join_request', r.id, r.payload, d);
  });
  return { warning: warnNum };
}

export async function rejectJoin(ctx: Ctx, requestId: string, reason?: string | null) {
  requireManager(ctx);
  const r = await prisma.joinRequest.findFirst({ where: { id: requestId, teamId: ctx.teamId, status: 'pending' }, include: { team: true } });
  if (!r) throw notFound('Đơn không còn chờ duyệt');
  const why = reason?.trim().slice(0, 200) || null;
  await prisma.$transaction(async (tx) => {
    await tx.joinRequest.update({ where: { id: r.id }, data: { status: 'rejected', reason: why, decidedById: ctx.user.id, decidedAt: ctx.now } });
    await emit(tx, { kind: 'result', teamId: ctx.teamId, recipients: [r.userId], actorId: ctx.user.id, text: `Đơn xin vào ${r.team.name} bị từ chối${why ? ': ' + why : ''}` });
    await audit(tx, ctx, 'join.reject', 'join_request', r.id, null, { reason: why });
  });
}
