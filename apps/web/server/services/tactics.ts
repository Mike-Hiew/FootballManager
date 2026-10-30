import { z } from 'zod';
import { prisma } from '@san7/db';
import { PLAN_PERIODS, cleanLineup, formationSchema } from '@san7/core';
import { type Ctx, requireManager } from '../authz';
import { invalid } from '../errors';
import { getMatch } from './match';

const lineupInput = z.object({ formation: formationSchema, lineup: z.array(z.string().nullable()).max(7) });

/** Lưu chiến thuật tổng (ở đội) hoặc đội hình trận tới (ở trận) — BRD 5. */
export async function saveLineup(ctx: Ctx, raw: unknown, matchId?: string | null) {
  requireManager(ctx);
  const p = lineupInput.safeParse(raw);
  if (!p.success) throw invalid('Đội hình không hợp lệ');
  const ids = (await prisma.player.findMany({ where: { teamId: ctx.teamId, status: 'active' }, select: { id: true } })).map((x) => x.id);
  const lineup = cleanLineup(p.data.lineup, ids);
  if (matchId) {
    await getMatch(ctx, matchId);
    await prisma.match.update({ where: { id: matchId }, data: { formation: p.data.formation, lineup } });
  } else {
    await prisma.team.update({ where: { id: ctx.teamId }, data: { formation: p.data.formation, lineup } });
  }
  return lineup;
}

const planInput = z.object({
  minutes: z.number().int().min(20).max(120),
  periods: z.number().int().refine((v) => (PLAN_PERIODS as readonly number[]).includes(v), 'Số đợt không hợp lệ'),
  min: z.number().int().min(1).max(6).nullable(),
});

/** Tham số kế hoạch thay người lưu theo đội. */
export async function savePlanConfig(ctx: Ctx, raw: unknown) {
  requireManager(ctx);
  const p = planInput.safeParse(raw);
  if (!p.success) throw invalid('Tham số không hợp lệ');
  await prisma.team.update({ where: { id: ctx.teamId }, data: { planMinutes: p.data.minutes, planPeriods: p.data.periods, planMin: p.data.min } });
}
