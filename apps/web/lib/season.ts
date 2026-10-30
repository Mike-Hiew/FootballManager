import { mvpCounts, playerSeason, seasonTable, type SeasonMatch } from '@san7/core';
import type { MatchDTO } from './types';

export const toSeason = (m: MatchDTO): SeasonMatch => ({
  id: m.id,
  date: m.date,
  time: m.time,
  opponent: m.opponent,
  scoreUs: m.scoreUs,
  scoreThem: m.scoreThem,
  mvpPlayerId: m.mvpPlayerId,
  attendance: Object.fromEntries(Object.entries(m.attendance).map(([k, a]) => [k, a.status])),
  events: m.events,
});

export const seasonOf = (ms: MatchDTO[]) => ms.map(toSeason);
export { mvpCounts, playerSeason, seasonTable };

/** Trận "đã qua" = có tỉ số hoặc ngày đá < hôm nay (BRD 6). */
export const isPlayed = (m: Pick<MatchDTO, 'scoreUs'>) => m.scoreUs != null;
export const isSettled = (m: Pick<MatchDTO, 'scoreUs' | 'date'>, today: string) => m.scoreUs != null || m.date < today;
export const goingIds = (m: MatchDTO) => Object.entries(m.attendance).filter(([, a]) => a.status === 'di').map(([k]) => k);
export const byKick = (a: MatchDTO, b: MatchDTO) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''));
