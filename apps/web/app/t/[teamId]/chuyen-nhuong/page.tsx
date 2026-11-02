import { guardView } from '@/lib/guard';
import { TransferView } from '@/components/transfer/TransferView';
import { marketView } from '@/server/services/transfer';

export default async function TransferPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const ctx = await guardView(teamId, 'chuyen-nhuong');
  return <TransferView data={await marketView(ctx)} />;
}
