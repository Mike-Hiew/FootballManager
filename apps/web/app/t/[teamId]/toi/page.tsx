import { prisma } from '@san7/db';
import { guardView } from '@/lib/guard';
import { MeView } from '@/components/me/MeView';

export default async function MePage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const ctx = await guardView(teamId, 'toi');
  const dues = ctx.playerId ? await prisma.duesPayment.findMany({ where: { teamId, playerId: ctx.playerId }, select: { month: true } }) : [];
  return <MeView duesMonths={dues.map((d) => d.month)} />;
}
