import { guardView } from '@/lib/guard';
import { ApprovalsView } from '@/components/ApprovalsView';
import { approvals } from '@/server/services/view';

export default async function ApprovalsPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const ctx = await guardView(teamId, 'duyet');
  return <ApprovalsView data={await approvals(ctx)} />;
}
