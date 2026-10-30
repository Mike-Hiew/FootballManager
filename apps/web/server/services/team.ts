import { z } from 'zod';
import { prisma, type Prisma } from '@san7/db';
import {
  autoPick, dateSchema, footSchema, foldText, imageUrlSchema, inferStats, isSafeUrl, moneySchema, normName, parseRules,
  ratingsSchema, teamNameSchema, timeSchema, teamSeason, seasonYear, type SeasonMatch,
} from '@san7/core';
import { inviteCode } from '../auth/tokens';
import { audit } from '../audit';
import { type Ctx, requireManager } from '../authz';
import type { SessionUser } from '../auth/session';
import { conflict, invalid, isUniqueViolation, notFound, zodMessage } from '../errors';
import { now } from '../clock';
import { toSeasonMatch } from './mappers';

const urlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((u) => !u || /^https:\/\//i.test(u), 'Link bản đồ phải bắt đầu bằng https://')
  .optional()
  .nullable();

export const teamInfoSchema = z.object({
  name: teamNameSchema,
  foundedOn: dateSchema.optional().nullable().or(z.literal('')),
  slogan: z.string().trim().max(80).optional().nullable(),
  photoUrl: imageUrlSchema.optional().nullable().or(z.literal('')),
  awardBootUrl: imageUrlSchema.optional().nullable().or(z.literal('')),
  awardAssistUrl: imageUrlSchema.optional().nullable().or(z.literal('')),
  homeName: z.string().trim().max(50).optional().nullable(),
  homeAddress: z.string().trim().max(80).optional().nullable(),
  homeMapUrl: urlSchema,
  homeDays: z.array(z.number().int().min(0).max(6)).max(7).default([]),
  homeFrom: timeSchema.optional().nullable().or(z.literal('')),
  homeTo: timeSchema.optional().nullable().or(z.literal('')),
  homeCost: moneySchema.default(0),
  rulesText: z.string().max(4000).optional(),
});

export async function isNameTaken(name: string, excludeTeamId?: string): Promise<boolean> {
  const key = normName(name);
  if (!key) return false;
  const t = await prisma.team.findUnique({ where: { nameKey: key }, select: { id: true } });
  return !!t && t.id !== excludeTeamId;
}

const createSchema = teamInfoSchema.extend({
  captainNum: z.number().int().min(0).max(99).optional().nullable(),
  captainFoot: footSchema.default('Phải'),
  captainRatings: ratingsSchema.default({}),
});

const clean = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);

/** Bước 2/2 tạo đội (BRD 3.2). */
export async function createTeam(user: SessionUser, raw: unknown) {
  const p = createSchema.safeParse(raw);
  if (!p.success) throw invalid(zodMessage(p.error));
  const d = p.data;
  if (await isNameTaken(d.name)) throw conflict('Tên đội đã có, hãy chọn tên khác');
  const ratings = Object.keys(d.captainRatings).length ? d.captainRatings : { CB: 6.5 };
  try {
    return await prisma.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: {
          ...teamFields(d),
          nameKey: normName(d.name),
          createdById: user.id,
          captains: { create: [{ userId: user.id }] },
          invites: { create: [{ code: inviteCode() }] },
        },
      });
      const player = await tx.player.create({
        data: {
          teamId: team.id, userId: user.id, fullName: user.name, num: d.captainNum ?? null, foot: d.captainFoot,
          payType: 'quy', isCaptain: true, stats: inferStats(ratings, d.captainFoot), styles: ['Thủ lĩnh'],
        },
      });
      await tx.team.update({ where: { id: team.id }, data: { lineup: autoPick([player as never], team.formation) } });
      return team;
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict('Tên đội đã có, hãy chọn tên khác');
    throw e;
  }
}

function teamFields(d: z.infer<typeof teamInfoSchema>) {
  return {
    name: d.name.trim(),
    foundedOn: clean(d.foundedOn || null),
    slogan: clean(d.slogan),
    homeName: clean(d.homeName),
    homeAddress: clean(d.homeAddress),
    homeMapUrl: d.homeMapUrl && isSafeUrl(d.homeMapUrl) ? d.homeMapUrl.trim() : null,
    homeDays: [...new Set(d.homeDays)].sort(),
    homeFrom: clean(d.homeFrom || null),
    homeTo: clean(d.homeTo || null),
    homeCost: d.homeCost,
    rules: d.rulesText !== undefined ? parseRules(d.rulesText) : [],
  };
}

/** Sửa thông tin đội (ĐT). */
export async function updateTeam(ctx: Ctx, raw: unknown) {
  requireManager(ctx);
  const p = teamInfoSchema.safeParse(raw);
  if (!p.success) throw invalid(zodMessage(p.error));
  if (await isNameTaken(p.data.name, ctx.teamId)) throw conflict('Tên đội đã có, hãy chọn tên khác');
  const before = await prisma.team.findUniqueOrThrow({ where: { id: ctx.teamId } });
  const data: Prisma.TeamUpdateInput = { ...teamFields(p.data), nameKey: normName(p.data.name) };
  for (const k of ['photoUrl', 'awardBootUrl', 'awardAssistUrl'] as const) {
    if (p.data[k] !== undefined) data[k] = p.data[k] || null;
  }
  try {
    const team = await prisma.team.update({ where: { id: ctx.teamId }, data });
    await audit(prisma, ctx, 'team.update', 'team', ctx.teamId, { name: before.name }, { name: team.name });
    return team;
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict('Tên đội đã có, hãy chọn tên khác');
    throw e;
  }
}

/** Tạo link mời mới; mã cũ hết hiệu lực (BRD 3.1). */
export async function rotateInvite(ctx: Ctx) {
  requireManager(ctx);
  return prisma.$transaction(async (tx) => {
    await tx.invite.updateMany({ where: { teamId: ctx.teamId, revokedAt: null }, data: { revokedAt: ctx.now } });
    const inv = await tx.invite.create({ data: { teamId: ctx.teamId, code: inviteCode() } });
    await audit(tx, ctx, 'invite.rotate', 'team', ctx.teamId);
    return inv.code;
  });
}

export async function activeInvite(teamId: string) {
  const inv = await prisma.invite.findFirst({ where: { teamId, revokedAt: null } });
  return inv?.code ?? null;
}

/** Thông tin công khai của link mời (BRD 3.3 bước 1). */
export async function inviteInfo(code: string) {
  const inv = await prisma.invite.findUnique({
    where: { code: code.toLowerCase() },
    include: { team: { select: { id: true, name: true, slogan: true, photoUrl: true, hidden: true, _count: { select: { players: { where: { status: 'active' } } } } } } },
  });
  if (!inv || inv.revokedAt || inv.team.hidden) return null;
  return { code: inv.code, teamId: inv.team.id, name: inv.team.name, slogan: inv.team.slogan, photoUrl: inv.team.photoUrl, members: inv.team._count.players };
}

/** Khám phá: thẻ đội công khai, tìm bỏ dấu (BRD 8.5). */
export async function exploreTeams(q?: string) {
  const at = now();
  const year = seasonYear(at);
  const teams = await prisma.team.findMany({
    where: { hidden: false },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, name: true, nameKey: true, slogan: true, photoUrl: true, homeName: true, foundedOn: true,
      _count: { select: { players: { where: { status: 'active' } } } },
      matches: {
        where: { deletedAt: null, scoreUs: { not: null }, date: { startsWith: String(year) } },
        select: { id: true, date: true, time: true, opponent: true, scoreUs: true, scoreThem: true, mvpPlayerId: true },
      },
    },
  });
  const f = q ? foldText(q) : '';
  return teams
    .filter((t) => !f || foldText(t.name).includes(f) || t.nameKey.includes(normName(f)))
    .map((t) => {
      const s = teamSeason(t.matches.map((m) => toSeasonMatch({ ...m, attendance: [], events: [] })), year);
      return {
        id: t.id, name: t.name, slogan: t.slogan, photoUrl: t.photoUrl, homeName: t.homeName, members: t._count.players,
        record: { w: s.w, d: s.d, l: s.l }, form: s.form.map((x) => x.r),
      };
    });
}

export async function teamExists(teamId: string) {
  const t = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true } });
  if (!t) throw notFound('Không tìm thấy đội');
}

export type { SeasonMatch };
