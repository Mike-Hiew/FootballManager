import { describe, expect, it } from 'vitest';
import { prisma } from '@san7/db';
import { emit, markRemindersSeen, pendingReminders } from '@/server/services/notify';
import { remindUpdateStats } from '@/server/services/statreview';
import * as transfer from '@/server/services/transfer';
import * as payment from '@/server/services/payment';
import { teamView } from '@/server/services/view';
import { addMonths, currentMonth } from '@san7/core';
import { CAPTAIN, DOM, OTHER_CAPTAIN, ctxFor } from './helpers';

const P7 = '0901000007';
const P11 = '0901000011';

describe('Popup "Đội trưởng nhắc bạn"', () => {
  it('lời nhắc ĐT bấm hiện cho thành viên (kèm tên ĐT, đường đi); đóng rồi không hiện lại', async () => {
    const cap = await ctxFor(CAPTAIN, DOM);
    await remindUpdateStats(cap, 'p7');
    const me = await ctxFor(P7, DOM);
    const v = await teamView(me);
    expect(v.reminders).toHaveLength(1);
    expect(v.reminders[0]).toMatchObject({ kind: 'edit', view: 'toi', actor: 'Tuấn Tạ', text: expect.stringContaining('cập nhật hồ sơ') });
    expect(await markRemindersSeen(me.user.id, v.reminders.map((r) => r.id), me.now)).toBe(1);
    expect((await teamView(me)).reminders).toEqual([]);
  });

  it('gom nhiều lời nhắc (định giá, đóng quỹ), mới nhất trước; thông báo thường không vào popup', async () => {
    const cap = await ctxFor(CAPTAIN, DOM);
    await transfer.remindValue(cap, 'p11');
    await payment.requestDues(cap, { month: addMonths(currentMonth(cap.now), -1) });
    await emit(prisma, { kind: 'result', teamId: DOM, recipients: ['u-p11'], text: 'Thông báo thường' });
    const r = await pendingReminders('u-p11', DOM, new Date());
    expect(r.map((x) => x.kind)).toEqual(expect.arrayContaining(['transfer']));
    expect(r.some((x) => x.text === 'Thông báo thường')).toBe(false);
    // khách / đội khác không thấy
    expect((await teamView(await ctxFor(OTHER_CAPTAIN, DOM))).reminders).toEqual([]);
    expect(await pendingReminders('u-p11', 't-phohue', new Date())).toEqual([]);
    // chỉ đánh dấu được lời nhắc của chính mình
    expect(await markRemindersSeen('u-p7', r.map((x) => x.id), new Date())).toBe(0);
    const p11 = await ctxFor(P11, DOM);
    expect((await teamView(p11)).reminders.length).toBe(r.length);
  });

  it('nhắc tự động của hệ thống (không do ĐT bấm) không bật popup', async () => {
    await emit(prisma, { kind: 'fund', teamId: DOM, recipients: ['u-p9'], text: 'Nhắc tự động', actorId: null });
    expect((await pendingReminders('u-p9', DOM, new Date())).some((x) => x.text === 'Nhắc tự động')).toBe(false);
  });
});
