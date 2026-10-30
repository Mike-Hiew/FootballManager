import { describe, expect, it } from 'vitest';
import { prisma } from '@san7/db';
import * as match from '@/server/services/match';
import { CAPTAIN, DOM, ctxFor } from './helpers';

describe('Thông báo tỉ số', () => {
  it('báo cả đội khi nhập / đổi tỉ số, không báo người nhập và không báo khi tỉ số giữ nguyên', async () => {
    const cap = await ctxFor(CAPTAIN, DOM);
    const m = await match.createMatch(cap, { date: '2026-10-02', time: '19:30', opponent: 'Score Test ' + Math.random().toString(36).slice(2, 6), cost: 0 });
    const sent = (text: string) => prisma.notification.findMany({ where: { matchId: m.id, kind: 'result', text: { startsWith: text } } });

    await match.saveResult(cap, m.id, { scoreUs: 2, scoreThem: 1, events: [] });
    const first = await sent('Kết quả');
    expect(first.length).toBeGreaterThan(0);
    expect(first[0].text).toContain('2 - 1');
    expect(first.some((n) => n.userId === cap.user.id)).toBe(false);

    await match.saveResult(cap, m.id, { scoreUs: 2, scoreThem: 1, events: [{ playerId: 'p9', goals: 1, assists: 0 }] });
    expect(await prisma.notification.count({ where: { matchId: m.id, kind: 'result' } })).toBe(first.length);

    await match.saveResult(cap, m.id, { scoreUs: 3, scoreThem: 1, events: [] });
    const update = await sent('Cập nhật tỉ số');
    expect(update.length).toBe(first.length);
    expect(update[0].text).toContain('3 - 1');
  });
});
