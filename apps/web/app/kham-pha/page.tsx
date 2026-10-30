import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Frame } from '@/components/Frame';
import { exploreTeams } from '@/server/services/team';
import { getSession } from '@/server/auth/session';
import { myTeams } from '@/server/services/view';
import { ExploreList } from './ExploreList';

export const metadata: Metadata = { title: 'Khám phá các đội' };

export default async function ExplorePage() {
  // Trang đọc phiên đăng nhập (header) nên luôn render động, không prerender lúc build.
  await connection();
  const [teams, s] = await Promise.all([exploreTeams(), getSession()]);
  const mine = s ? await myTeams(s.user.id, s.user.role) : [];
  const current = s ? (mine.find((t) => t.id === s.currentTeamId) ?? mine[0])?.id ?? null : null;
  return (
    <Frame active="kham-pha">
      <section className="view">
        <ExploreList teams={teams} mine={mine.map((t) => ({ id: t.id, role: t.role }))} current={current} />
      </section>
    </Frame>
  );
}
