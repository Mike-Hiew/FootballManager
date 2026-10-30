import { describe, expect, it } from 'vitest';
import { prisma } from '@san7/db';
import * as match from '@/server/services/match';
import { CAPTAIN, DOM, MEMBER, OTHER_CAPTAIN, ctxFor, expectStatus } from './helpers';

describe('Điểm danh (BRD 6.3, 11.1 #7)', () => {
  it('thành viên vote cho mình khi vote mở; chạm lại = bỏ chọn', async () => {
    const me = await ctxFor(MEMBER, DOM);
    await match.setAttendance(me, 'm5', me.playerId!, { status: 'di' });
    let a = await prisma.attendance.findUnique({ where: { matchId_playerId: { matchId: 'm5', playerId: me.playerId! } } });
    expect(a).toMatchObject({ status: 'di', setByCaptain: false });
    await match.setAttendance(me, 'm5', me.playerId!, { status: null });
    a = await prisma.attendance.findUnique({ where: { matchId_playerId: { matchId: 'm5', playerId: me.playerId! } } });
    expect(a).toBeNull();
  });

  it('thành viên không sửa được vote người khác (403)', async () => {
    const me = await ctxFor(MEMBER, DOM);
    await expectStatus(match.setAttendance(me, 'm5', 'p1', { status: 'nghi' }), 403);
  });

  it('không vote được khi điểm danh đóng hoặc chưa mở', async () => {
    const me = await ctxFor(MEMBER, DOM);
    await expectStatus(match.setAttendance(me, 'm6', me.playerId!, { status: 'di' }), 403);
  });

  it('ĐT sửa hộ → "đội trưởng chỉnh"; thành viên tự vote lại thì xoá đánh dấu', async () => {
    const cap = await ctxFor(CAPTAIN, DOM);
    await match.setAttendance(cap, 'm5', 'p9', { status: 'nghi' });
    let a = await prisma.attendance.findUniqueOrThrow({ where: { matchId_playerId: { matchId: 'm5', playerId: 'p9' } } });
    expect(a.setByCaptain).toBe(true);
    const me = await ctxFor(MEMBER, DOM);
    await match.setAttendance(me, 'm5', 'p9', { status: 'di' });
    a = await prisma.attendance.findUniqueOrThrow({ where: { matchId_playerId: { matchId: 'm5', playerId: 'p9' } } });
    expect(a.setByCaptain).toBe(false);
  });

  it('khách (đội khác) không điểm danh được', async () => {
    const guest = await ctxFor(OTHER_CAPTAIN, DOM);
    expect(guest.role).toBe('guest');
    await expectStatus(match.setAttendance(guest, 'm5', 'p1', { status: 'di' }), 403);
  });

  it('mở điểm danh lần đầu gửi thông báo cho mọi thành viên (trừ người mở)', async () => {
    const cap = await ctxFor(CAPTAIN, DOM);
    const before = await prisma.notification.count({ where: { matchId: 'm6', kind: 'vote' } });
    await match.setVoteState(cap, 'm6', 'open');
    const after = await prisma.notification.count({ where: { matchId: 'm6', kind: 'vote' } });
    const members = await prisma.player.count({ where: { teamId: DOM, status: 'active', userId: { not: null } } });
    expect(after - before).toBe(members - 1);
    expect(await prisma.notification.count({ where: { matchId: 'm6', userId: cap.user.id } })).toBe(0);
    await match.setVoteState(cap, 'm6', 'closed');
    await match.setVoteState(cap, 'm6', 'open');
    expect(await prisma.notification.count({ where: { matchId: 'm6', kind: 'vote' } })).toBe(after);
  });
});
