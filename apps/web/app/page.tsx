import { redirect } from 'next/navigation';
import { getSession } from '@/server/auth/session';
import { userHome } from '@/server/services/auth';

/** Điều hướng sau đăng nhập (BRD 3.4). */
export default async function Home() {
  const s = await getSession();
  if (!s) redirect('/dang-nhap');
  const { teamIds } = await userHome(s.user.id, s.user.role);
  if (teamIds.length) {
    const pick = s.currentTeamId && teamIds.includes(s.currentTeamId) ? s.currentTeamId : teamIds[0];
    redirect(`/t/${pick}/doi`);
  }
  redirect('/bat-dau');
}
