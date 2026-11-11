import { describe, expect, it } from 'vitest';
import { prisma } from '@san7/db';
import { seasonTable, teamSeason } from '@san7/core';
import * as match from '@/server/services/match';
import * as internal from '@/server/services/internal';
import * as fund from '@/server/services/fund';
import * as payment from '@/server/services/payment';
import { toSeasonMatch } from '@/server/services/mappers';
import { teamView } from '@/server/services/view';
import { CAPTAIN, DOM, MEMBER, ctxFor, expectStatus } from './helpers';

const GOERS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10'];

async function setup() {
  const cap = await ctxFor(CAPTAIN, DOM);
  const m = await match.createMatch(cap, { date: '2026-10-05', time: '19:30', opponent: 'Nội bộ', type: 'Nội bộ', cost: 600000 });
  for (const id of GOERS) await match.setAttendance(cap, m.id, id, { status: 'di' });
  await match.setAttendance(cap, m.id, 'p11', { status: 'nghi' });
  return { cap, m };
}

const entry = (matchId: string, source: string) => prisma.fundEntry.findFirst({ where: { teamId: DOM, source, sourceKey: matchId } });

describe('Đá nội bộ (BRD 15)', () => {
  it('chia ngẫu nhiên cân bằng: chỉ người Đi, đủ người, quân số lệch ≤ 1; thành viên không chia được', async () => {
    const { cap, m } = await setup();
    const s = await internal.shuffleSides(cap, m.id);
    expect([...s.a, ...s.b].sort()).toEqual([...GOERS].sort());
    expect(Math.abs(s.a.length - s.b.length)).toBeLessThanOrEqual(1);
    await expectStatus(internal.shuffleSides(await ctxFor(MEMBER, DOM), m.id), 403);

    // sửa tay: không nhận người không Đi / trùng
    await expectStatus(internal.setSides(cap, m.id, { a: [...s.a, 'p11'], b: s.b }), 422);
    await expectStatus(internal.setSides(cap, m.id, { a: [...s.a, s.b[0]], b: s.b }), 422);
    await internal.setSides(cap, m.id, { a: [...s.a, s.b[0]], b: s.b.slice(1) });

    // người đổi sang Nghỉ thì rời đội
    const gone = s.b[1];
    await match.setAttendance(cap, m.id, gone, { status: 'nghi' });
    const v = await teamView(cap);
    const dto = v.matches.find((x) => x.id === m.id)!;
    expect([...dto.sides!.a, ...dto.sides!.b]).not.toContain(gone);

    // ĐT tự xếp 2 người → chia nốt: giữ nguyên 2 người đó
    await internal.setSides(cap, m.id, { a: ['p1'], b: ['p2'] });
    const kept = await internal.shuffleSides(cap, m.id, { keep: true });
    expect(kept.a).toContain('p1');
    expect(kept.b).toContain('p2');
    expect(kept.a.length + kept.b.length).toBe(GOERS.length - 1);

    // trận thường không có chia đội
    await expectStatus(internal.shuffleSides(cap, 'm5'), 422);
  });

  it('chia tiền: tiền sân + nước, lôi chia đều cho mọi người Đi (kể cả người quỹ), ĐT sửa phần riêng → sổ quỹ', async () => {
    const { cap, m } = await setup();
    await internal.setSplit(cap, m.id, { items: [{ label: 'Nước', amount: 100000 }, { label: 'Lôi', amount: 300000 }] });
    // (600k + 400k) / 10 = 100k
    let dto = (await teamView(cap)).matches.find((x) => x.id === m.id)!;
    expect(dto.splitItems).toEqual([{ label: 'Nước', amount: 100000 }, { label: 'Lôi', amount: 300000 }]);
    expect(dto.attendance.p1.share).toBe(100000);
    expect(dto.attendance.p11.share).toBeUndefined();
    expect((await entry(m.id, 'extra'))?.amount).toBe(-400000);

    // ĐT sửa: p9 chịu lôi nhiều hơn
    await internal.setSplit(cap, m.id, { items: [{ label: 'Nước', amount: 100000 }, { label: 'Lôi', amount: 300000 }], shares: { p9: 250000 } });
    dto = (await teamView(cap)).matches.find((x) => x.id === m.id)!;
    expect(dto.attendance.p9).toMatchObject({ share: 250000, shareSet: true });
    expect(dto.attendance.p1).toMatchObject({ share: 100000, shareSet: false });
    await expectStatus(internal.setSplit(cap, m.id, { items: [], shares: { p11: 1000 } }), 422);

    // người quỹ (p1) cũng trả; sổ thu = tổng phần đã trả
    await fund.setLePaid(cap, m.id, 'p1', true);
    await fund.setLePaid(cap, m.id, 'p9', true);
    const le = await entry(m.id, 'le');
    expect(le?.amount).toBe(350000);
    expect(le?.note).toContain('2/10');

    // yêu cầu trả tiền: mỗi người nhận đúng phần của mình
    const { id } = await payment.requestLe(cap, m.id, { amount: 100000 });
    const me = await payment.myPayments(await ctxFor('0901000003', DOM)); // p3 (quỹ)
    expect(me.find((x) => x.id === id)).toMatchObject({ amount: 100000, label: expect.stringContaining('đá nội bộ') });
    expect(await prisma.notification.count({ where: { userId: 'u-p3', text: { contains: 'đá nội bộ' } } })).toBe(1);

    // bảng tiền từng trận
    const fv = await fund.fundView(cap);
    const row = fv.matchMoney.find((x) => x.id === m.id);
    expect(row).toMatchObject({ internal: true, cost: 1000000, lePaid: 2, leTotal: 10, got: 350000 });
  });

  it('thống kê: bàn / kiến tạo tính vào cá nhân, nhưng không tính thắng/thua của đội', async () => {
    const { cap, m } = await setup();
    const before = await prisma.match.findMany({ where: { teamId: DOM, deletedAt: null }, include: { attendance: true, events: true } });
    const year = 2026;
    const t0 = teamSeason(before.map(toSeasonMatch), year);
    const p9g0 = seasonTable(before.map(toSeasonMatch), year, ['p9'])[0].goals;
    await match.saveResult(cap, m.id, { scoreUs: 5, scoreThem: 2, events: [{ playerId: 'p9', goals: 3, assists: 0 }] });
    const after = await prisma.match.findMany({ where: { teamId: DOM, deletedAt: null }, include: { attendance: true, events: true } });
    const t1 = teamSeason(after.map(toSeasonMatch), year);
    expect(t1).toEqual(t0);
    expect(seasonTable(after.map(toSeasonMatch), year, ['p9'])[0].goals).toBe(p9g0 + 3);
  });
});
