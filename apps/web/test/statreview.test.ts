import { describe, expect, it } from 'vitest';
import { prisma } from '@san7/db';
import { averageStats, fillStats, type Stats } from '@san7/core';
import * as player from '@/server/services/player';
import * as join from '@/server/services/join';
import { castStatVote, remindReview, remindUpdateStats, requestReview, reviewSummaries } from '@/server/services/statreview';
import { teamView } from '@/server/services/view';
import { CAPTAIN, DOM, MEMBER, OTHER_CAPTAIN, ctxFor, expectStatus } from './helpers';

// Seed: Quang Còi (p9, MEMBER) có bản tự sửa chỉ số đang chờ (FIN, ATP = 9.5).
const P6 = '0901000006';
const P7 = '0901000007';
const editOf = async (playerId: string) => (await prisma.profileEdit.findFirstOrThrow({ where: { playerId, status: 'pending' } })).id;

describe('Cả đội chấm chỉ số, ĐT chốt (BRD 4.7)', () => {
  it('thành viên khác thấy bản chờ chấm, chủ bản thì không', async () => {
    const id = await editOf('p9');
    const v6 = await teamView(await ctxFor(P6, DOM));
    expect(v6.statReviews.find((r) => r.editId === id)).toMatchObject({ playerId: 'p9', origin: 'self', myVote: null, voted: 0 });
    expect(v6.statReviews.find((r) => r.editId === id)!.proposed.FIN).toBe(9.5);
    const v9 = await teamView(await ctxFor(MEMBER, DOM));
    expect(v9.statReviews.some((r) => r.editId === id)).toBe(false);
    // khách (ĐT đội khác) không thấy
    expect((await teamView(await ctxFor(OTHER_CAPTAIN, DOM))).statReviews).toEqual([]);
  });

  it('chấm / xác nhận; không tự chấm mình; khách không chấm được; chấm lại thì ghi đè', async () => {
    const id = await editOf('p9');
    const proposed = (await reviewSummaries(DOM)).find((r) => r.editId === id)!.proposed;
    await castStatVote(await ctxFor(P6, DOM), id, proposed); // xác nhận như bản khai
    const low: Stats = { ...proposed, FIN: 7.5, ATP: 7.5 };
    await castStatVote(await ctxFor(P7, DOM), id, { ...proposed, FIN: 8 });
    await castStatVote(await ctxFor(P7, DOM), id, low); // ghi đè
    await expectStatus(castStatVote(await ctxFor(MEMBER, DOM), id, proposed), 403);
    await expectStatus(castStatVote(await ctxFor(OTHER_CAPTAIN, DOM), id, proposed), 403);
    await expectStatus(castStatVote(await ctxFor(P6, DOM), id, { ...proposed, FIN: 11 }), 422);
    const s = (await reviewSummaries(DOM)).find((r) => r.editId === id)!;
    expect(s.votes).toHaveLength(2);
    expect(s.average).toEqual(averageStats([proposed, proposed, low]));
    expect(s.average.FIN).toBe(9); // (9.5 + 9.5 + 7.5) / 3 = 8.83 → 9
    expect(s.pending).not.toContain('p6');
    expect(s.pending).not.toContain('p9');
  });

  it('ĐT nhắc người chưa chấm (tất cả / từng người); thành viên không nhắc được', async () => {
    const id = await editOf('p9');
    const cap = await ctxFor(CAPTAIN, DOM);
    const pending = (await reviewSummaries(DOM)).find((r) => r.editId === id)!.pending;
    const before = await prisma.notification.count({ where: { text: { startsWith: 'Nhắc: chấm giúp chỉ số' } } });
    expect(await remindReview(cap, id)).toBe(pending.filter((p) => p !== 'p2').length); // không nhắc chính ĐT
    expect(await remindReview(cap, id, 'p8')).toBe(1);
    await expectStatus(remindReview(cap, id, 'p6'), 422); // đã chấm
    await expectStatus(remindReview(await ctxFor(P6, DOM), id), 403);
    expect(await prisma.notification.count({ where: { text: { startsWith: 'Nhắc: chấm giúp chỉ số' } } })).toBeGreaterThan(before);
  });

  it('ĐT duyệt không sửa → chốt theo trung bình; ĐT sửa thì theo bản ĐT sửa', async () => {
    const id = await editOf('p9');
    const avg = (await reviewSummaries(DOM)).find((r) => r.editId === id)!.average;
    await player.approveProfileEdit(await ctxFor(CAPTAIN, DOM), id);
    const p9 = await prisma.player.findUniqueOrThrow({ where: { id: 'p9' } });
    expect(fillStats(p9.stats as Record<string, number>)).toEqual(avg);
    expect(await prisma.statVote.count({ where: { editId: id } })).toBe(2);
  });

  it('ĐT yêu cầu cả đội chấm một người; nhắc người đó tự cập nhật', async () => {
    const cap = await ctxFor(CAPTAIN, DOM);
    const sent = await requestReview(cap, 'p6');
    expect(sent).toBeGreaterThan(5);
    const e = await prisma.profileEdit.findFirstOrThrow({ where: { playerId: 'p6', status: 'pending' } });
    expect(e.origin).toBe('captain');
    expect((e.payload as { stats: Stats }).stats).toEqual(fillStats((await prisma.player.findUniqueOrThrow({ where: { id: 'p6' } })).stats as Record<string, number>));
    // yêu cầu lần nữa không tạo bản trùng
    await requestReview(cap, 'p6');
    expect(await prisma.profileEdit.count({ where: { playerId: 'p6', status: 'pending' } })).toBe(1);
    await expectStatus(requestReview(await ctxFor(P7, DOM), 'p6'), 403);
    expect(await remindUpdateStats(cap, 'p7')).toBe(1);
    expect(await prisma.notification.findFirst({ where: { userId: 'u-p7', text: { contains: 'cập nhật hồ sơ & chỉ số' } } })).not.toBeNull();
  });

  it('duyệt người mới vào đội → mở đợt cả đội chấm chỉ số khai lúc đăng ký', async () => {
    const r = await prisma.joinRequest.findFirstOrThrow({ where: { teamId: DOM, status: 'pending' } });
    await join.approveJoin(await ctxFor(CAPTAIN, DOM), r.id);
    const pl = await prisma.player.findFirstOrThrow({ where: { teamId: DOM, userId: r.userId } });
    const e = await prisma.profileEdit.findFirstOrThrow({ where: { playerId: pl.id, status: 'pending' } });
    expect(e.origin).toBe('join');
    expect(await prisma.notification.count({ where: { text: { contains: 'vừa vào đội — chấm giúp chỉ số' } } })).toBeGreaterThan(5);
  });
});
