import { guardView } from '@/lib/guard';
import { ScheduleView } from '@/components/matches/ScheduleView';

export default async function SchedulePage({ params, searchParams }: { params: Promise<{ teamId: string }>; searchParams: Promise<{ tran?: string; tab?: string }> }) {
  const { teamId } = await params;
  const sp = await searchParams;
  await guardView(teamId, 'lich');
  const tab = sp.tab === 'att' || sp.tab === 'res' || sp.tab === 'info' ? sp.tab : undefined;
  return <ScheduleView openId={sp.tran} openTab={tab} />;
}
