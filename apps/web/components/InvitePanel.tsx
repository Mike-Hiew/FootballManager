'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { rotateInviteAction } from '@/app/actions';
import { useTeam } from './TeamContext';
import { Tip } from './ui';

/** Khối "Mời thành viên vào đội" — markup như prototype; Sao chép, Chia sẻ, Tạo link mới (BRD 8.6). */
export function InvitePanel() {
  const { view, act, toast, teamId } = useTeam();
  const [origin, setOrigin] = useState('');
  const [arm, setArm] = useState(false);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    setOrigin(location.origin);
    setCanShare('share' in navigator);
  }, []);
  if (!view.canEdit || !view.team.inviteCode) return null;
  const link = `${origin}/join/${view.team.inviteCode}`;
  return (
    <div className="panel invite">
      <div className="sec-title">
        Mời thành viên vào đội{' '}
        {view.pendingJoins > 0 && (
          <Link href={`/t/${teamId}/duyet`} className="chip le" style={{ textDecoration: 'none' }}>{view.pendingJoins} người chờ duyệt</Link>
        )}
      </div>
      <code aria-label="Link mời">{link}</code>
      <div className="row-actions">
        <button type="button" className="btn primary sm" onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            toast('Đã sao chép link mời');
          } catch {
            toast('Không sao chép được, hãy bôi đen link để copy');
          }
        }}>Sao chép link mời</button>
        {canShare && (
          <button type="button" className="btn sm" onClick={() => navigator.share({ title: `Vào đội ${view.team.name}`, url: link }).catch(() => {})}>Chia sẻ</button>
        )}
        <button type="button" className="btn ghost sm" onClick={() => {
          if (!arm) {
            setArm(true);
            setTimeout(() => setArm(false), 2500);
            return;
          }
          setArm(false);
          act(() => rotateInviteAction(teamId), 'Đã tạo link mới, link cũ hết hiệu lực');
        }}>{arm ? 'Bấm lần nữa để tạo' : 'Tạo link mới'}</button>
      </div>
      <p className="hint" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Tip text="Người nhận mở link, tự đăng ký thông tin và chỉ số, sau đó chờ bạn duyệt ở tab Duyệt. Tạo link mới thì link cũ hết hiệu lực." />
        Mỗi đội một link mời
      </p>
    </div>
  );
}
