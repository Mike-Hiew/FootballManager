import { describe, expect, it } from 'vitest';
import { prisma } from '@san7/db';
import { addMonths, currentMonth } from '@san7/core';
import * as match from '@/server/services/match';
import * as fund from '@/server/services/fund';
import * as payment from '@/server/services/payment';
import { approvals } from '@/server/services/view';
import { CAPTAIN, DOM, ctxFor, expectStatus } from './helpers';

const P3 = '0901000003'; // Nam Sắt — quỹ, chưa đóng tháng trước
const P7 = '0901000007'; // Phong Gió — đá lẻ
const notes = (userId: string, text: string) => prisma.notification.count({ where: { userId, text: { contains: text } } });

describe('Yêu cầu đóng tiền', () => {
  it('quỹ tháng: ĐT yêu cầu → người chưa đóng nhận báo, báo đã đóng → ĐT xác nhận → ghi sổ', async () => {
    const cap = await ctxFor(CAPTAIN, DOM);
    const month = addMonths(currentMonth(cap.now), -1);
    const { id, sent } = await payment.requestDues(cap, { month, note: 'CK cho Tuấn' });
    expect(sent).toBeGreaterThan(0);
    expect(await notes('u-p3', 'Đội trưởng yêu cầu đóng quỹ')).toBe(1);
    expect(await notes('u-p1', 'Đội trưởng yêu cầu đóng quỹ')).toBe(0); // đã đóng

    const p3 = await ctxFor(P3, DOM);
    expect((await payment.myPayments(p3)).find((x) => x.id === id)?.status).toBe('due');
    await payment.declarePaid(p3, id);
    expect((await payment.myPayments(p3)).find((x) => x.id === id)?.status).toBe('pending');
    expect(await notes('u-p2', 'Nam Sắt báo đã đóng')).toBe(1);
    expect((await approvals(cap)).payments.some((n) => n.requestId === id && n.playerId === 'p3')).toBe(true);

    // nhắc lại bỏ qua người đang chờ xác nhận
    const before = await notes('u-p3', 'Nhắc: bạn chưa đóng');
    await payment.remindRequest(cap, id);
    expect(await notes('u-p3', 'Nhắc: bạn chưa đóng')).toBe(before);

    // báo chưa nhận → báo lại được → xác nhận
    await payment.decidePayment(cap, id, 'p3', false);
    expect((await payment.myPayments(p3)).find((x) => x.id === id)?.status).toBe('rejected');
    await payment.declarePaid(p3, id);
    await payment.decidePayment(cap, id, 'p3', true);
    expect(await prisma.duesPayment.count({ where: { teamId: DOM, playerId: 'p3', month } })).toBe(1);
    expect((await payment.myPayments(p3)).some((x) => x.id === id)).toBe(false);
    expect(await notes('u-p3', 'Đội trưởng đã xác nhận bạn đóng')).toBe(1);
    await expectStatus(payment.declarePaid(p3, id), 422);
  });

  it('thành viên không tạo / xác nhận được yêu cầu', async () => {
    const p3 = await ctxFor(P3, DOM);
    await expectStatus(payment.requestDues(p3, { month: currentMonth(p3.now) }), 403);
  });

  it('đá lẻ: cần tỉ số trước; chỉ báo người đá lẻ có Đi; ✓ tay ở tab Quỹ đóng luôn báo đang chờ', async () => {
    const cap = await ctxFor(CAPTAIN, DOM);
    const m = await match.createMatch(cap, { date: '2026-10-03', time: '19:30', opponent: 'Le Test ' + Math.random().toString(36).slice(2, 6), cost: 0 });
    for (const p of ['p7', 'p8', 'p9']) await match.setAttendance(cap, m.id, p, { status: 'di' });
    await expectStatus(payment.requestLe(cap, m.id, { amount: 90000 }), 422);
    await match.saveResult(cap, m.id, { scoreUs: 1, scoreThem: 0, events: [] });

    const { id, sent } = await payment.requestLe(cap, m.id, { amount: 90000 });
    expect(sent).toBe(2); // p7, p8 — p9 đóng quỹ
    expect((await prisma.match.findUniqueOrThrow({ where: { id: m.id } })).fee).toBe(90000);
    expect(await notes('u-p9', 'yêu cầu trả tiền đá lẻ trận vs ' + m.opponent)).toBe(0);
    expect(await notes('u-p7', 'yêu cầu trả tiền đá lẻ trận vs ' + m.opponent)).toBe(1);

    const p7 = await ctxFor(P7, DOM);
    await payment.declarePaid(p7, id);
    await fund.setLePaid(cap, m.id, 'p7', true);
    expect((await prisma.paymentNotice.findUniqueOrThrow({ where: { requestId_playerId: { requestId: id, playerId: 'p7' } } })).status).toBe('confirmed');
    expect((await payment.openRequests(cap)).find((r) => r.id === id)?.owed).toEqual(['p8']);
    const le = await prisma.fundEntry.findFirstOrThrow({ where: { source: 'le', sourceKey: m.id } });
    expect(le.amount).toBe(90000);
  });

  it('job nhắc lại sau 3 ngày, không nhắc trùng', async () => {
    const cap = await ctxFor(CAPTAIN, DOM);
    const month = currentMonth(cap.now);
    const { id } = await payment.requestDues(cap, { month });
    const later = new Date(Date.now() + 3 * 864e5 + 60e3);
    const [a, b] = await Promise.all([payment.autoRemind(later), payment.autoRemind(later)]);
    expect(a + b).toBeGreaterThan(0);
    expect(await payment.autoRemind(later)).toBe(0);
    expect((await prisma.paymentRequest.findUniqueOrThrow({ where: { id } })).remindedAt?.getTime()).toBe(later.getTime());
  });
});
