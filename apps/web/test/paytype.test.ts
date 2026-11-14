import { describe, expect, it } from 'vitest';
import { prisma } from '@san7/db';
import { addMonths, currentMonth } from '@san7/core';
import * as player from '@/server/services/player';
import { CAPTAIN, DOM, MEMBER, ctxFor, expectStatus } from './helpers';

describe('Quỹ ↔ đá lẻ ở tab Quỹ (BRD 7.4)', () => {
  it('ĐT đổi ngay / hẹn từ tháng sau / huỷ hẹn đổi; thành viên không đổi được', async () => {
    const cap = await ctxFor(CAPTAIN, DOM);
    const month = currentMonth(cap.now);
    await player.setPayType(cap, 'p5', { payType: 'le', from: 'next' });
    let p = await prisma.player.findUniqueOrThrow({ where: { id: 'p5' } });
    expect(p).toMatchObject({ payType: 'le', payTypeFrom: addMonths(month, 1), prevPayType: 'quy' });
    expect(player.effectivePayType(p, month)).toBe('quy');

    // huỷ hẹn đổi = chọn lại loại hiện tại
    await player.setPayType(cap, 'p5', { payType: 'quy', from: 'now' });
    p = await prisma.player.findUniqueOrThrow({ where: { id: 'p5' } });
    expect(p).toMatchObject({ payType: 'quy', payTypeFrom: null });

    await player.setPayType(cap, 'p5', { payType: 'le', from: 'now' });
    p = await prisma.player.findUniqueOrThrow({ where: { id: 'p5' } });
    expect(player.effectivePayType(p, month)).toBe('le');

    await expectStatus(player.setPayType(await ctxFor(MEMBER, DOM), 'p5', { payType: 'quy', from: 'now' }), 403);
    await expectStatus(player.setPayType(cap, 'p5', { payType: 'xx', from: 'now' }), 422);
  });
});
