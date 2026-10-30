import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/server/auth/session';
import { userHome } from '@/server/services/auth';
import { AuthShell } from '@/components/AuthShell';
import { LogoutButton } from '@/components/LogoutButton';

export const metadata: Metadata = { title: 'Bắt đầu' };

/** Màn "Đang chờ duyệt" hoặc "Chưa có đội" (BRD 3.4). */
export default async function StartPage() {
  const s = await getSession();
  if (!s) redirect('/dang-nhap');
  const { teamIds, pending } = await userHome(s.user.id, s.user.role);
  if (pending.length) {
    return (
      <AuthShell>
        <h2>Đang chờ duyệt</h2>
        <p style={{ margin: 0 }}>
          Đăng ký của bạn vào{' '}
          {pending.map((p, i) => (
            <span key={p.id}>{i ? ', ' : ''}<b>{p.team.name}</b></span>
          ))}{' '}
          đã được gửi tới đội trưởng. Khi được duyệt, bạn sẽ vào thẳng đội ở lần đăng nhập tiếp theo.
        </p>
        <div className="row-actions">
          {teamIds.length > 0 && <Link className="btn primary" href="/">Vào đội của tôi</Link>}
          <Link className="btn" href="/kham-pha">Xem các đội trên hệ thống</Link>
          <LogoutButton />
        </div>
      </AuthShell>
    );
  }
  if (teamIds.length) redirect('/');
  return (
    <AuthShell>
      <h2>Chưa có đội</h2>
      <p style={{ margin: 0 }}>
        Tài khoản <b>{s.user.name}</b> chưa thuộc đội nào. Bạn có thể lập đội mới và làm đội trưởng, hoặc xin link mời từ đội trưởng của đội bạn muốn vào.
      </p>
      <div className="row-actions">
        <Link className="btn primary" href="/tao-doi">Tạo đội mới</Link>
        <Link className="btn" href="/kham-pha">Xem các đội</Link>
        <LogoutButton />
      </div>
    </AuthShell>
  );
}
