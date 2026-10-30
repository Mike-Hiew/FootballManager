import { guardView } from '@/lib/guard';
import { TacticsView } from '@/components/tactics/TacticsView';

export default async function NextMatchPage({ params, searchParams }: { params: Promise<{ teamId: string }>; searchParams: Promise<{ tran?: string }> }) {
  const { teamId } = await params;
  const { tran } = await searchParams;
  await guardView(teamId, 'tran-toi');
  return <TacticsView mode="tran" matchId={tran} />;
}
