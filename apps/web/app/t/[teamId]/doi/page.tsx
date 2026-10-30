import { guardView } from '@/lib/guard';
import { Dashboard } from '@/components/dashboard/Dashboard';

export default async function TeamPage({ params, searchParams }: { params: Promise<{ teamId: string }>; searchParams: Promise<{ moi?: string }> }) {
  const { teamId } = await params;
  const { moi } = await searchParams;
  await guardView(teamId, 'doi');
  return <Dashboard isNew={moi === '1'} />;
}
