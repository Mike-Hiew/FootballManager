'use client';

import { useEffect, useState } from 'react';
import { rotateInviteAction } from '@/app/actions';
import { useTeam } from './TeamContext';
import { Tip } from './ui';

/** Khối Link mời: Sao chép, Chia sẻ (Web Share API), Tạo link mới (BRD 8.6). */
export function InvitePanel() {
  const { view, act, toast, teamId } = useTeam();
  const [origin, setOrigin] = useState('');
  const [arm, setArm] = useState(false);
  useEffect(() => setOrigin(location.origin), []);
  if (!view.canEdit || !view.team.inviteCode) return null;
  const link = `${origin}/join/${view.team.inviteCode}`;
  return (
    <div className="panel invite">
      <div className="sec-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        Link mời vào đội <Tip text="Gửi link này cho người muốn vào đội. Họ tự khai hồ sơ và điểm vị trí; bạn duyệt ở tab Duyệt. Tạo link mới thì link cũ hết hiệu lực." />
      </div>
      <div className="row-actions" style={{ flexWrap: 'wrap' }}>
        <input readOnly value={link} aria-label="Link mời" style={{ flex: 1, minWidth: 220 }} onFocus={(e) => e.target.select()} />
        <button type="button" className="btn sm" onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            toast('Đã sao chép link mời');
          } catch {
            toast('Không sao chép được, hãy chọn và copy thủ công');
          }
        }}>Sao chép</button>
        {typeof navigator !== 'undefined' && 'share' in navigator && (
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
    </div>
  );
}
