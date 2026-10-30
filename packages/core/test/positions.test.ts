import { describe, expect, it } from 'vitest';
import golden from './__fixtures__/prototype-golden.json';
import {
  POSITIONS, WEIGHTS, allScores, explain, footAdj, positionScore, rankedPositions, scoreTier,
  faceStats, suggestStyles, fillStats, type Stats,
} from '../src';

const byNick = (n: string) => golden.players.find((p) => p.nick === n)!;

describe('trọng số', () => {
  it('mỗi vị trí tổng = 100', () => {
    for (const p of POSITIONS) expect(Object.values(WEIGHTS[p]).reduce((a, b) => a + b!, 0)).toBe(100);
  });
  it('RB dùng của LB', () => {
    expect(WEIGHTS.RB).toEqual(WEIGHTS.LB);
  });
  it('chỉ còn vị trí của sân 7', () => {
    expect([...POSITIONS]).toEqual(['GK', 'CB', 'LB', 'RB', 'CM', 'ST']);
  });
});

describe('positionScore', () => {
  it('test bắt buộc BRD 4.3 (± 0.05)', () => {
    const k = byNick('Khánh Mười');
    const h = byNick('Hùng Gôn');
    const q = byNick('Quang Còi');
    expect(positionScore(k.stats, k.foot, 'CM')).toBeCloseTo(7.9, 1);
    expect(positionScore(h.stats, h.foot, 'GK')).toBeCloseTo(8.3, 1);
    expect(positionScore(q.stats, q.foot, 'ST')).toBeCloseTo(8.0, 1);
  });
  it('khớp prototype cho 12 cầu thủ × 6 vị trí', () => {
    for (const p of golden.players) {
      const s = allScores(p.stats, p.foot);
      for (const pos of POSITIONS) expect(Math.abs(s[pos] - (p.scores as Record<string, number>)[pos])).toBeLessThanOrEqual(0.05);
    }
  });
  it('chỉ số thiếu mặc định 5, kẹp trong [1,10]', () => {
    expect(positionScore({}, 'Phải', 'CM')).toBe(5);
    expect(positionScore(fillStats({}), 'Phải', 'LB')).toBe(4.7);
    const max = fillStats(Object.fromEntries(Object.keys(fillStats({})).map((k) => [k, 10])));
    expect(positionScore(max, 'Trái', 'LB')).toBe(10);
  });
  it('chân thuận chỉ ảnh hưởng vị trí biên', () => {
    expect(footAdj('Trái', 'LB')).toBe(0.3);
    expect(footAdj('Phải', 'LB')).toBe(-0.3);
    expect(footAdj('Hai chân', 'RB')).toBe(0.2);
    expect(footAdj('Trái', 'CM')).toBe(0);
  });
});

describe('explain', () => {
  it('sắp theo trọng số giảm dần và cộng đúng ra điểm', () => {
    const k = byNick('Khánh Mười');
    const e = explain(k.stats, k.foot, 'LB');
    const ws = e.rows.map((r) => r.weight);
    expect([...ws].sort((a, b) => b - a)).toEqual(ws);
    const sum = e.rows.reduce((a, r) => a + r.contribution, 0) + e.footAdj;
    expect(Math.round(sum * 10) / 10).toBe(e.score);
    expect(e.footAdj).toBe(0.3);
  });
});

describe('tiện ích', () => {
  it('scoreTier theo ngưỡng', () => {
    expect(scoreTier(8)).toBe('good');
    expect(scoreTier(7.9)).toBe('ok');
    expect(scoreTier(6.5)).toBe('ok');
    expect(scoreTier(6.4)).toBe('bad');
  });
  it('rankedPositions: Hùng Gôn tốt nhất GK', () => {
    const h = byNick('Hùng Gôn');
    expect(rankedPositions(h.stats, h.foot)[0][0]).toBe('GK');
  });
  it('faceStats theo công thức BRD 4.2', () => {
    const q = byNick('Quang Còi').stats as Stats;
    const f = Object.fromEntries(faceStats(q).map((x) => [x.label, x.value]));
    expect(f['Sút']).toBeCloseTo(0.5 * q.FIN + 0.35 * q.SHO + 0.15 * q.ATP);
    expect(f['Thể chất']).toBeCloseTo(0.45 * q.STA + 0.4 * q.STR + 0.15 * q.HEA);
  });
  it('suggestStyles theo ngưỡng', () => {
    const s = fillStats({ PAC: 8.5, FIN: 8.5, REF: 8.5, HAN: 6, LPA: 7, PAS: 7 });
    const t = suggestStyles(s);
    expect(t).toEqual(expect.arrayContaining(['Tốc độ', 'Dứt điểm', 'Phản xạ (TM)', 'Phát động (TM)']));
    expect(t).not.toContain('Thủ lĩnh');
    expect(suggestStyles(fillStats({ LPA: 7.5 }))).not.toContain('Chuyền dài');
  });
});
