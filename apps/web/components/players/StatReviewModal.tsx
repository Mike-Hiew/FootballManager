'use client';

import { useState } from 'react';
import { STAT_INFO, STAT_KEYS, fmt1, rankedPositions, shortName, type Stats } from '@san7/core';
import { useTeam } from '../TeamContext';
import { Avatar, Modal } from '../ui';
import { Radar } from './Radar';
import { castStatVoteAction } from '@/app/actions';
import type { TeamView } from '@/lib/types';

type Review = TeamView['statReviews'][number];

const ORIGIN: Record<Review['origin'], string> = {
  self: 'tự cập nhật chỉ số',
  join: 'vừa vào đội, chỉ số khai lúc đăng ký',
  captain: 'đội trưởng nhờ cả đội chấm lại',
};

/**
 * Chấm chỉ số đồng đội (BRD 4.7): mặc định là bản khai (hoặc phiếu mình đã chấm); "Xác nhận" gửi đúng
 * bản khai, chỉnh thanh trượt rồi "Gửi chỉ số tôi chấm". Đội trưởng chốt theo trung bình mọi phiếu.
 */
export function StatReviewModal({ review, onClose }: { review: Review; onClose: () => void }) {
  const { byId, act, teamId } = useTeam();
  const p = byId(review.playerId);
  const [d, setD] = useState<Stats>(review.myVote ?? review.proposed);
  if (!p) return null;
  const changed = STAT_KEYS.some((k) => d[k] !== review.proposed[k]);
  const send = (stats: Stats, msg: string) => act(() => castStatVoteAction(teamId, review.editId, stats), msg).then((r) => r !== undefined && onClose());
  let g = '';
  const top = rankedPositions(d, p.foot).filter(([k, v]) => !(k === 'GK' && v < 6)).slice(0, 3);
  return (
    <Modal
      title={`Chấm chỉ số · ${shortName(p)}`}
      wide={860}
      onClose={onClose}
      footer={
        <>
          <span className="hint" style={{ margin: 0, marginRight: 'auto' }}>{review.voted}/{review.invited} đồng đội đã chấm · đội trưởng chốt theo trung bình</span>
          <button type="button" className="btn" disabled={changed} title={changed ? 'Bạn đã chỉnh — dùng nút Gửi chỉ số tôi chấm' : undefined} onClick={() => send(review.proposed, `Đã xác nhận chỉ số của ${shortName(p)}`)}>
            Xác nhận như bản khai
          </button>
          <button type="button" className="btn primary" disabled={!changed} onClick={() => send(d, `Đã gửi chỉ số bạn chấm cho ${shortName(p)}`)}>
            Gửi chỉ số tôi chấm
          </button>
        </>
      }
    >
      <div className="sr-head">
        <Avatar p={p} size={48} />
        <div>
          <b>{p.fullName}</b>
          <div className="muted" style={{ fontSize: 12.5 }}>{ORIGIN[review.origin]}{review.myVote ? ' · bạn đã chấm, sửa lại được' : ''}</div>
        </div>
      </div>
      <div className="split" style={{ marginTop: 14 }}>
        <div>
          <div className="sec-title">Chỉ số <span>kéo để chỉnh · vạch vàng = bản khai</span></div>
          <div className="posgrid">
            {STAT_KEYS.map((k) => {
              const v = STAT_INFO[k];
              const head = v.group !== g ? ((g = v.group), <div key={'g' + g} className="group-lbl">{g}</div>) : null;
              const diff = d[k] - review.proposed[k];
              return [
                head,
                <div key={k} className={`prow sr-row${diff ? ' sr-diff' : ''}`}>
                  <div className="code">{k}<small>{v.vn}</small></div>
                  <div className="sr-track">
                    <input type="range" min={1} max={10} step={0.5} value={d[k]} aria-label={`${v.vn}: ${v.desc}`} title={v.desc} onChange={(e) => setD({ ...d, [k]: +e.target.value })} />
                    <i className="sr-mark" style={{ left: `${((review.proposed[k] - 1) / 9) * 100}%` }} aria-hidden="true" />
                  </div>
                  <div className="val">{fmt1(d[k])}{diff ? <small className={diff > 0 ? 'up' : 'down'}>{diff > 0 ? '+' : ''}{fmt1(diff)}</small> : null}</div>
                </div>,
              ];
            })}
          </div>
          {changed && <button type="button" className="chipbtn" style={{ marginTop: 10 }} onClick={() => setD(review.proposed)}>Về bản khai</button>}
        </div>
        <div className="preview">
          <div className="radar"><Radar stats={d} /></div>
          <div className="sec-title" style={{ margin: '4px 0' }}>Vị trí hợp nhất theo chỉ số bạn chấm</div>
          <div className="row-actions">{top.map(([k, v]) => <span key={k} className="chip">{k} {fmt1(v)}</span>)}</div>
        </div>
      </div>
    </Modal>
  );
}
