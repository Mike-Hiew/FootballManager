import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/server/auth/session';
import { adminOverview } from '@/server/services/admin';
import { now } from '@/server/clock';
import { Frame } from '@/components/Frame';
import { AdminView } from './AdminView';

export const metadata: Metadata = { title: 'Hệ thống' };

export default async function AdminPage() {
  const s = await getSession();
  if (!s) redirect('/dang-nhap?next=/he-thong');
  if (s.user.role !== 'admin') redirect('/');
  const data = await adminOverview(s.user, now());
  return (
    <Frame active="he-thong">
      <AdminView data={data} meId={s.user.id} />
    </Frame>
  );
}
