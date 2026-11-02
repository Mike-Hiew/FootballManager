import { describe, expect, it } from 'vitest';
import { prisma } from '@san7/db';
import * as transfer from '@/server/services/transfer';
import { allowedViews } from '@/server/authz';
import { teamView } from '@/server/services/view';
import { CAPTAIN, DOM, MEMBER, OTHER_CAPTAIN, PH, ctxFor, expectStatus } from './helpers';

const P8 = '0901000008'; // Minh Lùn — chưa định giá
const P12 = '0901000012'; // Việt Kều — đang rao bán
const Q4 = '0902000004'; // Hiếu Còi (Phố Huế)
const notes = (userId: string, text: string) => prisma.notification.count({ where: { userId, text: { contains: text } } });

describe('Giá trị chuyển nhượng (BRD 12.1)', () => {
  it('chưa tự định giá thì mặc định 1M (tối thiểu); người mới vào đội cũng 1M', async () => {
    const mv = await transfer.marketView(await ctxFor(CAPTAIN, DOM));
    expect(mv.squad.find((p) => p.id === 'p8')).toMatchObject({ value: 10, isDefault: true });
    expect(mv.squad.find((p) => p.id === 'p9')).toMatchObject({ isDefault: false });
    const fresh = await prisma.player.create({ data: { teamId: DOM, fullName: 'Người Mới Tinh', foot: 'Phải', payType: 'le', stats: {} } });
    expect(fresh.marketValue).toBe(10);
    await prisma.player.delete({ where: { id: fresh.id } });
  });

  it('thành viên tự đặt giá, áp dụng ngay, có lịch sử; sai giá bị chặn', async () => {
    const me = await ctxFor(P8, DOM);
    await transfer.setMyValue(me, { value: 1200 });
    const p8 = await prisma.player.findUniqueOrThrow({ where: { id: 'p8' } });
    expect(p8.marketValue).toBe(1200);
    expect(await prisma.marketValueLog.count({ where: { playerId: 'p8', source: 'self' } })).toBe(1);
    await expectStatus(transfer.setMyValue(me, { value: 5 }), 422); // < 1M
    await expectStatus(transfer.setMyValue(me, { value: 10_000_000 }), 422); // > 999B
    await expectStatus(transfer.setMyValue(await ctxFor(OTHER_CAPTAIN, DOM), { value: 100 }), 403); // khách
  });

  it('ĐT sửa giá bất kỳ ai (báo người đó), khoá giá thì thành viên không tự sửa được', async () => {
    const cap = await ctxFor(CAPTAIN, DOM);
    await transfer.setPlayerValue(cap, 'p8', { value: 1500 });
    expect((await prisma.player.findUniqueOrThrow({ where: { id: 'p8' } })).marketValue).toBe(1500);
    expect(await notes('u-p8', 'Đội trưởng đặt giá trị chuyển nhượng của bạn: 150.000.000 đ')).toBe(1);
    await transfer.setValueLock(cap, 'p8', true);
    await expectStatus(transfer.setMyValue(await ctxFor(P8, DOM), { value: 2000 }), 403);
    await transfer.setValueLock(cap, 'p8', false);
    await transfer.setMyValue(await ctxFor(P8, DOM), { value: 2000 });
    await expectStatus(transfer.setPlayerValue(await ctxFor(MEMBER, DOM), 'p8', { value: 100 }), 403);
    await expectStatus(transfer.setPlayerValue(cap, 'q4', { value: 100 }), 404); // cầu thủ đội khác
  });

  it('ĐT nhắc người chưa định giá: từng người / tất cả', async () => {
    const cap = await ctxFor(CAPTAIN, DOM);
    expect(await transfer.remindValue(cap, 'p11')).toBe(1);
    expect(await notes('u-p11', 'đặt giá trị chuyển nhượng')).toBe(1);
    await expectStatus(transfer.remindValue(cap, 'p9'), 422); // đã có giá
    expect(await transfer.remindValue(cap)).toBe(1); // còn mỗi Bảo Béo
    await expectStatus(transfer.remindValue(await ctxFor(MEMBER, DOM)), 403);
  });

  it('rao bán cần có giá; khách xem được tab Chuyển nhượng và thị trường chung', async () => {
    const cap = await ctxFor(CAPTAIN, DOM);
    await transfer.setListed(cap, 'p7', true);
    expect(allowedViews('guest', false)).toContain('chuyen-nhuong');
    const guest = await transfer.marketView(await ctxFor(OTHER_CAPTAIN, DOM));
    expect(guest.squad.find((p) => p.id === 'p9')).toMatchObject({ value: 15000, prevValue: 12500, pos: expect.any(String) });
    expect(guest.market.map((p) => p.id)).toEqual(expect.arrayContaining(['p7', 'p12', 'q4']));
    expect(guest.buyerTeams).toEqual([{ id: PH, name: 'Phố Huế United' }]);
    expect((await transfer.marketView(cap)).buyerTeams).toEqual([{ id: DOM, name: 'Đom Đóm FC' }]); // ĐT mua từ thị trường cho đội mình
    expect(guest.totals.valued).toBeGreaterThan(9);
    await transfer.setListed(cap, 'p7', false);
  });
});

describe('Đề nghị chuyển nhượng giữa các đội (BRD 12.2)', () => {
  it('ĐT đội mua gửi → ĐT đội bán trả giá → đội mua đồng ý → cầu thủ đồng ý → chuyển đội', async () => {
    const buyer = await ctxFor(OTHER_CAPTAIN, DOM); // Anh Thép xem Đom Đóm, mua cho Phố Huế
    const o = await transfer.makeOffer(buyer, 'p12', { buyerTeamId: PH, amount: 2500, message: 'Cần tiền đạo' });
    expect(o.status).toBe('pending');
    expect(await notes('u-p2', 'Phố Huế United muốn mua Việt Kều')).toBe(1);
    expect(await notes('u-p12', 'gửi đề nghị chiêu mộ bạn')).toBe(1);
    // nâng giá cùng đề nghị, không tạo bản thứ hai
    await transfer.makeOffer(buyer, 'p12', { buyerTeamId: PH, amount: 2700 });
    expect(await prisma.transferOffer.count({ where: { playerId: 'p12', status: 'pending' } })).toBe(1);

    const seller = await ctxFor(CAPTAIN, DOM);
    // thành viên / đội mua không trả lời thay đội bán
    await expectStatus(transfer.respondOffer(await ctxFor(MEMBER, DOM), o.id, { action: 'accept' }), 403);
    await expectStatus(transfer.respondOffer(buyer, o.id, { action: 'accept' }), 403);
    await expectStatus(transfer.respondOffer(seller, o.id, { action: 'counter', counter: 2000 }), 422);
    await transfer.respondOffer(seller, o.id, { action: 'counter', counter: 3200 });
    expect(await notes('u-q2', 'Đom Đóm FC trả giá Việt Kều: 320.000.000 đ')).toBe(1);

    await transfer.respondOffer(await ctxFor(OTHER_CAPTAIN, PH), o.id, { action: 'accept' });
    const agreed = await prisma.transferOffer.findUniqueOrThrow({ where: { id: o.id } });
    expect(agreed).toMatchObject({ status: 'agreed', amount: 3200 });
    expect(await notes('u-p12', 'bạn đồng ý chuyển đội không')).toBe(1);
    await expectStatus(transfer.respondOffer(seller, o.id, { action: 'accept' }), 403); // chờ cầu thủ

    const mv = await transfer.marketView(await ctxFor(P12, DOM));
    expect(mv.offers.find((x) => x.id === o.id)?.can).toEqual(['accept', 'reject']);

    const r = await transfer.respondOffer(await ctxFor(P12, DOM), o.id, { action: 'accept' });
    expect(r.status).toBe('completed');
    const old = await prisma.player.findUniqueOrThrow({ where: { id: 'p12' } });
    expect(old).toMatchObject({ status: 'left', listedAt: null });
    const np = await prisma.player.findFirstOrThrow({ where: { teamId: PH, userId: 'u-p12' } });
    expect(np).toMatchObject({ status: 'active', marketValue: 3200, fullName: old.fullName, num: 14 });
    expect(await prisma.marketValueLog.count({ where: { playerId: np.id, source: 'transfer' } })).toBe(1);
    // vai trò: rời Đom Đóm (khách), thành viên Phố Huế
    expect((await ctxFor(P12, DOM)).role).toBe('guest');
    expect((await ctxFor(P12, PH)).role).toBe('member');
    expect(await notes('u-q1', 'HERE WE GO! Việt Kều gia nhập đội từ Đom Đóm FC')).toBe(1);
    expect(await notes('u-p9', 'Việt Kều chia tay đội')).toBe(1);
    // bảng tin + đội hình mới
    const news = (await transfer.marketView(await ctxFor(CAPTAIN, DOM))).news;
    expect(news[0]).toMatchObject({ amount: 3200, seller: { id: DOM }, buyer: { id: PH }, player: { name: 'Việt Kều' } });
    expect((await teamView(await ctxFor(OTHER_CAPTAIN, PH))).players.some((p) => p.id === np.id && p.status === 'active')).toBe(true);
  });

  it('chặn: mua người đội mình, đội trưởng đội bạn, người không phải ĐT; trùng đề nghị; giá sai', async () => {
    const buyer = await ctxFor(OTHER_CAPTAIN, DOM);
    await expectStatus(transfer.makeOffer(buyer, 'p2', { buyerTeamId: PH, amount: 3000 }), 422); // Tuấn Tạ là ĐT
    await expectStatus(transfer.makeOffer(buyer, 'q4', { buyerTeamId: PH, amount: 3000 }), 422); // người đội mình
    await expectStatus(transfer.makeOffer(await ctxFor(MEMBER, DOM), 'q4', { buyerTeamId: DOM, amount: 3000 }), 403);
    await expectStatus(transfer.makeOffer(buyer, 'p9', { buyerTeamId: PH, amount: 1 }), 422);
    await expectStatus(transfer.makeOffer(buyer, 'p9', { buyerTeamId: DOM, amount: 3000 }), 403); // không phải ĐT đội mua
  });

  it('từ chối / rút; cầu thủ từ chối thì ở lại', async () => {
    const seller = await ctxFor(OTHER_CAPTAIN, PH);
    const domCap = await ctxFor(CAPTAIN, PH); // Tuấn Tạ xem Phố Huế, mua cho Đom Đóm
    const a = await transfer.makeOffer(domCap, 'q4', { buyerTeamId: DOM, amount: 6000 });
    await transfer.respondOffer(seller, a.id, { action: 'reject', reason: 'Không bán' });
    expect((await prisma.transferOffer.findUniqueOrThrow({ where: { id: a.id } })).status).toBe('rejected');
    expect(await notes('u-p2', 'Phố Huế United từ chối bán Hiếu Còi · Không bán')).toBe(1);
    await expectStatus(transfer.respondOffer(seller, a.id, { action: 'accept' }), 422); // đã kết thúc

    const b = await transfer.makeOffer(domCap, 'q4', { buyerTeamId: DOM, amount: 7000 });
    await transfer.respondOffer(domCap, b.id, { action: 'withdraw' });
    expect((await prisma.transferOffer.findUniqueOrThrow({ where: { id: b.id } })).status).toBe('withdrawn');

    // Cầu thủ từ chối sau khi hai đội đồng ý
    const c = await transfer.makeOffer(domCap, 'q4', { buyerTeamId: DOM, amount: 7000 });
    await transfer.respondOffer(seller, c.id, { action: 'accept' });
    await transfer.respondOffer(await ctxFor(Q4, PH), c.id, { action: 'reject', reason: 'Ở lại' });
    expect((await prisma.transferOffer.findUniqueOrThrow({ where: { id: c.id } })).status).toBe('rejected');
    expect((await prisma.player.findUniqueOrThrow({ where: { id: 'q4' } })).status).toBe('active');
  });

  it('cầu thủ không có tài khoản: hai đội đồng ý là chuyển luôn', async () => {
    const domCap = await ctxFor(CAPTAIN, DOM);
    const ghost = await prisma.player.create({ data: { teamId: PH, fullName: 'Người Không TK', foot: 'Phải', payType: 'le', stats: {}, marketValue: 500 } });
    const o = await transfer.makeOffer(domCap, ghost.id, { buyerTeamId: DOM, amount: 500 });
    const r = await transfer.respondOffer(await ctxFor(OTHER_CAPTAIN, PH), o.id, { action: 'accept' });
    expect(r.status).toBe('completed');
    expect(await prisma.player.count({ where: { teamId: DOM, fullName: 'Người Không TK', status: 'active' } })).toBe(1);
  });
});
