'use client';

import { dm, isInternal, resultOf, shortName } from '@san7/core';
import { useTeam } from '../TeamContext';
import { Avatar } from '../ui';
import { CountUp, XOverlay } from './XOverlay';
import type { MatchDTO } from '@/lib/types';

/** Bảng "Hết giờ" của một trận đã có tỉ số: kết quả, người ghi bàn / kiến tạo, MVP. */
export function FullTime({ m, onClose }: { m: MatchDTO; onClose: () => void }) {
  const { view, byId } = useTeam();
  if (m.scoreUs == null || m.scoreThem == null) return null;
  const r = resultOf(m);
  const inl = isInternal(m);
  const nU = inl ? 'Đội A' : view.team.name;
  const nT = inl ? 'Đội B' : m.opponent;
  const res = inl ? (r === 'T' ? 'Đội A thắng' : r === 'B' ? 'Đội B thắng' : 'Hoà') : r === 'T' ? 'Chiến thắng' : r === 'B' ? 'Thất bại' : 'Hoà';
  const ev = Object.entries(m.events)
    .filter(([id, e]) => byId(id) && (e.goals || e.assists))
    .sort((a, b) => b[1].goals - a[1].goals || b[1].assists - a[1].assists);
  const mvp = m.mvpPlayerId ? byId(m.mvpPlayerId) : undefined;
  return (
    <XOverlay cls="ftbox" label={`Hết giờ: ${nU} ${m.scoreUs}–${m.scoreThem} ${nT}`} onClose={onClose}>
      <div className={`ft ft-${r}`}>
        <div className="ft-eye">Hết giờ · {m.type || 'Giao hữu'} · {dm(m.date)}</div>
        <div className="ft-res">{res}</div>
        <div className="ft-score">
          <span className="t">{nU}</span>
          <b><i><CountUp to={m.scoreUs} /></i><em>–</em><i><CountUp to={m.scoreThem} /></i></b>
          <span className="t them">{nT}</span>
        </div>
        {ev.length > 0 && (
          <ul className="ft-ev">
            {ev.map(([id, e]) => {
              const p = byId(id)!;
              return (
                <li key={id}>
                  <Avatar p={p} size={28} />
                  <b>{shortName(p)}</b>
                  <span>{[e.goals ? `${e.goals} bàn` : '', e.assists ? `${e.assists} kiến tạo` : ''].filter(Boolean).join(' · ')}</span>
                </li>
              );
            })}
          </ul>
        )}
        {mvp && (
          <div className="ft-mvp"><span className="k">MVP trận đấu</span><Avatar p={mvp} size={72} /><b>{shortName(mvp)}</b></div>
        )}
        <button type="button" className="btn primary" onClick={onClose}>Đóng</button>
      </div>
    </XOverlay>
  );
}
