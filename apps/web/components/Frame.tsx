import Link from 'next/link';
import { prisma } from '@san7/db';
import { getSession } from '@/server/auth/session';
import { countApprovals, myTeams } from '@/server/services/view';
import { allowedViews, roleIn } from '@/server/authz';
import { Header } from './Header';
import { TooltipLayer } from './Overlays';

/** Khung trang ngoài đội (Khám phá, Hệ thống). */
export async function Frame({ active, children }: { active: string; children: React.ReactNode }) {
  const s = await getSession();
  if (!s) {
    return (
      <div className="wrap" id="app">
        <header className="top">
          <div className="brand"><h1><span className="tname">{process.env.APP_NAME ?? 'Đom Đóm FC'}</span></h1></div>
          <div className="userbar"><Link className="btn primary sm" href={`/dang-nhap?next=/${active}`}>Đăng nhập</Link></div>
        </header>
        {children}
        <TooltipLayer />
      </div>
    );
  }
  const [teams, unread] = await Promise.all([myTeams(s.user.id, s.user.role), prisma.notification.count({ where: { userId: s.user.id, readAt: null } })]);
  const home = teams.find((t) => t.id === s.currentTeamId) ?? teams[0];
  // Giữ đủ hàng tab của đội đang chọn như prototype (Khám phá/Hệ thống vẫn nằm trong khung đội)
  const r = home ? await roleIn(s.user, home.id) : null;
  const teamTabs = r ? allowedViews(r.role, !!r.playerId).filter((v) => v !== 'tran-toi') : [];
  const approvals = r && (r.role === 'admin' || r.role === 'captain') ? await countApprovals(home!.id) : 0;
  return (
    <div className="wrap" id="app">
      <Header
        team={home ? { id: home.id, name: home.name, photoUrl: home.photoUrl } : null}
        role={r?.role ?? null}
        tabs={[...teamTabs, 'kham-pha', ...(s.user.role === 'admin' ? ['he-thong'] : [])]}
        approvalCount={approvals}
        me={{ id: s.user.id, name: s.user.name, isAdmin: s.user.role === 'admin' }}
        myTeams={teams}
        initialUnread={unread}
      />
      {children}
      <TooltipLayer />
    </div>
  );
}
