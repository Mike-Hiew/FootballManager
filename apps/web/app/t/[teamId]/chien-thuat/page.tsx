import { guardView } from '@/lib/guard';
import { TacticsView } from '@/components/tactics/TacticsView';

export default async function TacticsPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  await guardView(teamId, 'chien-thuat');
  return <TacticsView mode="tong" />;
}
