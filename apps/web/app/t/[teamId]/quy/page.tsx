import { guardView } from '@/lib/guard';
import { FundView } from '@/components/FundView';
import { fundView } from '@/server/services/fund';

export default async function FundPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const ctx = await guardView(teamId, 'quy');
  return <FundView data={await fundView(ctx)} />;
}
