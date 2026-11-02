import { guardView } from '@/lib/guard';
import { HonorsView } from '@/components/honors/HonorsView';
import { honorsView } from '@/server/services/honors';

export default async function HonorsPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const ctx = await guardView(teamId, 'vinh-danh');
  return <HonorsView data={await honorsView(ctx)} />;
}
