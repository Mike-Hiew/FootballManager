import { guardView } from '@/lib/guard';
import { PlayersView } from '@/components/players/PlayersView';

export default async function PlayersPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  await guardView(teamId, 'cau-thu');
  return <PlayersView />;
}
