import { prisma } from '@san7/db';
import { currentMonth, monthLabel, seasonYear, todayVN, vnTime } from '@san7/core';
import { closeMvpIfDue } from '../services/mvp';
import { syncPitch } from '../services/fund';
import { emit } from '../services/notify';
import { dispatchOutbox } from '../services/push';
import { autoRemind } from '../services/payment';
import { snapshotSeason } from '../services/season';
import { effectivePayType } from '../services/player';

/** Ghi job_runs(job, key); trả về false nếu đã chạy (chống chạy trùng). */
async function once(job: string, key: string): Promise<boolean> {
  try {
    await prisma.jobRun.create({ data: { job, key } });
    return true;
  } catch {
    return false;
  }
}

export interface TickResult { locked: boolean; mvp: number; pitch: number; remind: number; dues: number; pay: number; season: number; pushed: number }

/**
 * Khoá thuê (lease) 2 phút trên job_runs: advisory lock theo phiên không hợp với pool
 * kết nối serverless, nên dùng một dòng có điều kiện thời gian thay thế.
 */
async function acquireLease(now: Date): Promise<boolean> {
  const rows = await prisma.$queryRaw<unknown[]>`
    INSERT INTO "job_runs" ("job", "key", "ranAt") VALUES ('lock', 'tick', ${now})
    ON CONFLICT ("job", "key") DO UPDATE SET "ranAt" = EXCLUDED."ranAt"
    WHERE "job_runs"."ranAt" < ${new Date(now.getTime() - 120e3)}
    RETURNING 1`;
  return rows.length > 0;
}

async function releaseLease() {
  await prisma.jobRun.updateMany({ where: { job: 'lock', key: 'tick' }, data: { ranAt: new Date(0) } });
}

/** Job chạy mỗi 5 phút (ARCHITECTURE 6.5). Mọi việc idempotent; lease chống chạy chồng. */
export async function tick(now: Date): Promise<TickResult> {
  const res: TickResult = { locked: false, mvp: 0, pitch: 0, remind: 0, dues: 0, pay: 0, season: 0, pushed: 0 };
  if (!(await acquireLease(now))) return { ...res, locked: true };
  try {
    const today = todayVN(now);
    const hhmm = vnTime(now);

    // 1. Chốt MVP quá hạn
    const due = await prisma.mvpVote.findMany({ where: { status: 'open', closesAt: { lte: now } }, select: { matchId: true } });
    for (const d of due) if (await closeMvpIfDue(d.matchId, now)) res.mvp++;

    // 2. Tiền sân trận đã qua chưa ghi sổ
    const past = await prisma.match.findMany({
      where: { deletedAt: null, cost: { gt: 0 }, date: { lt: today } },
      select: { id: true, teamId: true },
    });
    if (past.length) {
      const have = new Set(
        (await prisma.fundEntry.findMany({ where: { source: 'pitch', sourceKey: { in: past.map((p) => p.id) } }, select: { sourceKey: true } })).map((e) => e.sourceKey),
      );
      for (const m of past) if (!have.has(m.id)) {
        await syncPitch(prisma, m.id, now);
        res.pitch++;
      }
    }

    // 3. Nhắc điểm danh 09:00 ngày đá
    if (hhmm >= '09:00' && hhmm < '12:00') {
      const games = await prisma.match.findMany({ where: { date: today, voteState: 'open', deletedAt: null, scoreUs: null } });
      for (const m of games) {
        if (!(await once('remind', m.id))) continue;
        const [players, att] = await Promise.all([
          prisma.player.findMany({ where: { teamId: m.teamId, status: 'active', userId: { not: null } } }),
          prisma.attendance.findMany({ where: { matchId: m.id } }),
        ]);
        const answered = new Set(att.map((a) => a.playerId));
        res.remind += await emit(prisma, {
          kind: 'vote', teamId: m.teamId, matchId: m.id, recipients: players.filter((p) => !answered.has(p.id)).map((p) => p.userId),
          text: `Nhắc: bạn chưa vote trận vs ${m.opponent} hôm nay${m.time ? ' ' + m.time : ''}. Hạn điểm danh 12:00.`,
        });
      }
    }

    // 4. Nhắc đóng quỹ ngày 5
    const month = currentMonth(now);
    if (today.endsWith('-05') && hhmm >= '09:00') {
      const teams = await prisma.team.findMany({ where: { duesReminder: true, hidden: false }, select: { id: true } });
      for (const t of teams) {
        if (!(await once('dues', `${t.id}:${month}`))) continue;
        const [players, paid] = await Promise.all([
          prisma.player.findMany({ where: { teamId: t.id, status: 'active', userId: { not: null } } }),
          prisma.duesPayment.findMany({ where: { teamId: t.id, month }, select: { playerId: true } }),
        ]);
        const ok = new Set(paid.map((p) => p.playerId));
        res.dues += await emit(prisma, {
          kind: 'fund', teamId: t.id, view: 'quy',
          recipients: players.filter((p) => effectivePayType(p, month) === 'quy' && !ok.has(p.id)).map((p) => p.userId),
          text: `Nhắc đóng quỹ ${monthLabel(month)} (hạn trước ngày 10)`,
        });
      }
    }

    // 4b. Nhắc lại yêu cầu đóng tiền (quỹ / đá lẻ) mỗi 3 ngày, ban ngày
    if (hhmm >= '09:00' && hhmm < '21:00') res.pay = await autoRemind(now);

    // 5. Snapshot mùa cũ (00:05 ngày 1/1 trở đi, idempotent)
    if (today.endsWith('-01-01') && hhmm >= '00:05') {
      const year = seasonYear(now) - 1;
      const teams = await prisma.team.findMany({ select: { id: true } });
      for (const t of teams) {
        if (!(await once('season', `${t.id}:${year}`))) continue;
        await snapshotSeason(t.id, year);
        res.season++;
      }
    }

    // 6. Đẩy push còn sót
    res.pushed = await dispatchOutbox();

    // 7. Dọn dấu vết giới hạn tần suất / đăng nhập quá 1 ngày (cửa sổ dài nhất là 1 giờ)
    const old = new Date(now.getTime() - 864e5);
    await prisma.rateHit.deleteMany({ where: { at: { lt: old } } });
    await prisma.loginAttempt.deleteMany({ where: { at: { lt: old } } });
    return res;
  } finally {
    await releaseLease();
  }
}
