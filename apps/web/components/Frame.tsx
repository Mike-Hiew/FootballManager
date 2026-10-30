import Link from 'next/link';
import { prisma } from '@san7/db';
import { getSession } from '@/server/auth/session';
import { myTeams } from '@/server/services/view';
import { Header } from './Header';
import { TooltipLayer } from './Overlays';

/** Khung trang ngoài đội (Khám phá, Hệ thống). */
export async function Frame({ active, children }: { active: string; children: React.ReactNode }) {
  const s = await getSession();
  if (!s) {
    return (
      <div className="wrap" id="app">
        <header className="top">
          <div className="brand"><h1><span className="tname">{process.env.APP_NAME ?? 'Sân 7 Manager'}</span></h1></div>
          <div className="userbar"><Link className="btn primary sm" href={`/dang-nhap?next=/${active}`}>Đăng nhập</Link></div>
        </header>
        {children}
        <TooltipLayer />
      </div>
    );
  }
  const [teams, unread] = await Promise.all([myTeams(s.user.id, s.user.role), prisma.notification.count({ where: { userId: s.user.id, readAt: null } })]);
  const home = teams.find((t) => t.id === s.currentTeamId) ?? teams[0];
  return (
    <div className="wrap" id="app">
      <Header
        team={home ? { id: home.id, name: home.name, photoUrl: home.photoUrl } : null}
        role={home ? (s.user.role === 'admin' ? 'admin' : home.role) : null}
        tabs={[...(home ? ['doi'] : []), 'kham-pha', ...(s.user.role === 'admin' ? ['he-thong'] : [])]}
        approvalCount={0}
        me={{ id: s.user.id, name: s.user.name, isAdmin: s.user.role === 'admin' }}
        myTeams={teams}
        initialUnread={unread}
      />
      {children}
      <TooltipLayer />
    </div>
  );
}
