import type { AttStatus, SeasonMatch, Stats } from '@san7/core';
import { fillStats } from '@san7/core';

interface MatchRow {
  id: string;
  date: string;
  time: string | null;
  opponent: string;
  scoreUs: number | null;
  scoreThem: number | null;
  mvpPlayerId: string | null;
  attendance: Array<{ playerId: string; status: string }>;
  events: Array<{ playerId: string; goals: number; assists: number }>;
}

export function toSeasonMatch(m: MatchRow): SeasonMatch {
  return {
    id: m.id,
    date: m.date,
    time: m.time,
    opponent: m.opponent,
    scoreUs: m.scoreUs,
    scoreThem: m.scoreThem,
    mvpPlayerId: m.mvpPlayerId,
    attendance: Object.fromEntries(m.attendance.map((a) => [a.playerId, a.status as AttStatus])),
    events: Object.fromEntries(m.events.map((e) => [e.playerId, { goals: e.goals, assists: e.assists }])),
  };
}

export const statsOf = (j: unknown): Stats => fillStats((j ?? {}) as Record<string, number>);
export const lineupOf = (j: unknown): Array<string | null> => (Array.isArray(j) ? (j as Array<string | null>) : []);
