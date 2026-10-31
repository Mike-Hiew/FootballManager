/**
 * REST API (BRD 9.2). Mọi route gọi chung lớp service với Server Actions; quyền kiểm ở service.
 * 403 sai quyền · 409 trùng · 422 dữ liệu sai.
 */
import { after, type NextRequest } from 'next/server';
import { prisma } from '@san7/db';
import { autoPick, buildPlan, inferStats, seasonTable, teamSeason, type Ratings } from '@san7/core';
import { assertSameOrigin, handle, json } from '@/server/http';
import { requireUser, teamCtx, requireInsider } from '@/server/authz';
import { destroySession, getSession } from '@/server/auth/session';
import { notFound } from '@/server/errors';
import { now } from '@/server/clock';
import * as auth from '@/server/services/auth';
import * as team from '@/server/services/team';
import * as join from '@/server/services/join';
import * as player from '@/server/services/player';
import * as match from '@/server/services/match';
import * as claim from '@/server/services/claim';
import * as postmatch from '@/server/services/postmatch';
import * as statreview from '@/server/services/statreview';
import * as mvp from '@/server/services/mvp';
import * as fund from '@/server/services/fund';
import * as payment from '@/server/services/payment';
import * as tactics from '@/server/services/tactics';
import * as admin from '@/server/services/admin';
import { approvals, teamView } from '@/server/services/view';
import { listNotifications, markAllRead } from '@/server/services/notify';
import { dispatchOutbox, saveSubscription } from '@/server/services/push';
import { toSeasonMatch, statsOf } from '@/server/services/mappers';
import { effectivePayType } from '@/server/services/player';

type Ctx = { req: NextRequest; p: string[]; body: () => Promise<Record<string, unknown>>; q: URLSearchParams };
type H = (c: Ctx) => Promise<unknown>;

const teamOf = {
  match: async (id: string) => (await prisma.match.findUnique({ where: { id }, select: { teamId: true } }))?.teamId ?? notFoundT(),
  player: async (id: string) => (await prisma.player.findUnique({ where: { id }, select: { teamId: true } }))?.teamId ?? notFoundT(),
  join: async (id: string) => (await prisma.joinRequest.findUnique({ where: { id }, select: { teamId: true } }))?.teamId ?? notFoundT(),
  edit: async (id: string) => (await prisma.profileEdit.findUnique({ where: { id }, select: { teamId: true } }))?.teamId ?? notFoundT(),
  payReq: async (id: string) => (await prisma.paymentRequest.findUnique({ where: { id }, select: { teamId: true } }))?.teamId ?? notFoundT(),
  claim: async (id: string) => (await prisma.claim.findUnique({ where: { id }, select: { match: { select: { teamId: true } } } }))?.match.teamId ?? notFoundT(),
};
function notFoundT(): never {
  throw notFound();
}
const tc = (id: string) => teamCtx(id);

/** Bảng route: "METHOD /a/:x/b" */
const routes: Array<[string, H]> = [
  // Auth
  ['POST /auth/register', async ({ body }) => ({ user: pick(await auth.register(await body())) })],
  ['POST /auth/login', async ({ body }) => { const b = await body(); return { user: pick(await auth.login(String(b.identifier ?? b.phone ?? b.email ?? ''), String(b.password ?? ''))) }; }],
  ['POST /auth/logout', async () => { await destroySession(); return { ok: true }; }],
  ['POST /auth/forgot', async ({ body }) => { await auth.forgotPassword(String((await body()).email ?? '')); return { ok: true }; }],
  ['POST /auth/reset', async ({ body }) => { const b = await body(); await auth.resetPassword(String(b.token), String(b.password)); return { ok: true }; }],
  ['GET /me', async () => { const s = await getSession(); if (!s) return json({ user: null }, 401); return { user: s.user, ...(await auth.userHome(s.user.id, s.user.role)) }; }],
  ['GET /me/player', async ({ q }) => { const c = await tc(q.get('teamId') ?? ''); return { playerId: c.playerId, role: c.role }; }],
  ['GET /me/season', async ({ q }) => {
    const c = await tc(q.get('teamId') ?? '');
    if (!c.playerId) return { season: null };
    const ms = await prisma.match.findMany({ where: { teamId: c.teamId, deletedAt: null }, include: { attendance: true, events: true } });
    const year = Number(q.get('year')) || c.now.getFullYear();
    return { season: seasonTable(ms.map(toSeasonMatch), year, [c.playerId])[0] };
  }],

  // Đội
  ['GET /teams', async ({ q }) => ({ teams: await team.exploreTeams(q.get('q') ?? undefined) })],
  ['POST /teams', async ({ body }) => ({ id: (await team.createTeam(await requireUser(), await body())).id })],
  ['GET /teams/check-name', async ({ q }) => ({ taken: await team.isNameTaken(q.get('name') ?? '', q.get('exclude') ?? undefined) })],
  ['GET /teams/:id', async ({ p }) => teamView(await tc(p[0]))],
  ['PATCH /teams/:id', async ({ p, body }) => { await team.updateTeam(await tc(p[0]), await body()); return { ok: true }; }],
  ['POST /teams/:id/invite/rotate', async ({ p }) => ({ code: await team.rotateInvite(await tc(p[0])) })],
  ['GET /teams/:id/dashboard', async ({ p }) => {
    const v = await teamView(await tc(p[0]));
    const sm = v.matches.map((m) => toSeasonMatch({ ...m, attendance: Object.entries(m.attendance).map(([playerId, a]) => ({ playerId, status: a.status })), events: Object.entries(m.events).map(([playerId, e]) => ({ playerId, ...e })) }));
    return { team: v.team, season: teamSeason(sm, v.year), players: seasonTable(sm, v.year, v.players.map((x) => x.id)) };
  }],
  ['GET /teams/:id/season', async ({ p, q }) => {
    const c = await tc(p[0]);
    const year = Number(q.get('year')) || c.now.getFullYear();
    const [ms, ps] = await Promise.all([
      prisma.match.findMany({ where: { teamId: c.teamId, deletedAt: null }, include: { attendance: true, events: true } }),
      prisma.player.findMany({ where: { teamId: c.teamId }, select: { id: true } }),
    ]);
    const sm = ms.map(toSeasonMatch);
    return { year, team: teamSeason(sm, year), players: seasonTable(sm, year, ps.map((x) => x.id)) };
  }],

  // Gia nhập & duyệt
  ['GET /join/:code', async ({ p }) => (await team.inviteInfo(p[0])) ?? notFoundT()],
  ['POST /join/:code', async ({ p, body }) => { const s = await getSession(); return { id: (await join.submitJoin(p[0], await body(), s?.user ?? null)).id }; }],
  ['GET /teams/:id/approvals', async ({ p }) => { const c = await tc(p[0]); if (c.role !== 'admin' && c.role !== 'captain') return json({ error: 'Chỉ đội trưởng mới xem được mục này' }, 403); return approvals(c); }],
  ['POST /join-requests/:id/approve', async ({ p, body }) => join.approveJoin(await tc(await teamOf.join(p[0])), p[0], (await body()).payload)],
  ['POST /join-requests/:id/reject', async ({ p, body }) => { await join.rejectJoin(await tc(await teamOf.join(p[0])), p[0], (await body()).reason as string); return { ok: true }; }],
  ['POST /profile-edits/:id/approve', async ({ p, body }) => { await player.approveProfileEdit(await tc(await teamOf.edit(p[0])), p[0], (await body()).payload); return { ok: true }; }],
  ['POST /profile-edits/:id/reject', async ({ p, body }) => { await player.rejectProfileEdit(await tc(await teamOf.edit(p[0])), p[0], (await body()).reason as string); return { ok: true }; }],
  ['POST /claims/:id/approve', async ({ p }) => { await claim.decideClaim(await tc(await teamOf.claim(p[0])), p[0], true); return { ok: true }; }],
  ['POST /claims/:id/reject', async ({ p }) => { await claim.decideClaim(await tc(await teamOf.claim(p[0])), p[0], false); return { ok: true }; }],

  // Cầu thủ
  ['GET /teams/:id/players', async ({ p }) => ({ players: (await teamView(await tc(p[0]))).players })],
  ['POST /teams/:id/players', async ({ p, body }) => player.createPlayer(await tc(p[0]), await body())],
  ['PATCH /players/:id', async ({ p, body }) => player.updatePlayer(await tc(await teamOf.player(p[0])), p[0], await body())],
  ['DELETE /players/:id', async ({ p }) => player.removePlayer(await tc(await teamOf.player(p[0])), p[0])],
  ['POST /players/:id/edit-request', async ({ p, body }) => { await player.submitProfileEdit(await tc(await teamOf.player(p[0])), await body()); return { ok: true }; }],
  ['POST /stats/infer', async ({ body }) => { const b = await body(); return { stats: inferStats((b.ratings ?? {}) as Ratings, String(b.foot ?? 'Phải')) }; }],

  // Chiến thuật
  ['PUT /teams/:id/lineup', async ({ p, body }) => ({ lineup: await tactics.saveLineup(await tc(p[0]), await body()) })],
  ['PUT /matches/:id/lineup', async ({ p, body }) => ({ lineup: await tactics.saveLineup(await tc(await teamOf.match(p[0])), await body(), p[0]) })],
  ['POST /teams/:id/auto-pick', async ({ p, body }) => {
    const c = await tc(p[0]);
    const b = await body();
    const ps = await prisma.player.findMany({ where: { teamId: c.teamId, status: 'active' } });
    const lineup = autoPick(ps.map((x) => ({ id: x.id, stats: statsOf(x.stats), foot: x.foot })), String(b.formation ?? '2-3-1'));
    return { lineup };
  }],
  ['GET /matches/:id/plan', async ({ p, q }) => {
    const c = await tc(await teamOf.match(p[0]));
    requireInsider(c);
    const [m, t] = await Promise.all([
      prisma.match.findUniqueOrThrow({ where: { id: p[0] }, include: { attendance: { where: { status: 'di' }, include: { player: true } } } }),
      prisma.team.findUniqueOrThrow({ where: { id: c.teamId } }),
    ]);
    const month = m.date.slice(0, 7);
    const goers = m.attendance.map((a) => ({ id: a.playerId, stats: statsOf(a.player.stats), foot: a.player.foot, payType: effectivePayType(a.player, month) }));
    const cfg = { minutes: Number(q.get('minutes')) || t.planMinutes, periods: Number(q.get('periods')) || t.planPeriods, min: q.get('min') ? Number(q.get('min')) : t.planMin };
    const plan = buildPlan(goers, m.formation ?? t.formation, cfg);
    return { cfg, N: plan.N, min: plan.min, maxMin: plan.maxMin, slots: plan.slots, players: plan.info.map((i) => ({ id: i.player.id, ex: i.ex, quy: i.quy, periods: i.t })), periods: plan.periods.map((pd) => ({ avg: pd.avg, lineup: pd.assign.map((i) => i?.player.id ?? null) })) };
  }],

  // Trận
  ['GET /teams/:id/matches', async ({ p }) => ({ matches: (await teamView(await tc(p[0]))).matches })],
  ['POST /teams/:id/matches', async ({ p, body }) => ({ id: (await match.createMatch(await tc(p[0]), await body())).id })],
  ['PATCH /matches/:id', async ({ p, body }) => ({ id: (await match.updateMatch(await tc(await teamOf.match(p[0])), p[0], await body())).id })],
  ['DELETE /matches/:id', async ({ p }) => { await match.deleteMatch(await tc(await teamOf.match(p[0])), p[0]); return { ok: true }; }],
  ['PUT /matches/:id/score', async ({ p, body }) => match.saveResult(await tc(await teamOf.match(p[0])), p[0], await body())],
  ['PUT /matches/:id/events', async ({ p, body }) => {
    const c = await tc(await teamOf.match(p[0]));
    const m = await match.getMatch(c, p[0]);
    return match.saveResult(c, p[0], { scoreUs: m.scoreUs, scoreThem: m.scoreThem, events: (await body()).events });
  }],
  ['POST /matches/:id/vote/open', async ({ p }) => { await match.setVoteState(await tc(await teamOf.match(p[0])), p[0], 'open'); return { ok: true }; }],
  ['POST /matches/:id/vote/close', async ({ p }) => { await match.setVoteState(await tc(await teamOf.match(p[0])), p[0], 'closed'); return { ok: true }; }],
  ['POST /matches/:id/vote/remind', async ({ p }) => ({ reminded: await match.remindVote(await tc(await teamOf.match(p[0])), p[0]) })],
  ['PUT /matches/:id/attendance/:playerId', async ({ p, body }) => { await match.setAttendance(await tc(await teamOf.match(p[0])), p[0], p[1], await body()); return { ok: true }; }],
  ['POST /matches/:id/claims', async ({ p, body }) => { await claim.submitClaim(await tc(await teamOf.match(p[0])), p[0], await body()); return { ok: true }; }],
  ['PUT /profile-edits/:id/vote', async ({ p, body }) => { await statreview.castStatVote(await tc(await teamOf.edit(p[0])), p[0], (await body()).stats); return { ok: true }; }],
  ['POST /profile-edits/:id/remind', async ({ p, body }) => ({ reminded: await statreview.remindReview(await tc(await teamOf.edit(p[0])), p[0], (await body()).playerId as string | undefined) })],
  ['POST /players/:id/request-review', async ({ p }) => ({ notified: await statreview.requestReview(await tc(await teamOf.player(p[0])), p[0]) })],
  ['POST /players/:id/remind-update', async ({ p }) => ({ notified: await statreview.remindUpdateStats(await tc(await teamOf.player(p[0])), p[0]) })],
  ['POST /matches/:id/result-seen', async ({ p }) => { await postmatch.markResultSeen(await tc(await teamOf.match(p[0])), p[0]); return { ok: true }; }],
  ['POST /matches/:id/claim-skip', async ({ p }) => { await postmatch.skipClaim(await tc(await teamOf.match(p[0])), p[0]); return { ok: true }; }],
  ['POST /matches/:id/mvp/open', async ({ p }) => { await mvp.openMvp(await tc(await teamOf.match(p[0])), p[0]); return { ok: true }; }],
  ['PUT /matches/:id/mvp/ballot', async ({ p, body }) => { await mvp.castBallot(await tc(await teamOf.match(p[0])), p[0], String((await body()).candidateId)); return { ok: true }; }],
  ['PUT /matches/:id/mvp', async ({ p, body }) => { await mvp.assignMvp(await tc(await teamOf.match(p[0])), p[0], String((await body()).playerId)); return { ok: true }; }],

  // Quỹ
  ['GET /teams/:id/fund', async ({ p }) => fund.fundView(await tc(p[0]))],
  ['PUT /teams/:id/fund/fees', async ({ p, body }) => { await fund.setFees(await tc(p[0]), await body()); return { ok: true }; }],
  ['PUT /teams/:id/dues/:month/:playerId', async ({ p, body }) => { await fund.setDues(await tc(p[0]), p[1], p[2], (await body()).paid !== false); return { ok: true }; }],
  ['PUT /matches/:id/le-paid/:playerId', async ({ p, body }) => { await fund.setLePaid(await tc(await teamOf.match(p[0])), p[0], p[1], (await body()).paid !== false); return { ok: true }; }],
  ['POST /teams/:id/fund/entries', async ({ p, body }) => ({ id: (await fund.addManualEntry(await tc(p[0]), await body())).id })],
  ['DELETE /teams/:id/fund/entries/:entryId', async ({ p }) => { await fund.deleteManualEntry(await tc(p[0]), p[1]); return { ok: true }; }],

  ['GET /version', async () => ({ version: process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev' })],

  // Yêu cầu đóng tiền
  ['POST /teams/:id/payment-requests', async ({ p, body }) => payment.requestDues(await tc(p[0]), await body())],
  ['POST /matches/:id/payment-request', async ({ p, body }) => payment.requestLe(await tc(await teamOf.match(p[0])), p[0], await body())],
  ['POST /payment-requests/:id/remind', async ({ p }) => ({ sent: await payment.remindRequest(await tc(await teamOf.payReq(p[0])), p[0]) })],
  ['POST /payment-requests/:id/declare', async ({ p }) => { await payment.declarePaid(await tc(await teamOf.payReq(p[0])), p[0]); return { ok: true }; }],
  ['POST /payment-requests/:id/notices/:playerId/confirm', async ({ p }) => { await payment.decidePayment(await tc(await teamOf.payReq(p[0])), p[0], p[1], true); return { ok: true }; }],
  ['POST /payment-requests/:id/notices/:playerId/reject', async ({ p }) => { await payment.decidePayment(await tc(await teamOf.payReq(p[0])), p[0], p[1], false); return { ok: true }; }],

  // Thông báo
  ['GET /notifications', async () => listNotifications((await requireUser()).id)],
  ['POST /notifications/read-all', async () => { await markAllRead((await requireUser()).id, now()); return { ok: true }; }],
  ['POST /push/subscribe', async ({ body }) => { await saveSubscription((await requireUser()).id, (await body()) as never); return { ok: true }; }],

  // Admin
  ['GET /admin/users', async () => ({ users: (await admin.adminOverview(await requireUser(), now())).users })],
  ['GET /admin/teams', async () => ({ teams: (await admin.adminOverview(await requireUser(), now())).teams })],
  ['PATCH /admin/users/:id', async ({ p, body }) => {
    const b = await body();
    const u = await requireUser();
    if (b.resetPassword) return { tempPassword: await admin.resetUserPassword(u, p[0]) };
    await admin.setUserDisabled(u, p[0], !!b.disabled, now());
    return { ok: true };
  }],
  ['PATCH /admin/teams/:id', async ({ p, body }) => {
    const b = await body();
    const u = await requireUser();
    if (typeof b.hidden === 'boolean') await admin.setTeamHidden(u, p[0], b.hidden);
    if (typeof b.captainUserId === 'string') await admin.transferCaptain(u, p[0], b.captainUserId);
    return { ok: true };
  }],
];

const pick = (u: { id: string; name: string; phone: string; email: string | null; role: string }) => ({ id: u.id, name: u.name, phone: u.phone, email: u.email, role: u.role });

const compiled = routes.map(([spec, h]) => {
  const [method, path] = spec.split(' ');
  const parts = path.split('/').filter(Boolean);
  return { method, parts, h };
});

async function dispatch(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return handle(async () => {
    assertSameOrigin(req);
    const { path } = await params;
    for (const r of compiled) {
      if (r.method !== req.method || r.parts.length !== path.length) continue;
      const vals: string[] = [];
      if (!r.parts.every((s, i) => (s.startsWith(':') ? (vals.push(decodeURIComponent(path[i])), true) : s === path[i]))) continue;
      let cached: Record<string, unknown> | null = null;
      // Ghi có thể sinh thông báo (outbox): đẩy Web Push sau khi phản hồi, như Server Actions.
      if (req.method !== 'GET') after(() => dispatchOutbox(50).catch((e) => console.error('push', e)));
      return r.h({
        req,
        p: vals,
        q: req.nextUrl.searchParams,
        body: async () => (cached ??= ((await req.json().catch(() => ({}))) as Record<string, unknown>) ?? {}),
      });
    }
    return json({ error: 'Không tìm thấy API' }, 404);
  });
}

export { dispatch as GET, dispatch as POST, dispatch as PUT, dispatch as PATCH, dispatch as DELETE };
