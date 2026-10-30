import { prisma } from '@san7/db';
import { currentMonth, seasonYear, tallyVotes } from '@san7/core';
import type { Ctx } from '../authz';
import { canManage } from '../authz';
import type { ApprovalsDTO, MatchDTO, MyTeam, PlayerDTO, TeamView } from '@/lib/types';
import { lineupOf, statsOf } from './mappers';
import { sweepTeamMvp } from './mvp';
import { effectivePayType } from './player';

/**
 * Ảnh chụp dữ liệu đội cho giao diện, lọc theo vai trò (BRD 2, 8.5):
 * khách không thấy SĐT/email/ngày sinh/quỹ/trận sắp tới; thành viên không thấy SĐT;
 * số phiếu MVP khi đang mở chỉ ĐT thấy.
 */
export async function teamView(ctx: Ctx): Promise<TeamView> {
  await sweepTeamMvp(ctx.teamId, ctx.now); // chốt lười (ARCHITECTURE 6.2)
  const manager = canManage(ctx.role);
  const insider = ctx.role !== 'guest';
  const month = currentMonth(ctx.now);
  const [team, players, matches, captains, invite, myEdit, approvalCount, pendingJoins] = await Promise.all([
    prisma.team.findUniqueOrThrow({ where: { id: ctx.teamId } }),
    prisma.player.findMany({ where: { teamId: ctx.teamId }, include: { user: { select: { phone: true } } }, orderBy: [{ num: 'asc' }, { fullName: 'asc' }] }),
    prisma.match.findMany({
      where: { teamId: ctx.teamId, deletedAt: null, ...(insider ? {} : { scoreUs: { not: null } }) },
      include: { attendance: true, events: true, claims: insider, mvpVote: true, ballots: true },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
    }),
    prisma.teamCaptain.findMany({ where: { teamId: ctx.teamId }, include: { user: { select: { name: true, id: true } } } }),
    manager ? prisma.invite.findFirst({ where: { teamId: ctx.teamId, revokedAt: null } }) : null,
    ctx.playerId ? prisma.profileEdit.findFirst({ where: { playerId: ctx.playerId, status: 'pending' }, select: { id: true } }) : null,
    manager ? countApprovals(ctx.teamId) : Promise.resolve(0),
    manager ? prisma.joinRequest.count({ where: { teamId: ctx.teamId, status: 'pending' } }) : Promise.resolve(0),
  ]);

  const toPlayer = (p: (typeof players)[number]): PlayerDTO => ({
    id: p.id, fullName: p.fullName, nick: p.nick, dob: insider ? p.dob : null, avatarUrl: p.avatarUrl, num: p.num, foot: p.foot,
    payType: effectivePayType(p, month), nextPayType: p.payTypeFrom && p.payTypeFrom > month ? p.payType : null,
    stats: statsOf(p.stats), styles: p.styles, isCaptain: p.isCaptain, status: p.status, hasAccount: !!p.userId,
    phone: manager ? (p.user?.phone ?? null) : null,
  });
  const capPlayerNames = captains.map((c) => {
    const pl = players.find((p) => p.userId === c.userId);
    return pl ? pl.nick || pl.fullName : c.user.name;
  });

  const matchDTO = (m: (typeof matches)[number]): MatchDTO => {
    const v = m.mvpVote;
    const tally = tallyVotes(m.ballots.map((b) => b.candidateId));
    return {
      id: m.id, date: m.date, time: m.time, kickoffAt: m.kickoffAt.toISOString(), opponent: m.opponent, venue: m.venue, type: m.type,
      cost: insider ? m.cost : null, fee: insider ? m.fee : null, note: insider ? m.note : null, scoreUs: m.scoreUs, scoreThem: m.scoreThem,
      voteState: (m.voteState as MatchDTO['voteState']) ?? null, formation: m.formation, lineup: m.lineup ? lineupOf(m.lineup) : null,
      mvpPlayerId: m.mvpPlayerId,
      attendance: Object.fromEntries(m.attendance.map((a) => [a.playerId, { status: a.status as 'di' | 'nghi', byCaptain: a.setByCaptain, lePaid: insider ? a.lePaid : false }])),
      events: Object.fromEntries(m.events.map((e) => [e.playerId, { goals: e.goals, assists: e.assists }])),
      claims: insider
        ? (m.claims ?? [])
            .filter((c) => manager || c.playerId === ctx.playerId)
            .map((c) => ({ id: c.id, playerId: c.playerId, goals: c.goals, assists: c.assists, status: c.status }))
        : [],
      mvpVote: v
        ? {
            status: v.status as 'open' | 'done' | 'need', closesAt: v.closesAt.toISOString(), decidedBy: v.decidedBy, ballots: m.ballots.length,
            tally: v.status !== 'open' || manager ? tally : null,
            myBallot: insider ? (m.ballots.find((b) => b.voterId === ctx.playerId)?.candidateId ?? null) : null,
          }
        : null,
    };
  };

  return {
    team: {
      id: team.id, name: team.name, foundedOn: team.foundedOn, slogan: team.slogan, photoUrl: team.photoUrl, awardBootUrl: team.awardBootUrl,
      awardAssistUrl: team.awardAssistUrl, homeName: team.homeName, homeAddress: team.homeAddress, homeMapUrl: team.homeMapUrl,
      homeDays: team.homeDays, homeFrom: team.homeFrom, homeTo: team.homeTo, homeCost: team.homeCost, rules: team.rules,
      formation: team.formation, lineup: lineupOf(team.lineup), monthlyFee: insider ? team.monthlyFee : null,
      perMatchFee: insider ? team.perMatchFee : null, plan: { minutes: team.planMinutes, periods: team.planPeriods, min: team.planMin },
      fullSquad: team.fullSquad, duesReminder: team.duesReminder, captainNames: capPlayerNames, inviteCode: invite?.code ?? null,
    },
    role: ctx.role,
    canEdit: manager,
    myPlayerId: ctx.playerId,
    userId: ctx.user.id,
    players: players.filter((p) => p.status === 'active').map(toPlayer),
    formerPlayers: players.filter((p) => p.status !== 'active').map((p) => ({ id: p.id, fullName: p.fullName, nick: p.nick, num: p.num })),
    matches: matches.map(matchDTO),
    myPendingEdit: !!myEdit,
    approvalCount,
    pendingJoins,
    now: ctx.now.toISOString(),
    year: seasonYear(ctx.now),
  };
}

export async function countApprovals(teamId: string): Promise<number> {
  const [j, e, c, m] = await Promise.all([
    prisma.joinRequest.count({ where: { teamId, status: 'pending' } }),
    prisma.profileEdit.count({ where: { teamId, status: 'pending' } }),
    prisma.claim.count({ where: { status: 'pending', match: { teamId, deletedAt: null } } }),
    prisma.mvpVote.count({ where: { status: 'need', match: { teamId, deletedAt: null } } }),
  ]);
  return j + e + c + m;
}

/** Danh sách việc chờ cho tab Duyệt (BRD 8.6). */
export async function approvals(ctx: Ctx): Promise<ApprovalsDTO> {
  const [joins, edits, claims, need] = await Promise.all([
    prisma.joinRequest.findMany({ where: { teamId: ctx.teamId, status: 'pending' }, orderBy: { createdAt: 'asc' } }),
    prisma.profileEdit.findMany({ where: { teamId: ctx.teamId, status: 'pending' }, orderBy: { createdAt: 'asc' } }),
    prisma.claim.findMany({ where: { status: 'pending', match: { teamId: ctx.teamId, deletedAt: null } }, orderBy: { createdAt: 'asc' } }),
    prisma.mvpVote.findMany({ where: { status: 'need', match: { teamId: ctx.teamId, deletedAt: null } }, select: { matchId: true } }),
  ]);
  return {
    joins: joins.map((j) => ({ id: j.id, createdAt: j.createdAt.toISOString(), phone: j.phone, payload: j.payload as Record<string, unknown> })),
    edits: edits.map((e) => ({ id: e.id, playerId: e.playerId, createdAt: e.createdAt.toISOString(), payload: e.payload as Record<string, unknown> })),
    claims: claims.map((c) => ({ id: c.id, matchId: c.matchId, playerId: c.playerId, goals: c.goals, assists: c.assists, createdAt: c.createdAt.toISOString() })),
    mvpNeed: need.map((n) => n.matchId),
    count: joins.length + edits.length + claims.length + need.length,
  };
}

/** Các đội của người dùng cho dropdown đổi đội. Admin thấy mọi đội. */
export async function myTeams(userId: string, role: string): Promise<MyTeam[]> {
  if (role === 'admin') {
    const all = await prisma.team.findMany({ orderBy: { createdAt: 'asc' }, select: { id: true, name: true, photoUrl: true } });
    return all.map((t) => ({ ...t, role: 'admin' as const }));
  }
  const [caps, players] = await Promise.all([
    prisma.teamCaptain.findMany({ where: { userId }, include: { team: { select: { id: true, name: true, photoUrl: true } } } }),
    prisma.player.findMany({ where: { userId, status: 'active' }, include: { team: { select: { id: true, name: true, photoUrl: true } } } }),
  ]);
  const out = new Map<string, MyTeam>();
  for (const p of players) out.set(p.team.id, { ...p.team, role: 'member' });
  for (const c of caps) out.set(c.team.id, { ...c.team, role: 'captain' });
  return [...out.values()];
}
