import { describe, expect, it } from 'vitest';
import { balanceTeams, defaultShare, fillStats, inferStats, sharesOf, splitTotal, strengthOf, summarize, teamSeason, type SeasonMatch, type SplitPlayer } from '../src';

const mk = (id: string, ratings: Record<string, number>): SplitPlayer => ({ id, foot: 'Phải', stats: inferStats(ratings, 'Phải') });
const squad: SplitPlayer[] = [
  mk('gk1', { GK: 8 }), mk('gk2', { GK: 6 }),
  mk('d1', { CB: 8.5 }), mk('d2', { CB: 6 }), mk('d3', { LB: 7 }), mk('d4', { RB: 6.5 }),
  mk('m1', { CM: 9 }), mk('m2', { CM: 7 }), mk('m3', { CM: 5.5 }),
  mk('f1', { ST: 9 }), mk('f2', { ST: 6 }), mk('f3', { ST: 7.5 }), mk('f4', { ST: 5 }),
];
// rng cố định để tái lập
const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

describe('Chia đội nội bộ cân bằng (BRD 15)', () => {
  it('đủ người, không trùng, lệch quân số ≤ 1, mỗi đội 1 thủ môn, tổng sức mạnh gần nhau', () => {
    const byId = new Map(squad.map((p) => [p.id, p]));
    for (let s = 1; s <= 20; s++) {
      const { a, b } = balanceTeams(squad, seeded(s));
      expect([...a, ...b].sort()).toEqual(squad.map((p) => p.id).sort());
      expect(Math.abs(a.length - b.length)).toBeLessThanOrEqual(1);
      const A = summarize(a, byId);
      const B = summarize(b, byId);
      expect(A.lines.GK).toBe(1);
      expect(B.lines.GK).toBe(1);
      expect(Math.abs(A.total - B.total)).toBeLessThan(3);
    }
  });
  it('mỗi lần bấm ra cách chia khác (ngẫu nhiên)', () => {
    const seen = new Set(Array.from({ length: 10 }, (_, s) => balanceTeams(squad, seeded(s + 1)).a.slice().sort().join(',')));
    expect(seen.size).toBeGreaterThan(2);
  });
  it('ít người / không thủ môn vẫn chia được', () => {
    expect(balanceTeams([mk('x', { ST: 7 })])).toMatchObject({ a: expect.any(Array), b: expect.any(Array) });
    const r = balanceTeams(squad.filter((p) => !p.id.startsWith('gk')).slice(0, 5), seeded(3));
    expect(r.a.length + r.b.length).toBe(5);
    expect(strengthOf({ id: 'z', foot: 'Phải', stats: fillStats({}) }).line).toBeDefined();
  });
  it('ĐT tự xếp trước một số người → giữ nguyên, chỉ chia phần còn lại cho cân', () => {
    const byId = new Map(squad.map((p) => [p.id, p]));
    for (let s = 1; s <= 15; s++) {
      const fixed = { a: ['gk1', 'f1'], b: ['m1'] };
      const { a, b } = balanceTeams(squad, seeded(s), fixed);
      expect(a).toEqual(expect.arrayContaining(['gk1', 'f1']));
      expect(b).toContain('m1');
      expect([...a, ...b].sort()).toEqual(squad.map((p) => p.id).sort());
      expect(Math.abs(a.length - b.length)).toBeLessThanOrEqual(1);
      expect(summarize(b, byId).lines.GK).toBe(1); // thủ môn còn lại sang đội B
      expect(Math.abs(summarize(a, byId).total - summarize(b, byId).total)).toBeLessThan(3);
    }
    // người cố định không còn Đi thì bỏ qua
    const r = balanceTeams(squad.slice(2), seeded(2), { a: ['gk1'], b: [] });
    expect([...r.a, ...r.b]).not.toContain('gk1');
  });
  it('chia tiền: tổng = tiền sân + khoản thêm, mặc định chia đều làm tròn lên nghìn; ĐT sửa từng người', () => {
    const total = splitTotal(700000, [{ label: 'Nước', amount: 120000 }, { label: 'Lôi', amount: 50000 }]);
    expect(total).toBe(870000);
    expect(defaultShare(total, 12)).toBe(73000);
    expect(defaultShare(0, 5)).toBe(0);
    expect(sharesOf(['a', 'b', 'c'], 300000, { b: 50000 })).toEqual({ a: 100000, b: 50000, c: 100000 });
  });
  it('thành tích đội không tính trận nội bộ', () => {
    const y = new Date().getFullYear();
    const base = { attendance: {}, events: {}, mvpPlayerId: null, time: '19:00' };
    const ms: SeasonMatch[] = [
      { ...base, id: '1', date: `${y}-03-01`, opponent: 'X', scoreUs: 2, scoreThem: 1 },
      { ...base, id: '2', date: `${y}-03-02`, opponent: 'Nội bộ', scoreUs: 5, scoreThem: 1, internal: true },
    ];
    expect(teamSeason(ms, y)).toMatchObject({ n: 1, w: 1 });
  });
});
