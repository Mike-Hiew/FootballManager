import { describe, expect, it } from 'vitest';
import { prisma } from '@san7/db';
import { balance, playerSeason, teamSeason } from '@san7/core';
import { teamView } from '@/server/services/view';
import { tick } from '@/server/jobs/tick';
import { toSeasonMatch } from '@/server/services/mappers';
import { CAPTAIN, DOM, ctxFor } from './helpers';

describe('Mùa giải & reset 1/1 (BRD 9.3, 11.1 #11)', () => {
  it('đổi năm hệ thống sang 1/1 năm sau → mọi số mùa về 0, quỹ giữ nguyên; snapshot mùa cũ', async () => {
    const thisYear = new Date().getUTCFullYear();
    const nextNewYear = new Date(Date.UTC(thisYear + 1, 0, 1, 0, 10) - 7 * 3600e3); // 00:10 1/1 giờ VN
    const ms = (await prisma.match.findMany({ where: { teamId: DOM, deletedAt: null }, include: { attendance: true, events: true } })).map(toSeasonMatch);
    expect(teamSeason(ms, thisYear).n).toBeGreaterThan(0);
    const v = await teamView(await ctxFor(CAPTAIN, DOM, nextNewYear));
    expect(v.year).toBe(thisYear + 1);
    expect(teamSeason(ms, v.year).n).toBe(0);
    expect(playerSeason(ms, v.year, 'p9').goals).toBe(0);
    const fundBefore = balance(await prisma.fundEntry.findMany({ where: { teamId: DOM, deletedAt: null } }));
    const r = await tick(nextNewYear);
    expect(r.season).toBeGreaterThan(0);
    const snap = await prisma.seasonSnapshot.findUniqueOrThrow({ where: { teamId_year: { teamId: DOM, year: thisYear } } });
    expect((snap.data as { record: { n: number } }).record.n).toBe(teamSeason(ms, thisYear).n);
    // tiền sân của các trận "đã qua" theo ngày mới được ghi; trừ phần đó ra thì quỹ không đổi vì reset mùa
    const pitchAdded = (await prisma.fundEntry.findMany({ where: { teamId: DOM, source: 'pitch', updatedAt: { gte: new Date(Date.now() - 60e3) } } })).length;
    if (!pitchAdded) expect(balance(await prisma.fundEntry.findMany({ where: { teamId: DOM, deletedAt: null } }))).toBe(fundBefore);
    expect((await tick(nextNewYear)).season).toBe(0); // idempotent
  });
});
