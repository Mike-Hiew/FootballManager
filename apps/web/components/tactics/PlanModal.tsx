'use client';

import { useMemo, useState } from 'react';
import { PLAN_PERIODS, buildPlan, dm, fmt1, shortName, subsOf, type PlanInfo, type SubLine } from '@san7/core';
import { useTeam } from '../TeamContext';
import { Avatar, Modal, tierColor } from '../ui';
import { savePlanConfigAction } from '@/app/actions';
import type { MatchDTO, PlayerDTO } from '@/lib/types';

/** Popup Đề xuất thay người (BRD 5.6): tính lại tức thì khi đổi tham số. */
export function PlanModal({ match, pool, formation, onClose, onApply }: { match: MatchDTO; pool: PlayerDTO[]; formation: string; onClose: () => void; onApply: (lineup: Array<string | null>) => void }) {
  const { view, canEdit, act, teamId, byId } = useTeam();
  const [cfg, setCfg] = useState(view.team.plan);
  const plan = useMemo(() => buildPlan(pool, formation, cfg), [pool, formation, cfg]);
  const P = cfg.periods;
  const step = cfg.minutes / P;
  const save = (next: typeof cfg) => {
    setCfg(next);
    if (canEdit) act(() => savePlanConfigAction(teamId, next));
  };
  const nm = (i: PlanInfo) => shortName(byId(i.player.id));
  const line = (x: SubLine, k: number) =>
    x.type === 'sub' ? (
      <li key={k}><span className="inb">▲ {nm(x.in)}</span> vào đá {x.pos}{x.out && <> <span className="outb">▼ {nm(x.out)}</span> ra</>}</li>
    ) : x.type === 'off' ? (
      <li key={k}><span className="outb">▼ {nm(x.out)}</span> ra nghỉ</li>
    ) : (
      <li key={k}><span className="muted">↔ {nm(x.who)} chuyển {x.from} → {x.to}</span></li>
    );

  return (
    <Modal
      title={`Đề xuất thay người · vs ${match.opponent} · ${dm(match.date)}`}
      onClose={onClose}
      wide={1020}
      tabs={
        <div className="plan-ctl" style={{ paddingBottom: 12 }}>
          <div className="field">
            <label htmlFor="planMins">Thời lượng (phút)</label>
            <input id="planMins" type="number" min={20} max={120} step={5} style={{ width: 96 }} value={cfg.minutes} onChange={(e) => save({ ...cfg, minutes: Math.min(120, Math.max(20, +e.target.value || 80)) })} />
          </div>
          <div className="field">
            <label htmlFor="planPer">Số đợt</label>
            <select id="planPer" value={P} onChange={(e) => save({ ...cfg, periods: +e.target.value, min: null })}>
              {PLAN_PERIODS.map((n) => <option key={n} value={n}>{n}{n === 2 ? ' (mỗi hiệp)' : n === 4 ? ' (nửa hiệp)' : ''}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="planMin">Tối thiểu mỗi người</label>
            <select id="planMin" disabled={plan.N <= 7} value={plan.N <= 7 ? '' : plan.min} onChange={(e) => save({ ...cfg, min: +e.target.value })}>
              {plan.N <= 7 ? <option value="">Cả trận (đủ {plan.N} người)</option> : Array.from({ length: plan.maxMin }, (_, i) => i + 1).map((v) => <option key={v} value={v}>{v} đợt (~{Math.round(v * step)}&apos;)</option>)}
            </select>
          </div>
        </div>
      }
    >
      <div className="prio" style={{ margin: 0 }}>
        Thứ tự ưu tiên ra sân:
        <span><span className="tier ex">★</span> <b>Cá nhân xuất sắc</b> (điểm vị trí từ 8.0 trong sơ đồ trận này)</span><span className="arr">›</span>
        <span><span className="chip quy">Quỹ</span> <b>Anh em đóng quỹ tháng</b></span><span className="arr">›</span>
        <span><b>Mức phù hợp vị trí</b></span>
      </div>
      {!plan.N ? (
        <div className="empty-list">Chưa ai xác nhận đi trận này. Điểm danh ở tab Lịch đấu.</div>
      ) : (
        <>
          {plan.N < 7 && <p className="warn" style={{ margin: '0 0 10px' }}>Mới có {plan.N} người đi, còn thiếu {7 - plan.N} người để đủ đội hình.</p>}
          <div className="plan-grid">
            <div className="twrap">
              <table className="tbl ptbl">
                <thead>
                  <tr>
                    <th /><th>Cầu thủ</th>
                    {plan.periods.map((_, k) => (
                      <th key={k} className="per">Đợt {k + 1}<br /><span style={{ fontWeight: 500, textTransform: 'none' }}>{Math.round(k * step)}&apos;–{Math.round((k + 1) * step)}&apos;</span></th>
                    ))}
                    <th>Ra sân</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.info.map((i) => {
                    const p = byId(i.player.id)!;
                    return (
                      <tr key={i.player.id}>
                        <td>{i.ex && <span className="tier ex" title="Cá nhân xuất sắc">★</span>}</td>
                        <td><span className="who"><Avatar p={p} size={24} />{shortName(p)} <span className={`chip ${p.payType}`}>{i.quy ? 'Quỹ' : 'Lẻ'}</span></span></td>
                        {plan.periods.map((pd, k) => {
                          const s = pd.assign.indexOf(i);
                          if (s < 0) return <td key={k} className="cell"><i>·</i></td>;
                          const pos = plan.slots[s];
                          return <td key={k} className="cell"><span className="pp" tabIndex={0} style={{ background: tierColor(i.r[pos]) }} data-x={`p:${p.id}:${pos}`}>{pos}</span></td>;
                        })}
                        <td className="mins">{i.t}/{P} · {Math.round(i.t * step)}&apos;</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot><tr><td /><td>Điểm TB đội</td>{plan.periods.map((pd, k) => <td key={k}>{fmt1(pd.avg)}</td>)}<td /></tr></tfoot>
              </table>
            </div>
            <div>
              <h3 className="st" style={{ fontSize: 16 }}>Lịch thay người</h3>
              {(() => {
                const groups = Array.from({ length: P - 1 }, (_, j) => ({ k: j + 1, L: subsOf(plan, j + 1) })).filter((x) => x.L.length);
                return groups.length ? (
                  <div className="subs">
                    {groups.map(({ k, L }) => (
                      <div key={k} className="subgrp"><div className="min">Phút {Math.round(k * step)}</div><ul>{L.map(line)}</ul></div>
                    ))}
                  </div>
                ) : <p className="hint" style={{ margin: 0 }}>Không cần thay người: đội hình giữ nguyên cả trận.</p>;
              })()}
              <p className="hint">
                {plan.N} người đi · {plan.info.every((i) => i.t > 0) ? 'ai cũng được ra sân' : 'có người chưa được ra sân, hãy tăng số đợt'}
                {plan.N > 7 ? ` · tối thiểu ${plan.min} đợt/người` : ''}.
              </p>
              {canEdit && (
                <button type="button" className="btn primary" style={{ marginTop: 6 }} onClick={() => {
                  onApply(plan.periods[0].assign.map((i) => i?.player.id ?? null));
                  onClose();
                }}>Đưa đội hình đợt 1 lên sân</button>
              )}
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
