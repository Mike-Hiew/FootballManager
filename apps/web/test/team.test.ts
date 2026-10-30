import { describe, expect, it } from 'vitest';
import { prisma } from '@san7/db';
import { inferStats, normName, positionScore } from '@san7/core';
import * as team from '@/server/services/team';
import * as join from '@/server/services/join';
import * as player from '@/server/services/player';
import { teamView } from '@/server/services/view';
import { CAPTAIN, DOM, MEMBER, OTHER_CAPTAIN, ctxFor, expectStatus } from './helpers';

describe('Đội & gia nhập (BRD 3, 11.1 #1–2)', () => {
  it('tên đội duy nhất sau chuẩn hoá: "dom dom fc" trùng "Đom Đóm FC"', async () => {
    expect(await team.isNameTaken('dom dom fc')).toBe(true);
    const u = await prisma.user.findUniqueOrThrow({ where: { phone: MEMBER } });
    await expectStatus(team.createTeam({ id: u.id, name: u.name, phone: u.phone, email: u.email, role: u.role }, { name: 'dom-dom FC' }), 409);
  });

  it('tạo đội: người tạo là ĐT + cầu thủ, có mã mời, phí mặc định', async () => {
    const u = await prisma.user.findUniqueOrThrow({ where: { phone: '0901000005' } });
    const t = await team.createTeam({ id: u.id, name: u.name, phone: u.phone, email: u.email, role: u.role }, { name: 'Sao Băng FC', captainNum: 8, captainFoot: 'Phải', captainRatings: { CM: 7.5 } });
    expect(t.nameKey).toBe(normName('Sao Băng FC'));
    expect(t.monthlyFee).toBe(200000);
    expect(t.perMatchFee).toBe(80000);
    expect(t.fullSquad).toBe(9);
    expect(await prisma.teamCaptain.count({ where: { teamId: t.id, userId: u.id } })).toBe(1);
    expect(await prisma.player.findFirst({ where: { teamId: t.id, userId: u.id, isCaptain: true, payType: 'quy' } })).not.toBeNull();
    expect(await team.activeInvite(t.id)).toMatch(/^[a-z0-9]{6}$/);
  });

  it('link mời → đơn chờ → ĐT sửa chỉ số rồi duyệt → vào đội + thông báo; link mới thì link cũ hết hiệu lực', async () => {
    const cap = await ctxFor(CAPTAIN, DOM);
    const newbie = await prisma.user.create({ data: { name: 'Người Mới', phone: '0909999001', passwordHash: 'x' } });
    const nu = { id: newbie.id, name: newbie.name, phone: newbie.phone, email: null, role: 'user' };
    await join.submitJoin('domdom7', { fullName: 'Người Mới', foot: 'Phải', payType: 'le', ratings: { ST: 7.5 }, styles: [] }, nu);
    await expectStatus(join.submitJoin('domdom7', { fullName: 'Người Mới', foot: 'Phải', payType: 'le', ratings: { ST: 7.5 } }, nu), 409);
    const r = await prisma.joinRequest.findFirstOrThrow({ where: { userId: newbie.id, status: 'pending' } });
    const payload = r.payload as Record<string, unknown>;
    expect(Math.abs(positionScore(payload.stats as never, 'Phải', 'ST') - 7.5)).toBeLessThanOrEqual(0.3);
    expect(await prisma.notification.count({ where: { userId: 'u-p2', kind: 'join', text: { contains: 'Người Mới' } } })).toBe(1);
    const edited = { ...payload, num: 21, stats: { ...(payload.stats as object), FIN: 9 } };
    await join.approveJoin(cap, r.id, edited);
    const p = await prisma.player.findFirstOrThrow({ where: { teamId: DOM, userId: newbie.id } });
    expect(p.status).toBe('active');
    expect((p.stats as Record<string, number>).FIN).toBe(9);
    expect(await prisma.notification.count({ where: { userId: newbie.id, text: { startsWith: 'Bạn đã vào đội' } } })).toBe(1);

    const old = await team.activeInvite(DOM);
    const code = await team.rotateInvite(cap);
    expect(code).not.toBe(old);
    expect(await team.inviteInfo(old!)).toBeNull();
    expect(await team.inviteInfo(code)).not.toBeNull();
  });

  it('thành viên sửa hồ sơ → bản chờ (ghi đè), dữ liệu cũ giữ nguyên tới khi duyệt', async () => {
    const me = await ctxFor(MEMBER, DOM);
    const before = await prisma.player.findUniqueOrThrow({ where: { id: 'p9' } });
    const base = { fullName: before.fullName, nick: 'Quang Mới', foot: before.foot, styles: before.styles, stats: inferStats({ ST: 8 }, 'Phải') };
    await player.submitProfileEdit(me, base);
    await player.submitProfileEdit(me, { ...base, nick: 'Quang Mới 2' });
    expect(await prisma.profileEdit.count({ where: { playerId: 'p9', status: 'pending' } })).toBe(1);
    expect((await prisma.player.findUniqueOrThrow({ where: { id: 'p9' } })).nick).toBe(before.nick);
    await expectStatus(player.updatePlayer(me, 'p9', { ...base, payType: 'quy' }), 403);
  });

  it('đổi quỹ ↔ đá lẻ có hiệu lực từ tháng sau', async () => {
    const cap = await ctxFor(CAPTAIN, DOM, new Date('2026-10-15T05:00:00Z'));
    const p = await prisma.player.findUniqueOrThrow({ where: { id: 'p4' } });
    await player.updatePlayer(cap, 'p4', { fullName: p.fullName, foot: p.foot, styles: p.styles, stats: p.stats, payType: 'le' });
    const after = await prisma.player.findUniqueOrThrow({ where: { id: 'p4' } });
    expect(after).toMatchObject({ payType: 'le', payTypeFrom: '2026-11', prevPayType: 'quy' });
    expect(player.effectivePayType(after, '2026-10')).toBe('quy');
    expect(player.effectivePayType(after, '2026-11')).toBe('le');
    await prisma.player.update({ where: { id: 'p4' }, data: { payType: 'quy', payTypeFrom: null, prevPayType: null } });
  });
});

describe('Ngưỡng "đủ người" (đội tự cấu hình)', () => {
  it('ĐT đổi được, tối thiểu 7; thành viên không đổi được; giữ nguyên khi form không gửi', async () => {
    const cap = await ctxFor(CAPTAIN, DOM);
    const t = await prisma.team.findUniqueOrThrow({ where: { id: DOM } });
    const base = { name: t.name, homeDays: t.homeDays, homeCost: t.homeCost };
    await team.updateTeam(cap, { ...base, fullSquad: 11 });
    expect((await teamView(cap)).team.fullSquad).toBe(11);
    await expectStatus(team.updateTeam(cap, { ...base, fullSquad: 6 }), 422);
    await team.updateTeam(cap, base);
    expect((await prisma.team.findUniqueOrThrow({ where: { id: DOM } })).fullSquad).toBe(11);
    await expectStatus(team.updateTeam(await ctxFor(MEMBER, DOM), { ...base, fullSquad: 8 }), 403);
    await team.updateTeam(cap, { ...base, fullSquad: t.fullSquad });
  });
});

describe('Khách xem đội khác (BRD 8.5, 11.1 #13)', () => {
  it('không lộ SĐT, ngày sinh, quỹ, trận sắp tới; ĐT thấy SĐT, thành viên không', async () => {
    const guest = await teamView(await ctxFor(OTHER_CAPTAIN, DOM));
    expect(guest.role).toBe('guest');
    expect(guest.canEdit).toBe(false);
    expect(guest.players.every((p) => p.phone === null && p.dob === null)).toBe(true);
    expect(guest.team.monthlyFee).toBeNull();
    expect(guest.team.inviteCode).toBeNull();
    expect(guest.matches.every((m) => m.scoreUs != null && m.cost === null && m.fee === null)).toBe(true);
    const s = JSON.stringify(guest);
    expect(s).not.toMatch(/0901000\d{3}/);
    const member = await teamView(await ctxFor(MEMBER, DOM));
    expect(member.players.every((p) => p.phone === null)).toBe(true);
    expect(member.team.monthlyFee).toBe(200000);
    const cap = await teamView(await ctxFor(CAPTAIN, DOM));
    expect(cap.players.some((p) => p.phone)).toBe(true);
  });

  it('số phiếu MVP khi đang mở chỉ ĐT thấy', async () => {
    const member = await teamView(await ctxFor(MEMBER, DOM));
    const cap = await teamView(await ctxFor(CAPTAIN, DOM));
    const m4m = member.matches.find((m) => m.id === 'm4')!;
    const m4c = cap.matches.find((m) => m.id === 'm4')!;
    expect(m4m.mvpVote?.status).toBe('open');
    expect(m4m.mvpVote?.tally).toBeNull();
    expect(m4c.mvpVote?.tally?.[0]).toEqual(['p9', 3]);
  });
});
