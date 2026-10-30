import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/server/auth/session';
import { AuthShell } from '@/components/AuthShell';
import { CreateTeamForm } from './CreateTeamForm';

export const metadata: Metadata = { title: 'Tạo đội bóng' };

export default async function CreateTeamPage() {
  if (!(await getSession())) redirect('/dang-nhap?next=/tao-doi');
  return (
    <AuthShell>
      <h2>Tạo đội bóng</h2>
      <p className="hint" style={{ margin: 0 }}>Bước 2/2 · Tên đội là duy nhất trên hệ thống.</p>
      <CreateTeamForm />
    </AuthShell>
  );
}
