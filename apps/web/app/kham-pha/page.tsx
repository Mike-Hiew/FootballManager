import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Frame } from '@/components/Frame';
import { exploreTeams } from '@/server/services/team';
import { ExploreList } from './ExploreList';

export const metadata: Metadata = { title: 'Khám phá các đội' };

export default async function ExplorePage() {
  // Trang đọc phiên đăng nhập (header) nên luôn render động, không prerender lúc build.
  await connection();
  const teams = await exploreTeams();
  return (
    <Frame active="kham-pha">
      <section className="view">
        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <h2 className="vt">Các đội trên hệ thống</h2>
            <p className="hint" style={{ margin: '4px 0 0' }}>Đội nào cũng xem được lịch sử trận, thành viên và chỉ số của các đội khác.</p>
          </div>
          <ExploreList teams={teams} />
        </div>
      </section>
    </Frame>
  );
}
