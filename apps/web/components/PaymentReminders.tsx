'use client';

import { money } from '@san7/core';
import { useTeam } from './TeamContext';
import { declarePaidAction } from '@/app/actions';

/** Thẻ nhắc khoản ĐT yêu cầu đóng (quỹ tháng / đá lẻ); bấm "Tôi đã đóng" để báo ĐT xác nhận. */
export function PaymentReminders() {
  const { view, teamId, act } = useTeam();
  if (!view.myPayments.length) return null;
  return (
    <>
      {view.myPayments.map((p) => (
        // Khoản còn phải đóng thì lắc nhẹ theo nhịp cho dễ thấy; đã báo đóng (chờ ĐT xác nhận) thì đứng yên
        <div key={p.id} className={`note pay-remind${p.status === 'pending' ? '' : ' attn'}`} role="status" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {p.status !== 'pending' && <span className="coin" aria-hidden="true">₫</span>}
          {p.status === 'pending' ? (
            <span><span className="chip le">Chờ xác nhận</span> Bạn đã báo đóng <b>{p.label}</b> ({money(p.amount)}). Đội trưởng sẽ xác nhận khi nhận được tiền.</span>
          ) : (
            <>
              <span>
                {p.status === 'rejected' ? <>Đội trưởng <b>chưa nhận được</b> tiền {p.label}. </> : <>Đội trưởng yêu cầu đóng <b>{p.label}</b>: </>}
                <b>{money(p.amount)}</b>{p.note ? <> · {p.note}</> : null}
              </span>
              <button type="button" className="btn primary sm" onClick={() => act(() => declarePaidAction(teamId, p.id), 'Đã báo đội trưởng, chờ xác nhận')}>
                {p.status === 'rejected' ? 'Tôi đã đóng lại' : 'Tôi đã đóng'}
              </button>
            </>
          )}
        </div>
      ))}
    </>
  );
}
