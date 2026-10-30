import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/server/auth/session';
import { AuthShell } from '@/components/AuthShell';
import { RegisterForm } from './RegisterForm';

export const metadata: Metadata = { title: 'Đăng ký đội trưởng' };

export default async function RegisterPage() {
  if (await getSession()) redirect('/tao-doi');
  return (
    <AuthShell>
      <h2>Đăng ký đội trưởng</h2>
      <p className="hint" style={{ margin: 0 }}>Bước 1/2 · Tạo tài khoản. Bước sau bạn khai báo thông tin đội.</p>
      <RegisterForm />
    </AuthShell>
  );
}
