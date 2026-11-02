import { describe, expect, it } from 'vitest';
import { prisma } from '@san7/db';
import { cardTier, inferStats } from '@san7/core';
import * as honors from '@/server/services/honors';
import * as player from '@/server/services/player';
import { teamView } from '@/server/services/view';
import { CAPTAIN, DOM, MEMBER, OTHER_CAPTAIN, PH, ctxFor, expectStatus } from './helpers';

const P5 = '0901000005';
const notes = (userId: string, text: string) => prisma.notification.count({ where: { userId, text: { contains: text } } });

describe('Vinh danh (BRD 13)', () => {
  it('hạng thẻ: Đom Đóm ≥85 · Vàng 75–84 · Bạc <75', () => {
    expect([cardTier(85), cardTier(84), cardTier(75), cardTier(74)]).toEqual(['dd', 'gold', 'gold', 'silver']);
  });

  it('tab Vinh danh: dữ liệu mẫu đã xem, bảng vàng; khách xem được nhưng không có thẻ "mới"', async () => {
    const v = await honors.honorsView(await ctxFor(MEMBER, DOM));
    expect(v.honors.length).toBeGreaterThanOrEqual(5);
    expect(v.unseen).toEqual([]);
    expect(v.fame[0].total).toBeGreaterThanOrEqual(1);
    expect(v.honors.find((h) => h.kind === 'top_scorer')?.card).toMatchObject({ name: 'Quang Còi', stats: expect.any(Array) });
    const guest = await honors.honorsView(await ctxFor(OTHER_CAPTAIN, DOM));
    expect(guest.honors.length).toBe(v.honors.length);
    expect(guest.canEdit).toBe(false);
    expect((await teamView(await ctxFor(MEMBER, DOM))).honorPopup).toBeNull();
  });

  it('ĐT vinh danh → cả đội được báo, người được vinh danh tự mở thẻ một lần; thành viên không vinh danh được', async () => {
    const cap = await ctxFor(CAPTAIN, DOM);
    const h = await honors.giveHonor(cap, { playerId: 'p9', title: 'Chiến binh của trận', note: 'Chạy không biết mệt' });
    expect(await notes('u-p9', 'Bạn được vinh danh: Chiến binh của trận')).toBe(1);
    expect(await notes('u-p6', 'Vinh danh Quang Còi: Chiến binh của trận')).toBe(1);
    const me = await ctxFor(MEMBER, DOM);
    expect((await teamView(me)).honorPopup).toMatchObject({ id: h.id, title: 'Chiến binh của trận', mine: true });
    // đồng đội: không popup ở mọi tab, nhưng tab Vinh danh tự mở
    expect((await teamView(await ctxFor(P5, DOM))).honorPopup).toBeNull();
    expect((await honors.honorsView(await ctxFor(P5, DOM))).unseen).toContain(h.id);
    await honors.markHonorSeen(me, h.id);
    expect((await teamView(me)).honorPopup).toBeNull();
    await expectStatus(honors.giveHonor(me, { playerId: 'p5', title: 'Hay' }), 403);
    await expectStatus(honors.giveHonor(cap, { playerId: 'q4', title: 'Hay' }), 404);
    await expectStatus(honors.markHonorSeen(await ctxFor(OTHER_CAPTAIN, DOM), h.id), 403);
  });

  it('chỉ số mới (ĐT sửa) → thẻ "lên chỉ số" cho người đó, cả đội được báo; không đổi chỉ số thì không tạo', async () => {
    const cap = await ctxFor(CAPTAIN, DOM);
    const p = await prisma.player.findUniqueOrThrow({ where: { id: 'p5' } });
    const base = { fullName: p.fullName, nick: p.nick, foot: p.foot, styles: p.styles, payType: 'quy' };
    await player.updatePlayer(cap, 'p5', { ...base, stats: p.stats });
    expect(await prisma.honor.count({ where: { playerId: 'p5', kind: 'stats' } })).toBe(0);
    await player.updatePlayer(cap, 'p5', { ...base, stats: inferStats({ CM: 9.5 }, p.foot) });
    const h = await prisma.honor.findFirstOrThrow({ where: { playerId: 'p5', kind: 'stats' } });
    const card = h.card as { ovr: number; prevOvr: number; prevStats: unknown[] };
    expect(card.prevOvr).toBeLessThan(card.ovr);
    expect(card.prevStats).toHaveLength(6);
    expect(h.title).toBe(`Chỉ số mới · OVR ${card.prevOvr} → ${card.ovr}`);
    expect(await notes('u-p5', 'Chỉ số của bạn vừa được cập nhật')).toBe(1);
    expect(await notes('u-p9', 'Long Nhạc Trưởng vừa lên thẻ mới')).toBe(1);
    expect((await teamView(await ctxFor(P5, DOM))).honorPopup).toMatchObject({ kind: 'stats', mine: true });
    // thẻ chỉ số của người khác không tự mở ở tab Vinh danh
    expect((await honors.honorsView(await ctxFor(MEMBER, DOM))).unseen).not.toContain(h.id);
  });

  it('tự vinh danh MVP trận & danh hiệu tháng sau mốc honorsFrom, không trùng; vinh danh tự động không gỡ được', async () => {
    const before = await prisma.honor.count({ where: { teamId: PH } });
    await honors.syncHonors(PH, new Date());
    expect(await prisma.honor.count({ where: { teamId: PH } })).toBe(before); // dữ liệu trước mốc → không tràn
    await prisma.team.update({ where: { id: PH }, data: { honorsFrom: new Date(Date.now() - 90 * 864e5) } });
    await honors.syncHonors(PH, new Date());
    const mvp = await prisma.honor.findMany({ where: { teamId: PH, kind: 'mvp' } });
    const withMvp = await prisma.match.count({ where: { teamId: PH, mvpPlayerId: { not: null }, deletedAt: null } });
    expect(mvp).toHaveLength(withMvp);
    expect(await notes('u-q1', 'Vinh danh')).toBeGreaterThan(0);
    const n = await prisma.honor.count({ where: { teamId: PH } });
    await honors.syncHonors(PH, new Date());
    expect(await prisma.honor.count({ where: { teamId: PH } })).toBe(n);
    await expectStatus(honors.removeHonor(await ctxFor(OTHER_CAPTAIN, PH), mvp[0].id), 422);
    const g = await honors.giveHonor(await ctxFor(OTHER_CAPTAIN, PH), { playerId: 'q4', title: 'Cầu thủ của tháng' });
    await honors.removeHonor(await ctxFor(OTHER_CAPTAIN, PH), g.id);
    expect(await prisma.honor.count({ where: { id: g.id } })).toBe(0);
  });
});
