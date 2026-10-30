import type { Metadata } from 'next';
import Link from 'next/link';
import { getSession } from '@/server/auth/session';
import { inviteInfo } from '@/server/services/team';
import { AuthShell } from '@/components/AuthShell';
import { TeamCrest } from '@/components/TeamCrest';
import { JoinForm } from './JoinForm';

export const metadata: Metadata = { title: 'Gia nhập đội' };

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [info, s] = await Promise.all([inviteInfo(code), getSession()]);
  if (!info) {
    return (
      <AuthShell>
        <h2>Link mời không hợp lệ</h2>
        <p style={{ margin: 0 }}>Link mời không còn hiệu lực, xin link mới từ đội trưởng.</p>
        <Link className="btn" href="/dang-nhap">Về trang đăng nhập</Link>
      </AuthShell>
    );
  }
  return (
    <AuthShell>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <TeamCrest name={info.name} photoUrl={info.photoUrl} size={52} />
        <div>
          <div className="muted" style={{ fontSize: 12 }}>Bạn được mời vào đội · {info.members} thành viên</div>
          <h2>{info.name}</h2>
          {info.slogan && <div className="muted" style={{ fontSize: 12.5 }}>{info.slogan}</div>}
        </div>
      </div>
      <JoinForm code={info.code} me={s ? { name: s.user.name, phone: s.user.phone } : null} />
    </AuthShell>
  );
}
