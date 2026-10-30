/**
 * Dữ liệu mẫu — port nguyên bộ dữ liệu `sample()` + `seedDB()` của prototype (BRD 11.2).
 * Chỉ chạy ở dev/staging. Ngày trận tính tương đối so với ngày seed.
 */
import { hash } from '@node-rs/argon2';
import {
  STAT_KEYS, addDays, addMonths, autoPick, currentMonth, fillStats, inferStats, normName, todayVN, vnDateTime,
  type Ratings, type Stats,
} from '@san7/core';
import { prisma } from '../src/index';


if (process.env.NODE_ENV === 'production' && process.env.SEED_DEMO !== 'true') {
  console.error('Từ chối seed dữ liệu demo ở production.');
  process.exit(1);
}

const now = new Date();
const TODAY = todayVN(now);
const H = 3600e3;
const day = (off: number) => addDays(TODAY, off);
const mk = (off: number) => addMonths(currentMonth(now), off);
const statsOf = (arr: number[]): Stats => fillStats(Object.fromEntries(STAT_KEYS.map((k, i) => [k, arr[i]])));

async function main() {
  // Xoá sạch theo thứ tự phụ thuộc
  await prisma.$transaction([
    prisma.auditLog.deleteMany(), prisma.jobRun.deleteMany(), prisma.notification.deleteMany(),
    prisma.pushSubscription.deleteMany(), prisma.seasonSnapshot.deleteMany(), prisma.fundEntry.deleteMany(),
    prisma.duesPayment.deleteMany(), prisma.mvpBallot.deleteMany(), prisma.mvpVote.deleteMany(), prisma.claim.deleteMany(),
    prisma.matchEvent.deleteMany(), prisma.attendance.deleteMany(), prisma.match.deleteMany(), prisma.profileEdit.deleteMany(),
    prisma.joinRequest.deleteMany(), prisma.player.deleteMany(), prisma.invite.deleteMany(), prisma.teamCaptain.deleteMany(),
    prisma.team.deleteMany(), prisma.session.deleteMany(), prisma.loginAttempt.deleteMany(), prisma.rateHit.deleteMany(), prisma.passwordReset.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  const pw = await hash('123456');
  const adminPw = await hash('admin123');
  const user = (id: string, name: string, phone: string, email?: string, role = 'user', passwordHash = pw) =>
    prisma.user.create({ data: { id, name, phone, email: email ?? null, role, passwordHash } });

  await user('u-admin', 'Quản trị hệ thống', '0900000000', 'admin@san7.vn', 'admin', adminPw);

  // ================= ĐOM ĐÓM FC =================
  type P = [string, string, string, string, number, string, 'quy' | 'le', number[], string[], boolean?];
  //                                                                         PAC STA STR DRI PAS LPA FIN SHO HEA TAC DEF VIS ATP REA HAN REF GKP
  const ps: P[] = [
    ['p1', 'Trần Mạnh Hùng', 'Hùng Gôn', '1992-03-14', 1, 'Phải', 'quy',           [5, 6, 7, 4, 6, 7, 2, 3, 5, 3, 3, 5, 2, 8, 8.5, 9, 8], ['Phản xạ (TM)', 'Thủ lĩnh']],
    ['p2', 'Lê Anh Tuấn', 'Tuấn Tạ', '1990-07-02', 4, 'Phải', 'quy',               [6, 7, 8.5, 5, 6.5, 6, 4, 5, 8.5, 8.5, 8.5, 6, 4, 7.5, 3, 3, 3], ['Không chiến', 'Đọc tình huống'], true],
    ['p3', 'Phạm Hoài Nam', 'Nam Sắt', '1995-11-21', 5, 'Phải', 'quy',             [7, 8, 7.5, 5.5, 6, 5.5, 4, 4.5, 7, 8, 7.5, 5, 4, 7, 3, 3, 3], ['Càn quét', 'Bền bỉ']],
    ['p4', 'Vũ Minh Đức', 'Đức Cò', '1997-01-09', 3, 'Trái', 'quy',                [8, 8.5, 6, 6.5, 6.5, 6.5, 4, 4, 5, 7, 7, 5.5, 5, 6.5, 3, 3, 3], ['Tốc độ', 'Bền bỉ']],
    ['p5', 'Nguyễn Thành Long', 'Long Nhạc Trưởng', '1993-05-30', 8, 'Phải', 'quy', [6.5, 9, 6.5, 8, 9, 8.5, 5.5, 7, 5, 7, 7.5, 8.5, 6.5, 8, 3, 3, 3], ['Kiến thiết', 'Chuyền dài', 'Pressing']],
    ['p6', 'Đỗ Quốc Khánh', 'Khánh Mười', '1996-09-02', 10, 'Trái', 'quy',         [7.5, 7, 5, 9, 8.5, 7.5, 7.5, 8.5, 4, 4.5, 5, 9, 8.5, 8.5, 3, 3, 3], ['Kiến thiết', 'Rê dắt', 'Sút xa']],
    ['p7', 'Hoàng Gia Phong', 'Phong Gió', '1999-12-12', 7, 'Phải', 'le',          [9, 8, 5.5, 8.5, 7, 7.5, 6.5, 6.5, 4.5, 5, 5, 6.5, 7.5, 7, 3, 3, 3], ['Tốc độ', 'Rê dắt']],
    ['p8', 'Bùi Nhật Minh', 'Minh Lùn', '2000-04-18', 11, 'Trái', 'le',            [8.5, 8.5, 5, 7.5, 6.5, 7, 5.5, 5.5, 4, 5.5, 5.5, 6, 6.5, 6.5, 3, 3, 3], ['Tốc độ', 'Pressing']],
    ['p9', 'Ngô Đăng Quang', 'Quang Còi', '1994-08-08', 9, 'Phải', 'quy',          [7.5, 7, 8, 7.5, 6, 5, 9, 8, 8.5, 4, 4, 6, 9, 8.5, 3, 3, 3], ['Dứt điểm', 'Không chiến']],
    ['p10', 'Đặng Thái Sơn', 'Sơn Thép', '1991-02-25', 6, 'Phải', 'quy',           [6.5, 8.5, 7.5, 6.5, 7.5, 7, 4.5, 6, 6.5, 8, 8, 7, 4.5, 7.5, 3, 3, 3], ['Càn quét', 'Pressing', 'Bền bỉ']],
    ['p11', 'Lý Gia Bảo', 'Bảo Béo', '1998-06-06', 12, 'Phải', 'le',               [5, 6, 6.5, 4, 5.5, 6, 2, 3, 5.5, 4, 4, 4.5, 2, 6.5, 6.5, 6.5, 6], ['Phát động (TM)']],
    ['p12', 'Trịnh Quốc Việt', 'Việt Kều', '2001-10-10', 14, 'Hai chân', 'le',     [7, 7, 6.5, 7, 6.5, 6, 7.5, 7.5, 6, 4, 4, 5.5, 7.5, 7, 3, 3, 3], ['Dứt điểm', 'Sút xa']],
  ];
  const domPlayers = ps.map(([id, fullName, nick, dob, num, foot, payType, arr, styles, cap]) => ({
    id, fullName, nick, dob, num, foot, payType, stats: statsOf(arr), styles, isCaptain: !!cap,
  }));
  for (const [i, p] of domPlayers.entries()) {
    await user('u-' + p.id, p.fullName, '09010000' + String(i + 1).padStart(2, '0'), i === 1 ? 'tuan@domdom.vn' : undefined);
  }
  const dom = await prisma.team.create({
    data: {
      id: 't-domdom', name: 'Đom Đóm FC', nameKey: normName('Đom Đóm FC'), foundedOn: '2019-05-12',
      slogan: 'Nhỏ mà có võ, tối nào cũng sáng', homeName: 'Sân Chảo Lửa',
      homeAddress: '30 Nguyễn Hoàng, Mỹ Đình, Nam Từ Liêm, Hà Nội',
      homeMapUrl: 'https://www.google.com/maps/search/?api=1&query=S%C3%A2n+b%C3%B3ng+Ch%E1%BA%A3o+L%E1%BB%ADa+M%E1%BB%B9+%C4%90%C3%ACnh',
      homeDays: [2, 5], homeFrom: '19:30', homeTo: '21:00', homeCost: 700000,
      rules: [
        'Có mặt trước giờ đá 15 phút. Đến muộn quá 15 phút góp phạt 20.000đ vào quỹ.',
        'Điểm danh trên app trước 12h trưa ngày đá. Báo nghỉ muộn mà không có lý do thì vẫn tính tiền như đi.',
        'Thành viên quỹ đóng quỹ tháng trước ngày 10.',
        'Anh em đá lẻ trả tiền ngay sau trận.',
        'Không xoạc bóng, không cãi trọng tài, thắng thua vẫn là anh em.',
        'Mặc áo đội khi đá giải và giao hữu với đội ngoài.',
      ],
      formation: '2-3-1', lineup: autoPick(domPlayers, '2-3-1'), monthlyFee: 200000, perMatchFee: 80000,
      createdById: 'u-p2',
      captains: { create: [{ userId: 'u-p2' }] },
      invites: { create: [{ code: 'domdom7' }] },
    },
  });
  await prisma.player.createMany({
    data: domPlayers.map((p) => ({ ...p, teamId: dom.id, userId: 'u-' + p.id })),
  });

  type Ev = Record<string, { g: number; a: number }>;
  const all = domPlayers.map((p) => p.id);
  const att = (absent: string[], pending: string[] = []) =>
    Object.fromEntries(all.filter((id) => !pending.includes(id)).map((id) => [id, absent.includes(id) ? 'nghi' : 'di']));
  const domMatches: Array<{
    id: string; off: number; time: string; opp: string; venue: string; type: string; cost: number;
    att: Record<string, string>; lePaid: string[]; score: [number, number] | null; ev: Ev; mvp: string | null; note?: string;
  }> = [
    { id: 'm1', off: -25, time: '19:30', opp: 'FC Cầu Giấy', venue: 'Sân Chảo Lửa', type: 'Giao hữu', cost: 700000, att: att(['p8', 'p11']), lePaid: ['p7', 'p12'], score: [5, 3], ev: { p9: { g: 2, a: 0 }, p6: { g: 1, a: 2 }, p7: { g: 1, a: 1 }, p12: { g: 1, a: 0 }, p5: { g: 0, a: 1 } }, mvp: 'p6' },
    { id: 'm2', off: -18, time: '19:30', opp: 'Lão Tướng Đống Đa', venue: 'Sân Hoàng Cầu', type: 'Giao hữu', cost: 700000, att: att(['p12']), lePaid: ['p7', 'p8', 'p11'], score: [2, 2], ev: { p9: { g: 1, a: 0 }, p5: { g: 1, a: 0 }, p6: { g: 0, a: 1 }, p4: { g: 0, a: 1 } }, mvp: 'p2' },
    { id: 'm3', off: -11, time: '20:00', opp: 'Phố Huế United', venue: 'Sân Bách Khoa', type: 'Giải đấu', cost: 650000, att: att(['p3', 'p11']), lePaid: ['p7', 'p8', 'p12'], score: [1, 3], ev: { p6: { g: 1, a: 0 }, p7: { g: 0, a: 1 } }, mvp: 'p1' },
    { id: 'm4', off: -4, time: '19:30', opp: 'Anh Em Mỹ Đình', venue: 'Sân Chảo Lửa', type: 'Giao hữu', cost: 700000, att: att(['p10']), lePaid: ['p7', 'p8', 'p11'], score: [4, 1], ev: { p9: { g: 2, a: 1 }, p7: { g: 1, a: 0 }, p8: { g: 1, a: 0 }, p6: { g: 0, a: 2 } }, mvp: null },
    { id: 'm5', off: 3, time: '19:30', opp: 'Hoàng Mai Stars', venue: 'Sân Chảo Lửa', type: 'Giao hữu', cost: 700000, att: att(['p3'], ['p11', 'p12', 'p10', 'p9']), lePaid: [], score: null, ev: {}, mvp: null, note: 'Mặc áo vàng, có mặt lúc 19:15' },
    { id: 'm6', off: 10, time: '20:00', opp: 'FC Văn Phòng Láng Hạ', venue: 'Sân Hoàng Cầu', type: 'Giải đấu', cost: 650000, att: {}, lePaid: [], score: null, ev: {}, mvp: null, note: 'Vòng 3 giải phong trào quận' },
  ];
  for (const m of domMatches) {
    const date = day(m.off);
    await prisma.match.create({
      data: {
        id: m.id, teamId: dom.id, date, time: m.time, kickoffAt: vnDateTime(date, m.time), opponent: m.opp, venue: m.venue,
        type: m.type, cost: m.cost, fee: 80000, note: m.note ?? null, scoreUs: m.score?.[0] ?? null, scoreThem: m.score?.[1] ?? null,
        mvpPlayerId: m.mvp, voteState: m.id === 'm5' ? 'open' : m.score ? 'closed' : null,
        voteOpenedAt: m.id === 'm5' ? new Date(now.getTime() - H) : null,
        attendance: { create: Object.entries(m.att).map(([playerId, status]) => ({ playerId, status, lePaid: m.lePaid.includes(playerId) })) },
        events: { create: Object.entries(m.ev).map(([playerId, e]) => ({ playerId, goals: e.g, assists: e.a })) },
      },
    });
  }
  // Vote MVP trận 4 đang mở
  await prisma.mvpVote.create({ data: { matchId: 'm4', status: 'open', openedAt: new Date(now.getTime() - 14 * H), closesAt: new Date(now.getTime() + 10 * H) } });
  await prisma.mvpBallot.createMany({
    data: [['p1', 'p9'], ['p2', 'p9'], ['p5', 'p7'], ['p6', 'p9']].map(([voterId, candidateId]) => ({ matchId: 'm4', voterId, candidateId })),
  });
  await prisma.claim.create({ data: { matchId: 'm4', playerId: 'p8', goals: 1, assists: 1, createdAt: new Date(now.getTime() - 5 * H) } });
  const q = domPlayers.find((p) => p.id === 'p9')!;
  await prisma.profileEdit.create({
    data: {
      teamId: dom.id, playerId: 'p9', createdAt: new Date(now.getTime() - 2 * H),
      payload: { fullName: q.fullName, nick: 'Quang Sát Thủ', dob: q.dob, num: q.num, foot: q.foot, avatarUrl: null, stats: { ...q.stats, FIN: 9.5, ATP: 9.5 }, styles: [...q.styles, 'Sút xa'] },
    },
  });
  await user('u-hai', 'Lương Văn Hải', '0901000099');
  const haiRatings: Ratings = { CB: 7.5, CM: 7 };
  await prisma.joinRequest.create({
    data: {
      teamId: dom.id, userId: 'u-hai', phone: '0901000099', createdAt: new Date(now.getTime() - 24 * H),
      payload: { fullName: 'Lương Văn Hải', nick: 'Hải Râu', dob: '1998-03-03', num: 15, foot: 'Phải', payType: 'le', styles: ['Càn quét'], avatarUrl: null, ratings: haiRatings, stats: inferStats(haiRatings, 'Phải') },
    },
  });

  // Quỹ
  const quy = domPlayers.filter((p) => p.payType === 'quy').map((p) => p.id);
  const dues: Record<string, string[]> = { [mk(-2)]: quy, [mk(-1)]: quy.filter((id) => id !== 'p3'), [mk(0)]: ['p1', 'p2', 'p5', 'p6', 'p9'] };
  for (const [month, ids] of Object.entries(dues)) {
    await prisma.duesPayment.createMany({ data: ids.map((playerId) => ({ teamId: dom.id, playerId, month, amount: 200000 })) });
  }
  await seedLedger(dom.id, dues, 200000);
  const manual: Array<[string, number, string]> = [
    [mk(-2) + '-01', 1500000, 'Số dư mùa trước chuyển sang'],
    [mk(-2) + '-03', 1000000, 'Anh Tùng tài trợ đầu mùa'],
    [mk(-1) + '-12', -2400000, 'Áo đấu mới (12 bộ)'],
    [day(-9), -450000, 'Mua 3 quả bóng'],
  ];
  await prisma.fundEntry.createMany({
    data: manual.map(([date, amount, note], i) => ({ teamId: dom.id, date, amount, note, source: 'manual', sourceKey: 'seed-' + i, createdById: 'u-p2' })),
  });

  // ================= PHỐ HUẾ UNITED =================
  type Q = [string, string, string, number, string, 'quy' | 'le', Ratings, string[]];
  const qs: Q[] = [
    ['q1', 'Nguyễn Hữu Phúc', 'Phúc Gôn', 1, 'Phải', 'quy', { GK: 7.8 }, ['Phản xạ (TM)']],
    ['q2', 'Trần Đức Anh', 'Anh Thép', 4, 'Phải', 'quy', { CB: 8.2, CM: 7 }, ['Không chiến', 'Thủ lĩnh']],
    ['q3', 'Lê Minh Tâm', 'Tâm Lợn', 5, 'Phải', 'quy', { CB: 7.4, LB: 7 }, ['Càn quét']],
    ['q4', 'Đỗ Văn Hiếu', 'Hiếu Còi', 8, 'Phải', 'quy', { CM: 8.4, ST: 7.4 }, ['Kiến thiết']],
    ['q5', 'Bùi Quang Huy', 'Huy Mập', 6, 'Phải', 'le', { CM: 7.6, CB: 7 }, ['Càn quét', 'Bền bỉ']],
    ['q6', 'Vũ Thành Nam', 'Nam Tây', 7, 'Phải', 'quy', { ST: 8.1, RB: 7.2 }, ['Tốc độ']],
    ['q7', 'Hà Đức Toàn', 'Toàn Lé', 11, 'Trái', 'le', { LB: 7.5, CM: 7 }, ['Tốc độ']],
    ['q8', 'Ngô Tiến Dũng', 'Dũng Tịt', 9, 'Phải', 'quy', { ST: 8.6, CM: 7 }, ['Dứt điểm']],
    ['q9', 'Mai Xuân Trường', 'Trường Bé', 10, 'Trái', 'quy', { CM: 8, ST: 7.4 }, ['Rê dắt', 'Sút xa']],
  ];
  const phPlayers = qs.map(([id, fullName, nick, num, foot, payType, r, styles]) => ({
    id, fullName, nick, num, foot, payType, stats: inferStats(r, foot), styles, isCaptain: id === 'q2',
  }));
  for (const [i, p] of phPlayers.entries()) await user('u-' + p.id, p.fullName, '09020000' + String(i + 1).padStart(2, '0'));
  const ph = await prisma.team.create({
    data: {
      id: 't-phohue', name: 'Phố Huế United', nameKey: normName('Phố Huế United'), foundedOn: '2017-08-20', slogan: 'Chơi đẹp, đá chắc',
      homeName: 'Sân Bách Khoa', homeAddress: 'Đại học Bách Khoa, Hai Bà Trưng, Hà Nội', homeDays: [3, 6], homeFrom: '20:00', homeTo: '21:30',
      homeCost: 650000, rules: ['Có mặt trước 15 phút.', 'Đóng quỹ trước ngày 5 hằng tháng.', 'Không cãi trọng tài.'],
      formation: '3-2-1', lineup: autoPick(phPlayers, '3-2-1'), monthlyFee: 250000, perMatchFee: 90000, createdById: 'u-q2',
      captains: { create: [{ userId: 'u-q2' }] }, invites: { create: [{ code: 'phohue9' }] },
    },
  });
  await prisma.player.createMany({ data: phPlayers.map((p) => ({ ...p, teamId: ph.id, userId: 'u-' + p.id })) });
  const phAll = phPlayers.map((p) => p.id);
  const phMatches: Array<[string, number, string, [number, number] | null, Ev, string | null, string[]]> = [
    ['n1', -11, 'Đom Đóm FC', [3, 1], { q8: { g: 2, a: 0 }, q9: { g: 1, a: 1 }, q4: { g: 0, a: 2 } }, 'q8', ['q3']],
    ['n2', -6, 'FC Hai Bà Trưng', [2, 2], { q8: { g: 1, a: 0 }, q4: { g: 1, a: 0 }, q9: { g: 0, a: 1 } }, 'q4', ['q7']],
    ['n3', -2, 'Thanh Xuân Boys', [4, 0], { q8: { g: 1, a: 0 }, q6: { g: 2, a: 0 }, q9: { g: 1, a: 0 }, q4: { g: 0, a: 2 }, q7: { g: 0, a: 1 } }, 'q6', []],
    ['n4', 5, 'Lão Tướng Đống Đa', null, {}, null, []],
  ];
  for (const [id, off, opp, score, ev, mvp, abs] of phMatches) {
    const date = day(off);
    await prisma.match.create({
      data: {
        id, teamId: ph.id, date, time: '20:00', kickoffAt: vnDateTime(date, '20:00'), opponent: opp, venue: 'Sân Bách Khoa', type: 'Giao hữu',
        cost: 650000, fee: 90000, scoreUs: score?.[0] ?? null, scoreThem: score?.[1] ?? null, mvpPlayerId: mvp,
        voteState: score ? 'closed' : 'open', voteOpenedAt: score ? null : now,
        attendance: score ? { create: phAll.map((playerId) => ({ playerId, status: abs.includes(playerId) ? 'nghi' : 'di', lePaid: ['q5', 'q7'].includes(playerId) && !abs.includes(playerId) })) } : undefined,
        events: { create: Object.entries(ev).map(([playerId, e]) => ({ playerId, goals: e.g, assists: e.a })) },
      },
    });
  }
  await seedLedger(ph.id, {}, 250000);

  // ================= THÔNG BÁO =================
  const m5 = domMatches[4];
  const n = (userId: string, kind: string, text: string, ago: number, extra: { matchId?: string; view?: string } = {}) =>
    prisma.notification.create({ data: { userId, teamId: dom.id, kind, text, createdAt: new Date(now.getTime() - ago), ...extra } });
  const [, mm, dd] = day(m5.off).split('-').map(Number);
  for (const p of domPlayers) if (p.id !== 'p2') await n('u-' + p.id, 'vote', `Trận ${dd}/${mm} 19:30 vs ${m5.opp}: bạn đi được không?`, 50 * 60e3, { matchId: 'm5' });
  const m4 = domMatches[3];
  const [, m4m, m4d] = day(m4.off).split('-').map(Number);
  for (const [pid, s] of Object.entries(m4.att)) if (s === 'di' && pid !== 'p2') await n('u-' + pid, 'mvp', `Vote MVP trận vs ${m4.opp} (${m4d}/${m4m}) đã mở, hạn 24 giờ`, 14 * H, { matchId: 'm4' });
  await n('u-p2', 'join', 'Lương Văn Hải xin vào đội Đom Đóm FC', 24 * H, { view: 'duyet' });
  await n('u-p2', 'edit', 'Quang Còi gửi cập nhật hồ sơ, chỉ số', 2 * H, { view: 'duyet' });
  await n('u-p2', 'claim', `Minh Lùn khai 1 bàn, 1 kiến tạo trận vs ${m4.opp}`, 5 * H, { matchId: 'm4', view: 'duyet' });

  console.log(`Seed xong: ${await prisma.user.count()} tài khoản, ${await prisma.team.count()} đội, ${await prisma.match.count()} trận.`);
}

/** Ghi sổ quỹ tự sinh đúng như service quỹ/job sẽ ghi (ARCHITECTURE 6.4). */
async function seedLedger(teamId: string, dues: Record<string, string[]>, fee: number) {
  for (const [month, ids] of Object.entries(dues)) {
    if (!ids.length) continue;
    const [y, m] = month.split('-');
    await prisma.fundEntry.create({
      data: { teamId, date: `${month}-01`, amount: ids.length * fee, source: 'dues', sourceKey: month, note: `Quỹ T${+m}/${y.slice(2)} · ${ids.length} người` },
    });
  }
  const matches = await prisma.match.findMany({ where: { teamId, date: { lt: TODAY } }, include: { attendance: true } });
  for (const m of matches) {
    if (m.cost) await prisma.fundEntry.create({ data: { teamId, date: m.date, amount: -m.cost, source: 'pitch', sourceKey: m.id, note: `Tiền sân vs ${m.opponent}` } });
    const paid = m.attendance.filter((a) => a.lePaid).length;
    if (paid) await prisma.fundEntry.create({ data: { teamId, date: m.date, amount: paid * m.fee, source: 'le', sourceKey: m.id, note: `Đá lẻ vs ${m.opponent} · ${paid} người` } });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
