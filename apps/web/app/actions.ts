'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { redirect } from 'next/navigation';
import { inferStats, type Foot, type Ratings, type Stats } from '@san7/core';
import { run } from '@/server/result';
import { requireUser, teamCtx } from '@/server/authz';
import { destroySession, rememberTeam } from '@/server/auth/session';
import * as auth from '@/server/services/auth';
import * as team from '@/server/services/team';
import * as join from '@/server/services/join';
import * as player from '@/server/services/player';
import * as match from '@/server/services/match';
import * as claim from '@/server/services/claim';
import * as postmatch from '@/server/services/postmatch';
import * as mvp from '@/server/services/mvp';
import * as fund from '@/server/services/fund';
import * as payment from '@/server/services/payment';
import * as tactics from '@/server/services/tactics';
import * as admin from '@/server/services/admin';
import { listNotifications, markAllRead } from '@/server/services/notify';
import { dispatchOutbox, saveSubscription } from '@/server/services/push';
import { now } from '@/server/clock';
import { prisma } from '@san7/db';

const refresh = (teamId: string) => revalidatePath(`/t/${teamId}`, 'layout');
const inTeam = async <T>(teamId: string, fn: (ctx: Awaited<ReturnType<typeof teamCtx>>) => Promise<T>) => {
  const r = await fn(await teamCtx(teamId));
  refresh(teamId);
  // Outbox: đẩy Web Push sau khi phản hồi xong (ARCHITECTURE 6.3); job tick quét lại phần sót.
  after(() => dispatchOutbox(50).catch((e) => console.error('push', e)));
  return r;
};

/* ---------- Auth ---------- */
export async function loginAction(identifier: string, password: string) {
  return run(async () => {
    await auth.login(identifier, password);
    return null;
  });
}
export async function registerAction(input: unknown) {
  return run(async () => {
    await auth.register(input);
    return null;
  });
}
export async function logoutAction() {
  await destroySession();
  redirect('/dang-nhap');
}
export async function forgotAction(email: string) {
  return run(() => auth.forgotPassword(email));
}
export async function resetAction(token: string, password: string) {
  return run(() => auth.resetPassword(token, password));
}

/* ---------- Đội ---------- */
export async function checkTeamNameAction(name: string, excludeTeamId?: string) {
  return team.isNameTaken(name, excludeTeamId);
}
export async function createTeamAction(input: unknown) {
  return run(async () => {
    const user = await requireUser();
    const t = await team.createTeam(user, input);
    await rememberTeam(t.id);
    return t.id;
  });
}
export async function updateTeamAction(teamId: string, input: unknown) {
  return run(() => inTeam(teamId, (c) => team.updateTeam(c, input).then(() => null)));
}
export async function rotateInviteAction(teamId: string) {
  return run(() => inTeam(teamId, (c) => team.rotateInvite(c)));
}
export async function selectTeamAction(teamId: string) {
  await rememberTeam(teamId);
}

/* ---------- Gia nhập & duyệt ---------- */
export async function submitJoinAction(code: string, input: unknown) {
  return run(async () => {
    const user = await requireUser().catch(() => null);
    await join.submitJoin(code, input, user);
    after(() => dispatchOutbox(50).catch((e) => console.error('push', e)));
    return null;
  });
}
export async function approveJoinAction(teamId: string, id: string, edited?: unknown) {
  return run(() => inTeam(teamId, (c) => join.approveJoin(c, id, edited)), (d) => d.warning);
}
export async function rejectJoinAction(teamId: string, id: string, reason?: string) {
  return run(() => inTeam(teamId, (c) => join.rejectJoin(c, id, reason).then(() => null)));
}

/* ---------- Cầu thủ ---------- */
export async function inferStatsAction(ratings: Ratings, foot: Foot): Promise<Stats> {
  return inferStats(ratings, foot);
}
export async function savePlayerAction(teamId: string, playerId: string | null, input: unknown) {
  return run(
    () => inTeam(teamId, (c) => (playerId ? player.updatePlayer(c, playerId, input) : player.createPlayer(c, input)).then((r) => ({ id: r.player.id, warning: r.warning }))),
    (d) => d.warning,
  );
}
export async function removePlayerAction(teamId: string, playerId: string) {
  return run(() => inTeam(teamId, (c) => player.removePlayer(c, playerId)));
}
export async function submitProfileEditAction(teamId: string, input: unknown) {
  return run(() => inTeam(teamId, (c) => player.submitProfileEdit(c, input).then(() => null)));
}
export async function approveEditAction(teamId: string, id: string, edited?: unknown) {
  return run(() => inTeam(teamId, (c) => player.approveProfileEdit(c, id, edited).then(() => null)));
}
export async function rejectEditAction(teamId: string, id: string, reason?: string) {
  return run(() => inTeam(teamId, (c) => player.rejectProfileEdit(c, id, reason).then(() => null)));
}

/* ---------- Chiến thuật ---------- */
export async function saveLineupAction(teamId: string, input: { formation: string; lineup: Array<string | null> }, matchId?: string | null) {
  return run(() => inTeam(teamId, (c) => tactics.saveLineup(c, input, matchId)));
}
export async function savePlanConfigAction(teamId: string, input: { minutes: number; periods: number; min: number | null }) {
  return run(() => inTeam(teamId, (c) => tactics.savePlanConfig(c, input).then(() => null)));
}

/* ---------- Trận ---------- */
export async function saveMatchAction(teamId: string, matchId: string | null, input: unknown) {
  return run(() => inTeam(teamId, (c) => (matchId ? match.updateMatch(c, matchId, input) : match.createMatch(c, input)).then((m) => m.id)));
}
export async function deleteMatchAction(teamId: string, matchId: string) {
  return run(() => inTeam(teamId, (c) => match.deleteMatch(c, matchId).then(() => null)));
}
export async function saveResultAction(teamId: string, matchId: string, input: unknown) {
  return run(() => inTeam(teamId, (c) => match.saveResult(c, matchId, input)), (d) => d.warnings.join('. ') || null);
}
export async function setVoteStateAction(teamId: string, matchId: string, state: 'open' | 'closed') {
  return run(() => inTeam(teamId, (c) => match.setVoteState(c, matchId, state).then(() => null)));
}
export async function remindVoteAction(teamId: string, matchId: string) {
  return run(() => inTeam(teamId, (c) => match.remindVote(c, matchId)));
}
export async function setAttendanceAction(teamId: string, matchId: string, playerId: string, status: 'di' | 'nghi' | null) {
  return run(() => inTeam(teamId, (c) => match.setAttendance(c, matchId, playerId, { status }).then(() => null)));
}
export async function setLePaidAction(teamId: string, matchId: string, playerId: string, paid: boolean) {
  return run(() => inTeam(teamId, (c) => fund.setLePaid(c, matchId, playerId, paid).then(() => null)));
}
export async function submitClaimAction(teamId: string, matchId: string, goals: number, assists: number) {
  return run(() => inTeam(teamId, (c) => claim.submitClaim(c, matchId, { goals, assists }).then(() => null)));
}
export async function markResultSeenAction(teamId: string, matchId: string) {
  return run(() => inTeam(teamId, (c) => postmatch.markResultSeen(c, matchId).then(() => null)));
}
export async function skipClaimAction(teamId: string, matchId: string) {
  return run(() => inTeam(teamId, (c) => postmatch.skipClaim(c, matchId).then(() => null)));
}
export async function decideClaimAction(teamId: string, claimId: string, approve: boolean) {
  return run(() => inTeam(teamId, (c) => claim.decideClaim(c, claimId, approve).then(() => null)));
}
export async function openMvpAction(teamId: string, matchId: string) {
  return run(() => inTeam(teamId, (c) => mvp.openMvp(c, matchId).then(() => null)));
}
export async function castBallotAction(teamId: string, matchId: string, candidateId: string) {
  return run(() => inTeam(teamId, (c) => mvp.castBallot(c, matchId, candidateId).then(() => null)));
}
export async function assignMvpAction(teamId: string, matchId: string, playerId: string) {
  return run(() => inTeam(teamId, (c) => mvp.assignMvp(c, matchId, playerId).then(() => null)));
}

/* ---------- Quỹ ---------- */
export async function setFeesAction(teamId: string, monthlyFee: number, perMatchFee: number) {
  return run(() => inTeam(teamId, (c) => fund.setFees(c, { monthlyFee, perMatchFee }).then(() => null)));
}
export async function setDuesReminderAction(teamId: string, on: boolean) {
  return run(() => inTeam(teamId, (c) => fund.setDuesReminder(c, on).then(() => null)));
}
export async function setDuesAction(teamId: string, month: string, playerId: string, paid: boolean) {
  return run(() => inTeam(teamId, (c) => fund.setDues(c, month, playerId, paid).then(() => null)));
}
/* ---------- Yêu cầu đóng tiền ---------- */
export async function requestDuesAction(teamId: string, month: string, note?: string) {
  return run(() => inTeam(teamId, (c) => payment.requestDues(c, { month, note }).then((r) => r.sent)));
}
export async function requestLeAction(teamId: string, matchId: string, amount: number) {
  return run(() => inTeam(teamId, (c) => payment.requestLe(c, matchId, { amount }).then((r) => r.sent)));
}
export async function remindPaymentAction(teamId: string, requestId: string) {
  return run(() => inTeam(teamId, (c) => payment.remindRequest(c, requestId)));
}
export async function declarePaidAction(teamId: string, requestId: string) {
  return run(() => inTeam(teamId, (c) => payment.declarePaid(c, requestId).then(() => null)));
}
export async function decidePaymentAction(teamId: string, requestId: string, playerId: string, ok: boolean) {
  return run(() => inTeam(teamId, (c) => payment.decidePayment(c, requestId, playerId, ok).then(() => null)));
}
export async function addEntryAction(teamId: string, input: unknown) {
  return run(() => inTeam(teamId, (c) => fund.addManualEntry(c, input).then(() => null)));
}
export async function deleteEntryAction(teamId: string, entryId: string) {
  return run(() => inTeam(teamId, (c) => fund.deleteManualEntry(c, entryId).then(() => null)));
}

/* ---------- Thông báo ---------- */
export async function notificationsAction() {
  return run(async () => {
    const user = await requireUser();
    const { items, unread } = await listNotifications(user.id);
    const teams = await prisma.team.findMany({ where: { id: { in: [...new Set(items.map((i) => i.teamId).filter(Boolean) as string[])] } }, select: { id: true, name: true } });
    return {
      unread,
      items: items.map((n) => ({
        id: n.id, kind: n.kind, text: n.text, teamId: n.teamId, teamName: teams.find((t) => t.id === n.teamId)?.name ?? null,
        matchId: n.matchId, view: n.view, read: !!n.readAt, at: n.createdAt.toISOString(),
      })),
    };
  });
}
export async function readAllAction() {
  return run(async () => {
    const user = await requireUser();
    await markAllRead(user.id, now());
    return null;
  });
}
export async function readOneAction(id: string) {
  return run(async () => {
    const user = await requireUser();
    await prisma.notification.updateMany({ where: { id, userId: user.id, readAt: null }, data: { readAt: now() } });
    return null;
  });
}
export async function pushSubscribeAction(sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  return run(async () => {
    const user = await requireUser();
    await saveSubscription(user.id, sub);
    return null;
  });
}

/* ---------- Admin ---------- */
export async function adminUserAction(userId: string, op: 'lock' | 'unlock' | 'reset') {
  return run(async () => {
    const user = await requireUser();
    if (op === 'reset') return admin.resetUserPassword(user, userId);
    await admin.setUserDisabled(user, userId, op === 'lock', now());
    revalidatePath('/he-thong');
    return null;
  });
}
export async function adminTeamAction(teamId: string, op: 'hide' | 'show') {
  return run(async () => {
    await admin.setTeamHidden(await requireUser(), teamId, op === 'hide');
    revalidatePath('/he-thong');
    return null;
  });
}
export async function adminTransferAction(teamId: string, userId: string) {
  return run(async () => {
    await admin.transferCaptain(await requireUser(), teamId, userId);
    revalidatePath('/he-thong');
    return null;
  });
}
