import { describe, expect, it } from 'vitest';
import { prisma } from '@san7/db';
import * as match from '@/server/services/match';
import * as claim from '@/server/services/claim';
import { markResultSeen, postMatch, skipClaim } from '@/server/services/postmatch';
import { CAPTAIN, DOM, MEMBER, OTHER_CAPTAIN, ctxFor } from './helpers';

/** m5 (vs Hoàng Mai Stars) là trận sắp đá trong seed; giả lập "sau giờ đá" bằng ctx.now. */
async function after(hours: number) {
  const m = await prisma.match.findUniqueOrThrow({ where: { id: 'm5' } });
  return new Date(m.kickoffAt.getTime() + hours * 3600e3);
}

describe('Popup tỉ số và nhắc khai báo sau trận (BRD 6.8)', () => {
  it('chưa có tỉ số thì không báo; ĐT nhập tỉ số thì thành viên thấy popup, ĐT thì không', async () => {
    const t = await after(2);
    const me = await ctxFor(MEMBER, DOM, t);
    expect((await postMatch(me)).resultMatchId).not.toBe('m5');
    await prisma.attendance.upsert({
      where: { matchId_playerId: { matchId: 'm5', playerId: 'p9' } },
      create: { matchId: 'm5', playerId: 'p9', status: 'di' },
      update: { status: 'di' },
    });
    await match.saveResult(await ctxFor(CAPTAIN, DOM, t), 'm5', { scoreUs: 3, scoreThem: 1, events: [] });
    expect((await prisma.match.findUniqueOrThrow({ where: { id: 'm5' } })).resultAt).toEqual(t);
    expect(await postMatch(me)).toEqual({ resultMatchId: 'm5', claimMatchIds: ['m5'] });
    expect((await postMatch(await ctxFor(CAPTAIN, DOM, t))).resultMatchId).toBeNull();
  });

  it('chỉ hiện một lần: đã xem thì không hiện lại; sửa tỉ số không bật lại', async () => {
    const t = await after(3);
    const me = await ctxFor(MEMBER, DOM, t);
    await markResultSeen(me, 'm5');
    expect((await postMatch(me)).resultMatchId).toBeNull();
    await match.saveResult(await ctxFor(CAPTAIN, DOM, t), 'm5', { scoreUs: 3, scoreThem: 2, events: [] });
    expect((await postMatch(me)).resultMatchId).toBeNull();
    expect((await prisma.match.findUniqueOrThrow({ where: { id: 'm5' } })).resultAt).toEqual(await after(2));
  });

  it('nhắc khai báo tắt khi bấm "Không có" hoặc khi đã khai báo', async () => {
    const t = await after(4);
    const me = await ctxFor(MEMBER, DOM, t);
    expect((await postMatch(me)).claimMatchIds).toEqual(['m5']);
    await skipClaim(me, 'm5');
    expect((await postMatch(me)).claimMatchIds).toEqual([]);
    await prisma.matchReceipt.update({ where: { matchId_userId: { matchId: 'm5', userId: me.user.id } }, data: { claimSkippedAt: null } });
    expect((await postMatch(me)).claimMatchIds).toEqual(['m5']);
    await claim.submitClaim(me, 'm5', { goals: 1, assists: 0 });
    expect((await postMatch(me)).claimMatchIds).toEqual([]);
  });

  it('không báo cho khách, người vào đội sau trận, hay trận có tỉ số quá 7 ngày', async () => {
    expect(await postMatch(await ctxFor(OTHER_CAPTAIN, DOM, await after(2)))).toEqual({ resultMatchId: null, claimMatchIds: [] });
    const me = await ctxFor(MEMBER, DOM, await after(2));
    await prisma.matchReceipt.deleteMany({ where: { userId: me.user.id } });
    await prisma.player.update({ where: { id: 'p9' }, data: { createdAt: await after(1) } });
    expect((await postMatch(me)).resultMatchId).toBeNull();
    await prisma.player.update({ where: { id: 'p9' }, data: { createdAt: new Date('2020-01-01T00:00:00Z') } });
    expect((await postMatch(me)).resultMatchId).toBe('m5');
    expect(await postMatch(await ctxFor(MEMBER, DOM, await after(2 + 8 * 24)))).toEqual({ resultMatchId: null, claimMatchIds: [] });
  });

  it('xoá tỉ số thì xoá mốc kết quả', async () => {
    const t = await after(5);
    await match.saveResult(await ctxFor(CAPTAIN, DOM, t), 'm5', { scoreUs: null, scoreThem: null, events: [] });
    expect((await prisma.match.findUniqueOrThrow({ where: { id: 'm5' } })).resultAt).toBeNull();
    expect((await postMatch(await ctxFor(MEMBER, DOM, t))).resultMatchId).toBeNull();
  });
});
