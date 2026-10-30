import { describe, expect, it } from 'vitest';
import golden from './__fixtures__/prototype-golden.json';
import { buildPlan, planSummary, subsOf, type PlanPlayer } from '../src';

const goers: PlanPlayer[] = golden.players.map((p) => ({ id: p.id, stats: p.stats, foot: p.foot, payType: p.payType }));
const cfg = { minutes: 80, periods: 4, min: null };

describe('buildPlan', () => {
  it('BRD: 12 người × 4 đợt → maxMin 2, ai cũng ≥ 2, tổng 28 suất', () => {
    const plan = buildPlan(goers, '2-3-1', cfg);
    expect(plan.maxMin).toBe(2);
    expect(plan.info.every((i) => i.t >= 2)).toBe(true);
    expect(plan.info.reduce((a, i) => a + i.t, 0)).toBe(28);
    // đếm suất thực tế trong các đợt
    const count = new Map<string, number>();
    for (const pd of plan.periods) for (const i of pd.assign) if (i) count.set(i.player.id, (count.get(i.player.id) ?? 0) + 1);
    for (const i of plan.info) expect(count.get(i.player.id)).toBe(i.t);
    for (const pd of plan.periods) expect(pd.assign.filter(Boolean)).toHaveLength(7);
  });
  it('phần dư cho xuất sắc trước, rồi quỹ', () => {
    const plan = buildPlan(goers, '2-3-1', cfg);
    const extra = plan.info.filter((i) => i.t > plan.min);
    const rest = plan.info.filter((i) => i.t === plan.min);
    const key = (i: (typeof plan.info)[number]) => (i.ex ? 2 : 0) + (i.quy ? 1 : 0);
    expect(Math.min(...extra.map(key))).toBeGreaterThanOrEqual(Math.max(...rest.map(key)));
    expect(extra.every((i) => i.ex || i.quy)).toBe(true);
  });
  it('N ≤ 7: ai cũng đá đủ P đợt', () => {
    const plan = buildPlan(goers.slice(0, 6), '2-3-1', cfg);
    expect(plan.info.every((i) => i.t === 4)).toBe(true);
    expect(plan.periods[0].assign.filter(Boolean)).toHaveLength(6);
  });
  it('tối thiểu tuỳ chỉnh và 6 đợt', () => {
    const plan = buildPlan(goers, '3-2-1', { minutes: 90, periods: 6, min: 2 });
    expect(plan.min).toBe(2);
    expect(plan.info.reduce((a, i) => a + i.t, 0)).toBe(42);
    expect(plan.info.every((i) => i.t >= 2 && i.t <= 6)).toBe(true);
  });
  it('lệnh thay: số ▲ vào = số người mới', () => {
    const plan = buildPlan(goers, '2-3-1', cfg);
    for (let k = 1; k < plan.P; k++) {
      const a = new Set(plan.periods[k - 1].assign.map((i) => i?.player.id));
      const ins = plan.periods[k].assign.filter((i) => i && !a.has(i.player.id)).length;
      expect(subsOf(plan, k).filter((x) => x.type === 'sub')).toHaveLength(ins);
    }
    expect(planSummary(plan, cfg).everyonePlays).toBe(true);
  });
  it('rỗng khi không ai đi', () => {
    expect(buildPlan([], '2-3-1', cfg).periods).toEqual([]);
  });
  it('< 200 ms với 20 người', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ ...goers[i % 12], id: 'g' + i }));
    const t = performance.now();
    buildPlan(many, '2-3-1', cfg);
    expect(performance.now() - t).toBeLessThan(200);
  });
});
