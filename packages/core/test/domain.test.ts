import { describe, expect, it } from 'vitest';
import {
  addDays, balance, compareLines, dayOfWeek, dm, initials, leaderboard, money, monthFlow, mvpCounts, mvpQuorum, nextHomeDay,
  normName, normPhone, outstanding, parseRules, playerSeason, recentMonths, resolveMvp, ruleIcon, seasonYear,
  shortName, teamSeason, todayVN, vnDateTime, type SeasonMatch, passwordSchema, phoneSchema, statsSchema, fillStats,
} from '../src';

describe('text', () => {
  it('normName: "Đom Đóm FC" trùng "dom-dom fc"', () => {
    expect(normName('Đom Đóm FC')).toBe('domdomfc');
    expect(normName('dom-dom fc')).toBe(normName('Đom Đóm FC'));
  });
  it('normPhone', () => {
    expect(normPhone('+84 90 100 0002')).toBe('0901000002');
    expect(normPhone('0901.000.002')).toBe('0901000002');
  });
  it('tên hiển thị và chữ cái', () => {
    expect(shortName({ nick: '', fullName: 'Ngô Đăng Quang' })).toBe('Quang');
    expect(shortName({ nick: 'Quang Còi', fullName: 'x' })).toBe('Quang Còi');
    expect(initials({ nick: 'Quang Còi' })).toBe('QC');
  });
  it('money', () => {
    expect(money(200000)).toBe('200.000đ');
    expect(money(-700000)).toBe('−700.000đ');
    expect(money(0)).toBe('0đ');
  });
  it('quy định: bỏ số thứ tự đầu dòng', () => {
    expect(parseRules('1. Có mặt sớm\n2) Đóng quỹ\n\n- Không xoạc')).toEqual(['Có mặt sớm', 'Đóng quỹ', 'Không xoạc']);
    expect(ruleIcon('Đến muộn quá 15 phút')).toBe('clock');
    expect(ruleIcon('Thành viên quỹ đóng quỹ tháng')).toBe('coin');
    expect(ruleIcon('Mặc áo đội')).toBe('shirt');
  });
});

describe('time (Asia/Ho_Chi_Minh)', () => {
  it('ngày VN quanh nửa đêm', () => {
    expect(todayVN(new Date('2026-12-31T16:59:00Z'))).toBe('2026-12-31');
    expect(todayVN(new Date('2026-12-31T17:00:00Z'))).toBe('2027-01-01');
    expect(seasonYear(new Date('2026-12-31T17:00:00Z'))).toBe(2027);
  });
  it('giờ đá theo VN', () => {
    expect(vnDateTime('2026-11-01', '19:30').toISOString()).toBe('2026-11-01T12:30:00.000Z');
  });
  it('ngày tiện ích', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(dayOfWeek('2026-11-01')).toBe(0);
    expect(dm('2026-11-01')).toBe('1/11');
    expect(recentMonths(new Date('2026-01-15T05:00:00Z'))).toEqual(['2025-10', '2025-11', '2025-12', '2026-01']);
  });
  it('ngày đá sân nhà gần nhất trong 7 ngày tới', () => {
    // 30/10/2026 là thứ 6; sân nhà T3 + T6 → T3 3/11
    expect(nextHomeDay([2, 5], new Date('2026-10-30T03:00:00Z'))).toBe('2026-11-03');
    expect(nextHomeDay([], new Date('2026-10-30T03:00:00Z'))).toBe('2026-11-02');
  });
});

describe('MVP', () => {
  it('quorum = ceil(0.6N)', () => {
    expect(mvpQuorum(7)).toBe(5);
    expect(mvpQuorum(10)).toBe(6);
  });
  it('7 người Đi, 5 phiếu, không hoà → done', () => {
    const r = resolveMvp(['a', 'a', 'a', 'b', 'c'], 7);
    expect(r).toMatchObject({ status: 'done', winner: 'a', votes: 3 });
  });
  it('4 phiếu → need', () => {
    expect(resolveMvp(['a', 'a', 'a', 'b'], 7).status).toBe('need');
  });
  it('hoà → need', () => {
    expect(resolveMvp(['a', 'a', 'b', 'b', 'c'], 7)).toMatchObject({ status: 'need', tie: true });
  });
});

const M = (id: string, date: string, us: number | null, them: number | null, extra: Partial<SeasonMatch> = {}): SeasonMatch => ({
  id, date, time: '19:30', opponent: 'X', scoreUs: us, scoreThem: them, attendance: {}, events: {}, mvpPlayerId: null, ...extra,
});

describe('season', () => {
  const ms = [
    M('1', '2026-01-05', 5, 3, { attendance: { a: 'di', b: 'di' }, events: { a: { goals: 2, assists: 0 }, b: { goals: 1, assists: 2 } }, mvpPlayerId: 'b' }),
    M('2', '2026-01-12', 2, 2, { attendance: { a: 'di' }, events: { a: { goals: 1, assists: 0 } }, mvpPlayerId: 'a' }),
    M('3', '2026-01-19', 1, 3, { attendance: { b: 'di' }, events: { b: { goals: 1, assists: 0 } } }),
    M('4', '2026-01-26', 4, 1, { attendance: { a: 'di', b: 'di' }, events: { a: { goals: 1, assists: 1 } }, mvpPlayerId: 'a' }),
    M('5', '2026-02-02', 3, 0),
    M('6', '2026-02-09', null, null),
    M('old', '2025-12-20', 9, 0, { attendance: { a: 'di' }, events: { a: { goals: 9, assists: 0 } } }),
  ];
  it('T-H-B, bàn, chuỗi', () => {
    const s = teamSeason(ms, 2026);
    expect([s.n, s.w, s.d, s.l, s.gf, s.ga]).toEqual([5, 3, 1, 1, 15, 9]);
    expect(s.seq).toEqual(['T', 'H', 'B', 'T', 'T']);
    expect([s.cur, s.curK, s.wl, s.ll, s.unbeaten]).toEqual([2, 'T', 2, 1, 2]);
    expect(s.form.map((f) => f.r)).toEqual(['T', 'H', 'B', 'T', 'T']);
  });
  it('sang năm mới mọi số mùa về 0', () => {
    const s = teamSeason(ms, 2027);
    expect([s.n, s.w, s.gf]).toEqual([0, 0, 0]);
    expect(playerSeason(ms, 2027, 'a').goals).toBe(0);
  });
  it('thống kê cầu thủ và tie-break', () => {
    const a = playerSeason(ms, 2026, 'a');
    const b = playerSeason(ms, 2026, 'b');
    expect(a).toMatchObject({ gp: 3, goals: 4, assists: 1, mvp: 2, rate: 60 });
    expect(b).toMatchObject({ gp: 3, goals: 2, assists: 2, mvp: 1 });
    const c = { ...b, playerId: 'c', goals: 4, gp: 2, assists: 0 };
    const d = { ...b, playerId: 'd', goals: 4, gp: 2, assists: 3 };
    expect(leaderboard([a, b, c, d], 'goals').map((x) => x.playerId)).toEqual(['d', 'c', 'a', 'b']);
    expect(leaderboard([{ ...a, goals: 0 }], 'goals')).toEqual([]);
    expect(mvpCounts(ms, 2026).get('a')).toBe(2);
  });
  it('bảng Thống kê xếp hoà theo BRD 6.7 ở mọi cột', () => {
    const l = (playerId: string, gp: number, goals: number, assists: number, mvp: number) =>
      ({ playerId, gp, goals, assists, ga: goals + assists, mvp, rate: 0 });
    const order = (rows: ReturnType<typeof l>[], k: Parameters<typeof compareLines>[0], dir: 1 | -1 = -1) =>
      [...rows].sort(compareLines(k, dir)).map((r) => r.playerId);
    // Bằng bàn: ít trận hơn đứng trên, rồi nhiều kiến tạo hơn
    expect(order([l('long', 4, 1, 1, 0), l('minh', 3, 1, 0, 0), l('viet', 3, 1, 2, 0)], 'goals')).toEqual(['viet', 'minh', 'long']);
    // Bằng B+KT và bằng trận: chỉ số còn lại là MVP (trước đây so lại chính B+KT)
    expect(order([l('a', 4, 2, 1, 0), l('b', 4, 1, 2, 2)], 'ga')).toEqual(['b', 'a']);
    // Bằng MVP và bằng trận: nhiều B+KT hơn đứng trên
    expect(order([l('a', 4, 0, 0, 1), l('b', 4, 1, 1, 1)], 'mvp')).toEqual(['b', 'a']);
    // Cột Trận không xếp hoà theo số trận
    expect(order([l('a', 4, 0, 0, 0), l('b', 4, 2, 0, 0), l('c', 2, 5, 0, 0)], 'gp')).toEqual(['b', 'a', 'c']);
    // Đảo chiều chỉ đảo chỉ số chính
    expect(order([l('a', 4, 1, 0, 0), l('b', 3, 1, 0, 0), l('c', 4, 0, 0, 0)], 'goals', 1)).toEqual(['c', 'b', 'a']);
  });
});

describe('fund', () => {
  const entries = [
    { date: '2026-10-01', amount: 1_600_000 },
    { date: '2026-10-08', amount: -700_000 },
    { date: '2026-10-08', amount: 160_000 },
    { date: '2026-09-12', amount: -2_400_000 },
  ];
  it('số dư = tổng', () => {
    expect(balance(entries)).toBe(-1_340_000);
    expect(monthFlow(entries, '2026-10')).toEqual({ inflow: 1_760_000, outflow: 700_000 });
  });
  it('còn phải thu', () => {
    const o = outstanding({
      month: '2026-10', monthlyFee: 200_000, quyPlayerIds: ['a', 'b', 'c'], paidThisMonth: new Set(['a']),
      leTurns: [{ playerId: 'x', matchId: 'm', fee: 80_000, paid: false }, { playerId: 'y', matchId: 'm', fee: 80_000, paid: true }],
    });
    expect(o.total).toBe(480_000);
    expect(o.dues).toEqual(['b', 'c']);
  });
});

describe('schemas', () => {
  it('mật khẩu ≥ 8 ký tự, chặn phổ biến', () => {
    expect(passwordSchema.safeParse('123456').success).toBe(false);
    expect(passwordSchema.safeParse('12345678').success).toBe(false);
    expect(passwordSchema.safeParse('dom-dom-2026').success).toBe(true);
  });
  it('sđt chuẩn hoá', () => {
    expect(phoneSchema.parse('+84901000002')).toBe('0901000002');
    expect(phoneSchema.safeParse('123').success).toBe(false);
  });
  it('chỉ số bước 0.5', () => {
    expect(statsSchema.safeParse(fillStats({})).success).toBe(true);
    expect(statsSchema.safeParse(fillStats({ PAC: 7.3 })).success).toBe(false);
    expect(statsSchema.safeParse(fillStats({ PAC: 10.5 })).success).toBe(false);
  });
});
