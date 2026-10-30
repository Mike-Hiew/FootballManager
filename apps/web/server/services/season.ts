import { prisma } from '@san7/db';
import { leaderboard, seasonTable, shortName, teamSeason } from '@san7/core';
import { emit } from './notify';
import { toSeasonMatch } from './mappers';

/** Chụp ảnh mùa cũ vào season_snapshots + thông báo tổng kết (BRD 9.3). Idempotent theo (team, year). */
export async function snapshotSeason(teamId: string, year: number) {
  const [team, matches, players] = await Promise.all([
    prisma.team.findUniqueOrThrow({ where: { id: teamId } }),
    prisma.match.findMany({ where: { teamId, deletedAt: null, date: { startsWith: String(year) } }, include: { attendance: true, events: true } }),
    prisma.player.findMany({ where: { teamId } }),
  ]);
  const sm = matches.map(toSeasonMatch);
  const s = teamSeason(sm, year);
  const lines = seasonTable(sm, year, players.map((p) => p.id));
  const name = (id?: string) => {
    const p = players.find((x) => x.id === id);
    return p ? shortName(p) : null;
  };
  const top = (k: 'goals' | 'assists' | 'mvp') => {
    const l = leaderboard(lines, k)[0];
    return l ? { playerId: l.playerId, name: name(l.playerId), value: l[k] } : null;
  };
  const data = { year, record: { n: s.n, w: s.w, d: s.d, l: s.l, gf: s.gf, ga: s.ga }, boot: top('goals'), assist: top('assists'), mvp: top('mvp') };
  const created = await prisma.seasonSnapshot.upsert({ where: { teamId_year: { teamId, year } }, create: { teamId, year, data }, update: {} });
  if (created.createdAt.getTime() > Date.now() - 60e3 && s.n) {
    const members = players.filter((p) => p.status === 'active').map((p) => p.userId);
    await emit(prisma, {
      kind: 'season', teamId, recipients: members, view: 'thong-ke',
      text: `Tổng kết mùa ${year} của ${team.name}: ${s.w}T-${s.d}H-${s.l}B${data.boot ? ` · Giày vàng ${data.boot.name} (${data.boot.value} bàn)` : ''}`,
    });
  }
  return data;
}

export async function seasonSnapshots(teamId: string) {
  return prisma.seasonSnapshot.findMany({ where: { teamId }, orderBy: { year: 'desc' } });
}
