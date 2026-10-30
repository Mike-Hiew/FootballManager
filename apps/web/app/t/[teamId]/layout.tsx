import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@san7/db';
import { allowedViews, teamCtx } from '@/server/authz';
import { AppError } from '@/server/errors';
import { rememberTeam } from '@/server/auth/session';
import { myTeams, teamView } from '@/server/services/view';
import { Header } from '@/components/Header';
import { TeamProvider } from '@/components/TeamContext';
import { FormulaPopover, TooltipLayer } from '@/components/Overlays';

export async function generateMetadata({ params }: { params: Promise<{ teamId: string }> }): Promise<Metadata> {
  const { teamId } = await params;
  const t = await prisma.team.findUnique({ where: { id: teamId }, select: { name: true } });
  return { title: t?.name ?? 'Đội bóng' };
}

export async function loadCtx(teamId: string) {
  try {
    return await teamCtx(teamId);
  } catch (e) {
    if (e instanceof AppError && e.status === 401) redirect(`/dang-nhap?next=/t/${teamId}/doi`);
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  }
}

export default async function TeamLayout({ params, children }: { params: Promise<{ teamId: string }>; children: React.ReactNode }) {
  const { teamId } = await params;
  const ctx = await loadCtx(teamId);
  const [view, teams, unread] = await Promise.all([
    teamView(ctx),
    myTeams(ctx.user.id, ctx.user.role),
    prisma.notification.count({ where: { userId: ctx.user.id, readAt: null } }),
  ]);
  if (ctx.role !== 'guest') await rememberTeam(teamId);
  const visit = ctx.role === 'guest';
  const tabs = [...allowedViews(ctx.role, !!ctx.playerId).filter((v) => v !== 'tran-toi'), 'kham-pha', ...(ctx.user.role === 'admin' ? ['he-thong'] : [])];
  return (
    <TeamProvider view={view}>
      <div className={`wrap${visit ? ' visit' : ''}${view.canEdit ? '' : ' ro'}`} id="app">
        <Header
          team={{ id: view.team.id, name: view.team.name, photoUrl: view.team.photoUrl }}
          role={ctx.role}
          tabs={tabs}
          approvalCount={view.approvalCount}
          me={{ id: ctx.user.id, name: ctx.user.name, isAdmin: ctx.user.role === 'admin' }}
          myTeams={teams}
          initialUnread={unread}
        />
        {visit && (
          <div className="note" role="status">
            <span>Bạn đang xem <b>{view.team.name}</b> ở chế độ chỉ xem: lịch sử trận, thành viên và chỉ số.</span>{' '}
            <Link className="btn sm" href="/">{teams.length ? 'Về đội của tôi' : 'Quay lại'}</Link>
          </div>
        )}
        {children}
      </div>
      <TooltipLayer />
      <FormulaPopover />
    </TeamProvider>
  );
}
