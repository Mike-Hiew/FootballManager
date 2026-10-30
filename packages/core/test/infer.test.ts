import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import golden from './__fixtures__/prototype-golden.json';
import { POSITIONS, inferStats, positionScore, type Position } from '../src';

describe('inferStats', () => {
  it('test BRD: {CB 8.2, CDM 7} → CB tính lại trong 8.2 ± 0.3', () => {
    const s = inferStats({ CB: 8.2, CDM: 7 }, 'Phải');
    expect(Math.abs(positionScore(s, 'Phải', 'CB') - 8.2)).toBeLessThanOrEqual(0.3);
  });
  const maxErr = (st: Record<string, number>, r: Record<string, number | undefined>, foot: string) =>
    Math.max(...Object.entries(r).map(([p, v]) => Math.abs(positionScore(st, foot, p as Position) - (v as number))));
  it('khớp prototype khi bản gốc đã trong ±0.3; ca còn lại chỉ được tốt hơn', () => {
    for (const c of golden.inferCases) {
      const mine = inferStats(c.ratings, c.foot);
      const protoErr = maxErr(c.stats, c.ratings, c.foot);
      if (protoErr <= 0.3 + 1e-9) expect(mine).toEqual(c.stats);
      else expect(maxErr(mine, c.ratings, c.foot)).toBeLessThan(protoErr);
    }
  });
  it('mọi vị trí × chân × điểm 3.0–9.8: lệch ≤ 0.3', () => {
    for (const pos of POSITIONS)
      for (const foot of ['Trái', 'Phải', 'Hai chân'])
        for (let r = 30; r <= 98; r += 4) {
          const s = inferStats({ [pos]: r / 10 }, foot);
          expect(Math.abs(positionScore(s, foot, pos) - r / 10)).toBeLessThanOrEqual(0.3 + 1e-9);
        }
  });
  it('hai vị trí: lệch ≤ 0.3', () => {
    for (const c of [{ CB: 8.2, CDM: 7 }, { ST: 9.4, CAM: 8.6 }, { LB: 8, CB: 7.5 }, { CM: 9.2, CDM: 8.8 }] as const) {
      const s = inferStats(c, 'Phải');
      for (const [pos, r] of Object.entries(c)) expect(Math.abs(positionScore(s, 'Phải', pos as Position) - r)).toBeLessThanOrEqual(0.3 + 1e-9);
    }
  });
  it('kết quả bước 0.5 trong [1,10]', () => {
    const s = inferStats({ ST: 9.5, CAM: 8 }, 'Trái');
    for (const v of Object.values(s)) {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(10);
      expect(Number.isInteger(v * 2)).toBe(true);
    }
  });
  it('property: 1–2 vị trí sở trường, điểm tính lại lệch ≤ 0.3', () => {
    const outfield = POSITIONS.filter((p) => p !== 'GK');
    fc.assert(
      fc.property(
        fc.constantFrom(...outfield),
        fc.integer({ min: 30, max: 98 }),
        fc.constantFrom('Trái', 'Phải', 'Hai chân'),
        (pos: Position, r10: number, foot: string) => {
          const rating = r10 / 10;
          const s = inferStats({ [pos]: rating }, foot);
          return Math.abs(positionScore(s, foot, pos) - rating) <= 0.3 + 1e-9;
        },
      ),
      { numRuns: 400 },
    );
  });
});
