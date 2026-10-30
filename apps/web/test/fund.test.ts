import { describe, expect, it } from 'vitest';
import { prisma } from '@san7/db';
import { balance } from '@san7/core';
import * as fund from '@/server/services/fund';
import * as match from '@/server/services/match';
import { CAPTAIN, DOM, MEMBER, ctxFor, expectStatus } from './helpers';

describe('Quỹ (BRD 7, 11.1 #12)', () => {
  it('số dư = quỹ tháng + đá lẻ − tiền sân ± ghi tay', async () => {
    const entries = await prisma.fundEntry.findMany({ where: { teamId: DOM, deletedAt: null } });
    const by = (s: string) => entries.filter((e) => e.source === s).reduce((a, e) => a + e.amount, 0);
    const dues = await prisma.duesPayment.findMany({ where: { teamId: DOM } });
    const matches = await prisma.match.findMany({ where: { teamId: DOM, scoreUs: { not: null } }, include: { attendance: true } });
    expect(by('dues')).toBe(dues.reduce((a, d) => a + d.amount, 0));
    expect(by('pitch')).toBe(-matches.reduce((a, m) => a + m.cost, 0));
    expect(by('le')).toBe(matches.reduce((a, m) => a + m.attendance.filter((x) => x.lePaid).length * m.fee, 0));
    expect(balance(entries)).toBe(by('dues') + by('le') + by('pitch') + by('manual'));
    const v = await fund.fundView(await ctxFor(CAPTAIN, DOM));
    expect(balance(v.entries)).toBe(balance(entries));
  });

  it('"Còn phải thu" liệt kê đúng người nợ', async () => {
    const v = await fund.fundView(await ctxFor(CAPTAIN, DOM));
    // tháng hiện tại: p1,p2,p5,p6,p9 đã đóng → p3,p4,p10 nợ quỹ; p12 nợ đá lẻ trận m4
    expect(new Set(v.debts.dues)).toEqual(new Set(['p3', 'p4', 'p10']));
    expect(v.debts.le.map((x) => x.playerId)).toEqual(['p12']);
    expect(v.debts.total).toBe(3 * 200000 + 80000);
  });

  it('đổi mức đá lẻ không đổi trận cũ; sửa tiền sân chỉ cập nhật đúng dòng sổ', async () => {
    const ctx = await ctxFor(CAPTAIN, DOM);
    await fund.setFees(ctx, { monthlyFee: 200000, perMatchFee: 100000 });
    expect((await prisma.match.findUniqueOrThrow({ where: { id: 'm1' } })).fee).toBe(80000);
    const before = await prisma.fundEntry.findMany({ where: { teamId: DOM, deletedAt: null }, orderBy: { id: 'asc' } });
    const m1 = await prisma.match.findUniqueOrThrow({ where: { id: 'm1' } });
    await match.updateMatch(ctx, 'm1', { date: m1.date, time: m1.time, opponent: m1.opponent, venue: m1.venue, type: m1.type, cost: 750000, fee: m1.fee });
    const after = await prisma.fundEntry.findMany({ where: { teamId: DOM, deletedAt: null }, orderBy: { id: 'asc' } });
    const changed = after.filter((a) => before.find((b) => b.id === a.id)?.amount !== a.amount);
    expect(changed).toHaveLength(1);
    expect(changed[0]).toMatchObject({ source: 'pitch', sourceKey: 'm1', amount: -750000 });
    expect((await prisma.auditLog.count({ where: { action: 'match.update', entityId: 'm1' } })) > 0).toBe(true);
    const c2 = await match.createMatch(ctx, { date: '2099-01-01', opponent: 'Test FC', cost: 0 });
    expect(c2.fee).toBe(100000);
    await fund.setFees(ctx, { monthlyFee: 200000, perMatchFee: 80000 });
  });

  it('chỉ ĐT ghi sổ; khoản tự sinh không xoá tay được; xoá ghi tay là xoá mềm', async () => {
    const member = await ctxFor(MEMBER, DOM);
    await expectStatus(fund.addManualEntry(member, { kind: 'in', amount: 1000, date: '2026-10-01', note: 'x' }), 403);
    const cap = await ctxFor(CAPTAIN, DOM);
    const auto = await prisma.fundEntry.findFirstOrThrow({ where: { teamId: DOM, source: 'pitch' } });
    await expectStatus(fund.deleteManualEntry(cap, auto.id), 422);
    const e = await fund.addManualEntry(cap, { kind: 'in', amount: 20000, date: '2026-10-20', note: 'Phạt đến muộn (Minh)' });
    await fund.deleteManualEntry(cap, e.id);
    const row = await prisma.fundEntry.findUniqueOrThrow({ where: { id: e.id } });
    expect(row.deletedAt).not.toBeNull();
    expect(row.deletedById).toBe(cap.user.id);
  });

  it('đánh dấu đã trả đá lẻ chỉ cho người đá lẻ có Đi; sang Nghỉ thì bỏ đánh dấu', async () => {
    const cap = await ctxFor(CAPTAIN, DOM);
    await expectStatus(fund.setLePaid(cap, 'm4', 'p9', true), 422); // p9 đóng quỹ
    await fund.setLePaid(cap, 'm4', 'p12', true);
    let le = await prisma.fundEntry.findUniqueOrThrow({ where: { teamId_source_sourceKey: { teamId: DOM, source: 'le', sourceKey: 'm4' } } });
    expect(le.amount).toBe(4 * 80000);
    await match.setAttendance(cap, 'm4', 'p12', { status: 'nghi' });
    expect((await prisma.attendance.findUniqueOrThrow({ where: { matchId_playerId: { matchId: 'm4', playerId: 'p12' } } })).lePaid).toBe(false);
    le = await prisma.fundEntry.findUniqueOrThrow({ where: { teamId_source_sourceKey: { teamId: DOM, source: 'le', sourceKey: 'm4' } } });
    expect(le.amount).toBe(3 * 80000);
    await match.setAttendance(cap, 'm4', 'p12', { status: 'di' });
  });
});
