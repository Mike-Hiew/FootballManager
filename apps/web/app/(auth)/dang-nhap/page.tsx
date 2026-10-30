import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/server/auth/session';
import { AuthShell } from '@/components/AuthShell';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Đăng nhập' };

const DEMO = process.env.SEED_DEMO === 'true'
  ? [
      { label: 'Admin hệ thống', sub: '0900000000', id: '0900000000', pw: 'admin123' },
      { label: 'Đội trưởng Đom Đóm', sub: 'Tuấn Tạ · 0901000002', id: '0901000002', pw: '123456' },
      { label: 'Thành viên Đom Đóm', sub: 'Quang Còi · 0901000009', id: '0901000009', pw: '123456' },
      { label: 'Đội trưởng Phố Huế', sub: 'Anh Thép · 0902000002', id: '0902000002', pw: '123456' },
      { label: 'Đang chờ duyệt', sub: 'Hải Râu · 0901000099', id: '0901000099', pw: '123456' },
    ]
  : [];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getSession()) redirect(safeNext(next) ?? '/');
  return (
    <AuthShell>
      <h2>Đăng nhập</h2>
      <LoginForm demo={DEMO} next={safeNext(next)} />
    </AuthShell>
  );
}

function safeNext(n?: string) {
  return n && n.startsWith('/') && !n.startsWith('//') ? n : undefined;
}
