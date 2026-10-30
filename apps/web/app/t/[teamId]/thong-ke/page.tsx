import { guardView } from '@/lib/guard';
import { StatsView } from '@/components/StatsView';
import { seasonSnapshots } from '@/server/services/season';

export default async function StatsPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  await guardView(teamId, 'thong-ke');
  const snaps = await seasonSnapshots(teamId);
  return <StatsView snapshots={snaps.map((s) => ({ year: s.year, data: s.data as never }))} />;
}
