import { describe, expect, it } from 'vitest';
import { prisma } from '@san7/db';
import * as match from '@/server/services/match';
import * as mvp from '@/server/services/mvp';
import { tick } from '@/server/jobs/tick';
import { CAPTAIN, DOM, ctxFor, expectStatus } from './helpers';

async function setupMatch(goers: string[], ballots: Array<[string, string]>) {
  const cap = await ctxFor(CAPTAIN, DOM);
  const m = await match.createMatch(cap, { date: '2026-10-01', time: '19:30', opponent: 'MVP Test ' + Math.random().toString(36).slice(2, 6), cost: 0 });
  for (const p of goers) await match.setAttendance(cap, m.id, p, { status: 'di' });
  await match.saveResult(cap, m.id, { scoreUs: 2, scoreThem: 1, events: [] });
  await mvp.openMvp(cap, m.id);
  await prisma.mvpBallot.createMany({ data: ballots.map(([voterId, candidateId]) => ({ matchId: m.id, voterId, candidateId })) });
  return { cap, m };
}
const later = (h: number) => new Date(Date.now() + h * 3600e3);

describe('Vote MVP (BRD 6.6, 11.1 #10)', () => {
  const seven = ['p1', 'p2', 'p4', 'p5', 'p6', 'p7', 'p9'];

  it('7 người Đi, 5 phiếu, không hoà → tự chốt sau 24 giờ bởi job, chỉ chốt một lần', async () => {
    const { m } = await setupMatch(seven, [['p1', 'p9'], ['p2', 'p9'], ['p4', 'p9'], ['p5', 'p6'], ['p6', 'p9']]);
    expect(await mvp.closeMvpIfDue(m.id, later(23))).toBeNull();
    const [r1, r2] = await Promise.all([tick(later(25)), mvp.closeMvpIfDue(m.id, later(25))]);
    const row = await prisma.match.findUniqueOrThrow({ where: { id: m.id }, include: { mvpVote: true } });
    expect(row.mvpPlayerId).toBe('p9');
    expect(row.mvpVote).toMatchObject({ status: 'done', decidedBy: 'vote' });
    expect(await prisma.notification.count({ where: { matchId: m.id, kind: 'mvp', text: { startsWith: 'MVP trận' } } })).toBe(7);
    expect(r1.locked || r1.mvp >= 0).toBe(true);
    void r2;
    await tick(later(26));
    expect(await prisma.notification.count({ where: { matchId: m.id, kind: 'mvp', text: { startsWith: 'MVP trận' } } })).toBe(7);
  });

  it('4 phiếu → need, ĐT được báo cần chỉ định', async () => {
    const { m } = await setupMatch(seven, [['p1', 'p9'], ['p2', 'p9'], ['p4', 'p9'], ['p5', 'p6']]);
    await tick(later(25));
    const v = await prisma.mvpVote.findUniqueOrThrow({ where: { matchId: m.id } });
    expect(v.status).toBe('need');
    expect(await prisma.notification.count({ where: { matchId: m.id, userId: 'u-p2', text: { contains: 'cần chỉ định' } } })).toBe(1);
  });

  it('hoà phiếu → need; ĐT chỉ định → done by captain', async () => {
    const { m, cap } = await setupMatch(seven, [['p1', 'p9'], ['p2', 'p9'], ['p4', 'p6'], ['p5', 'p6'], ['p6', 'p7']]);
    await mvp.closeMvpIfDue(m.id, later(25));
    expect((await prisma.mvpVote.findUniqueOrThrow({ where: { matchId: m.id } })).status).toBe('need');
    await mvp.assignMvp(cap, m.id, 'p6');
    const row = await prisma.match.findUniqueOrThrow({ where: { id: m.id }, include: { mvpVote: true } });
    expect(row.mvpPlayerId).toBe('p6');
    expect(row.mvpVote?.decidedBy).toBe('captain');
  });

  it('không tự bầu; chỉ người Đi được bỏ phiếu', async () => {
    const { m } = await setupMatch(['p1', 'p2', 'p9'], []);
    const quang = await ctxFor('0901000009', DOM);
    await expectStatus(mvp.castBallot(quang, m.id, 'p9'), 422);
    await mvp.castBallot(quang, m.id, 'p1');
    await mvp.castBallot(quang, m.id, 'p2'); // đổi phiếu
    expect((await prisma.mvpBallot.findUniqueOrThrow({ where: { matchId_voterId: { matchId: m.id, voterId: 'p9' } } })).candidateId).toBe('p2');
    const son = await ctxFor('0901000010', DOM); // p10 không đi
    await expectStatus(mvp.castBallot(son, m.id, 'p1'), 403);
  });
});
