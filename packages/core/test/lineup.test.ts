import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import golden from './__fixtures__/prototype-golden.json';
import {
  autoPick, autoPickGreedy, changeFormation, cleanLineup, FORMATION_IDS, hungarian, isNatural, lineupSummary, placeInLineup, POSITIONS, rankedPositions, ratingsSchema,
  positionScore, removeFromLineup, slotGlow, slotPositions, suggestForPosition, STAT_KEYS, swapSlots,
  type LineupPlayer, type Position, type Stats,
} from '../src';

const players = golden.players.map((p) => ({ ...p, stats: p.stats as Stats, styles: [] as string[], name: p.nick }));
const total = (f: string, lu: Array<string | null>) =>
  slotPositions(f).reduce((a, pos, i) => {
    const p = players.find((x) => x.id === lu[i]);
    return a + (p ? positionScore(p.stats, p.foot, pos) : 0);
  }, 0);

describe('hungarian', () => {
  it('gán tối ưu ma trận nhỏ', () => {
    expect(hungarian([[4, 1, 3], [2, 0, 5], [3, 2, 2]])).toEqual([1, 0, 2]);
  });
  it('ma trận chữ nhật n < m', () => {
    const a = hungarian([[1, 9, 9, 0], [9, 1, 9, 9]]);
    expect(a).toEqual([3, 1]);
  });
});

describe('autoPick', () => {
  it('đủ 7 người, không trùng, GK là Hùng Gôn', () => {
    const lu = autoPick(players, '2-3-1');
    expect(lu.filter(Boolean)).toHaveLength(7);
    expect(new Set(lu).size).toBe(7);
    expect(lu[0]).toBe('p1');
  });
  it('không tệ hơn bản tham lam (property)', () => {
    const statArb = fc.record(Object.fromEntries(STAT_KEYS.map((k) => [k, fc.integer({ min: 2, max: 20 }).map((x) => x / 2)])) as never);
    fc.assert(
      fc.property(
        fc.array(statArb, { minLength: 3, maxLength: 14 }) as fc.Arbitrary<Stats[]>,
        fc.constantFrom('2-3-1', '3-2-1', '2-1-2-1', '3-1-2', '2-2-2'),
        (stats: Stats[], f: string) => {
          const ps = stats.map((s, i) => ({ id: 'x' + i, stats: s, foot: i % 2 ? 'Trái' : 'Phải' }));
          const score = (lu: Array<string | null>) =>
            slotPositions(f).reduce((a, pos, i) => {
              const p = ps.find((x) => x.id === lu[i]);
              return a + (p ? positionScore(p.stats, p.foot, pos) : 0);
            }, 0);
          return score(autoPick(ps, f)) >= score(autoPickGreedy(ps, f)) - 1e-9;
        },
      ),
      { numRuns: 300 },
    );
  });
  it('thiếu người thì để trống, vẫn ưu tiên đúng', () => {
    const lu = autoPick(players.slice(0, 3), '2-3-1');
    expect(lu.filter(Boolean)).toHaveLength(3);
    expect(lu).toHaveLength(7);
  });
  it('< 1 ms với 30 người (trung bình)', () => {
    const ps = Array.from({ length: 30 }, (_, i) => ({ ...players[i % 12], id: 'z' + i }));
    const t = performance.now();
    for (let i = 0; i < 50; i++) autoPick(ps, '2-3-1');
    expect((performance.now() - t) / 50).toBeLessThan(5);
  });
  it('tổng điểm ≥ tham lam trên dữ liệu mẫu', () => {
    expect(total('2-3-1', autoPick(players, '2-3-1'))).toBeGreaterThanOrEqual(total('2-3-1', autoPickGreedy(players, '2-3-1')));
  });
});

describe('thao tác đội hình', () => {
  it('đặt vào slot trống, hoán đổi khi có người', () => {
    let lu = cleanLineup([], []);
    lu = placeInLineup(lu, 'a', 2);
    lu = placeInLineup(lu, 'b', 3);
    expect(placeInLineup(lu, 'a', 3).slice(2, 4)).toEqual(['b', 'a']);
    expect(swapSlots(lu, 2, 3).slice(2, 4)).toEqual(['b', 'a']);
    expect(removeFromLineup(lu, 'a')[2]).toBeNull();
  });
  it('cleanLineup bỏ id lạ và trùng', () => {
    expect(cleanLineup(['a', 'a', 'zz', null], ['a'])).toEqual(['a', null, null, null, null, null, null]);
  });
  it('đổi sơ đồ giữ người cùng vị trí', () => {
    const lu = autoPick(players, '2-3-1');
    const sc = (id: string, pos: Position) => {
      const p = players.find((x) => x.id === id)!;
      return positionScore(p.stats, p.foot, pos);
    };
    const nl = changeFormation('2-3-1', lu, '3-2-1', sc);
    expect(nl[0]).toBe(lu[0]);
    expect(nl[2]).toBe(lu[1]); // CB đầu tiên
    expect(nl[6]).toBe(lu[6]); // ST
    expect(nl.filter(Boolean)).toHaveLength(7);
  });
});

describe('gợi ý & highlight', () => {
  it('top 3 cho slot theo điểm giảm dần, ≥ 6.5', () => {
    const s = suggestForPosition(players, 'ST');
    expect(s.length).toBeLessThanOrEqual(3);
    expect(s[0].player.nick).toBe('Quang Còi');
    for (let i = 1; i < s.length; i++) expect(s[i - 1].score).toBeGreaterThanOrEqual(s[i].score);
  });
  it('slotGlow bỏ slot người đó đang đứng', () => {
    const lu = autoPick(players, '2-3-1');
    const p = players.find((x) => x.id === lu[4])!;
    const g = slotGlow('2-3-1', lu, p);
    expect(4 in g.glow).toBe(false);
    expect(Object.keys(g.glow)).toHaveLength(6);
  });
  it('lineupSummary đếm đúng và cảnh báo người chưa xác nhận', () => {
    const map = new Map<string, LineupPlayer>(players.map((p) => [p.id, { ...p, isCaptain: p.id === 'p2' }]));
    const lu = autoPick(players, '2-3-1');
    const s = lineupSummary('2-3-1', lu, map, new Set(lu.slice(1) as string[]));
    expect(s.filled).toBe(7);
    expect(s.tips.join(' ')).toContain('chưa xác nhận đi');
    const empty = lineupSummary('2-3-1', cleanLineup([], []), map);
    expect(empty.avg).toBeNull();
    expect(empty.tips).toContain('Chưa có thủ môn.');
  });
});

describe('vị trí sân 7', () => {
  it('mọi sơ đồ chỉ dùng GK/CB/LB/RB/CM/ST, slot 0 là GK', () => {
    for (const f of FORMATION_IDS) {
      const ps = slotPositions(f);
      expect(ps[0]).toBe('GK');
      for (const p of ps) expect(POSITIONS).toContain(p);
    }
    expect(slotPositions('2-3-1')).toEqual(['GK', 'CB', 'CB', 'CM', 'CM', 'CM', 'ST']);
    expect(slotPositions('2-1-2-1')).toEqual(['GK', 'CB', 'CB', 'CM', 'CM', 'CM', 'ST']);
  });
  it('đúng sở trường = top 2 vị trí của người đó', () => {
    for (const p of players) {
      const rk = rankedPositions(p.stats, p.foot).map(([k]) => k);
      expect(isNatural(p, rk[0])).toBe(true);
      expect(isNatural(p, rk[1])).toBe(true);
      expect(isNatural(p, rk[2])).toBe(false);
    }
  });
  it('điểm tự chấm cũ có vị trí đã bỏ (CDM/LM/RM/CAM) → bỏ qua, không báo lỗi', () => {
    expect(ratingsSchema.parse({ CB: 8, CDM: 7, CAM: 6.5 })).toEqual({ CB: 8 });
    expect(ratingsSchema.safeParse({ CB: 11 }).success).toBe(false);
  });
});
