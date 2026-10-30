'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DAY_SHORT, FORMATION_IDS, POS_INFO, ageOf, autoPick, buildPlan, changeFormation, cleanLineup, dayOfWeek, dm, faceStats, fmt1,
  isNatural, lineupSummary, mvpCounts, placeInLineup, planSummary, positionScore, rankedPositions, removeFromLineup, shortName,
  slotGlow, slotsOf, subsOf, suggestForPosition, swapSlots, todayVN, playerSeason, type LineupPlayer, type Position,
} from '@san7/core';
import { useTeam } from '../TeamContext';
import { Avatar, Tip, tierColor } from '../ui';
import { saveLineupAction } from '@/app/actions';
import { byKick, goingIds, isPlayed, seasonOf } from '@/lib/season';
import type { MatchDTO, PlayerDTO } from '@/lib/types';
import { usePlayerModal } from '../players/PlayersView';
import { PlanModal } from './PlanModal';
import { MatchModal } from '../matches/MatchModal';

const lineCls = (pos: string) => (pos === 'GK' ? 'gk' : ['CB', 'LB', 'RB'].includes(pos) ? 'df' : pos === 'ST' ? 'fw' : 'mf');
type Sel = { type: 'slot'; slot: number } | { type: 'bench'; id: string } | null;

export function TacticsView({ mode, matchId }: { mode: 'tong' | 'tran'; matchId?: string }) {
  const { view, players, byId, canEdit, act, teamId, toast } = useTeam();
  const router = useRouter();
  const today = todayVN(new Date(view.now));
  const upcoming = useMemo(() => view.matches.filter((m) => !isPlayed(m) && m.date >= today).sort(byKick), [view.matches, today]);
  const match: MatchDTO | null = mode === 'tran' ? upcoming.find((m) => m.id === matchId) ?? upcoming[0] ?? null : null;
  const going = useMemo(() => (match ? new Set(goingIds(match)) : null), [match]);
  const pool = useMemo(() => (going ? players.filter((p) => going.has(p.id)) : players), [players, going]);
  const plan = useMemo(() => (match ? buildPlan(pool, match.formation ?? view.team.formation, view.team.plan) : null), [match, pool, view.team.formation, view.team.plan]);

  const initial = () => {
    if (!match) return { formation: view.team.formation, lineup: cleanLineup(view.team.lineup, players.map((p) => p.id)) };
    const f = match.formation ?? view.team.formation;
    if (match.lineup?.some(Boolean)) return { formation: f, lineup: cleanLineup(match.lineup, players.map((p) => p.id)) };
    // trận chưa có đội hình: lấy đợt 1 của kế hoạch thay người (prototype)
    const p1 = plan?.periods[0]?.assign.map((i) => i?.player.id ?? null);
    return { formation: f, lineup: cleanLineup(p1 ?? [], players.map((p) => p.id)) };
  };
  const [state, setState] = useState(initial);
  const [sel, setSel] = useState<Sel>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [attOpen, setAttOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropOn, setDropOn] = useState<number | 'bench' | null>(null);
  const modal = usePlayerModal();
  const key = `${mode}:${match?.id ?? ''}`;
  const lastKey = useRef(key);
  useEffect(() => {
    if (lastKey.current !== key) {
      lastKey.current = key;
      setState(initial());
      setSel(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const { formation, lineup } = state;
  const slots = slotsOf(formation);
  const season = useMemo(() => seasonOf(view.matches), [view.matches]);
  const mvp = useMemo(() => mvpCounts(season, view.year), [season, view.year]);
  const lp = useMemo(() => new Map<string, LineupPlayer>(players.map((p) => [p.id, { ...p, name: shortName(p) }])), [players]);
  const sum = lineupSummary(formation, lineup, lp, going);

  const commit = (next: { formation: string; lineup: Array<string | null> }, msg?: string) => {
    if (!canEdit) return toast('Chỉ đội trưởng mới thay đổi được mục này');
    setState(next);
    act(() => saveLineupAction(teamId, next, match?.id ?? null), msg);
  };
  const place = (pid: string, slot: number) => commit({ formation, lineup: placeInLineup(lineup, pid, slot) });

  const slotClick = (i: number) => {
    if (!canEdit) return setSel(sel?.type === 'slot' && sel.slot === i ? null : { type: 'slot', slot: i });
    if (sel) {
      if (sel.type === 'bench') place(sel.id, i);
      else if (sel.slot !== i) commit({ formation, lineup: swapSlots(lineup, sel.slot, i) });
      setSel(null);
    } else setSel({ type: 'slot', slot: i });
  };
  const benchClick = (id: string) => {
    if (!canEdit) return setSel(sel?.type === 'bench' && sel.id === id ? null : { type: 'bench', id });
    if (sel?.type === 'slot') {
      place(id, sel.slot);
      setSel(null);
    } else if (sel?.type === 'bench' && sel.id === id) setSel(null);
    else setSel({ type: 'bench', id });
  };

  const selSlot = sel?.type === 'slot' ? sel.slot : -1;
  const focusP = sel ? byId(sel.type === 'bench' ? sel.id : lineup[sel.slot]) : undefined;
  const focusPos = selSlot >= 0 ? slots[selSlot][0] : null;
  const { glow, best: bestSlot } = focusP ? slotGlow(formation, lineup, focusP) : { glow: {} as Record<number, number>, best: -1 };
  const onPitch = new Set(lineup.filter(Boolean) as string[]);
  const bench = pool.filter((p) => !onPitch.has(p.id)).sort((a, b) => (a.num ?? 99) - (b.num ?? 99));
  const topIds = focusPos ? suggestForPosition(bench, focusPos).map((x) => x.player.id) : [];
  const glowCls = (i: number) => {
    if (!(i in glow)) return '';
    const v = glow[i];
    return (v >= 8 ? ' glow-good' : v >= 6.5 ? ' glow-ok' : ' glow-bad') + (i === bestSlot && v >= 6.5 ? ' glow-best' : '');
  };

  const who = (p: PlayerDTO) => (
    <span className="who">
      <Avatar p={p} size={28} />
      <span className="nm2">
        {p.num != null && <small>{p.num}</small>}
        {shortName(p)}
        {p.isCaptain && <> <span className="cbadge">C</span></>}
        {mvp.get(p.id) ? <> <span className="mvpt">★{mvp.get(p.id)}</span></> : null}
      </span>
    </span>
  );

  const drag = (id: string) => ({
    draggable: canEdit,
    onDragStart: (e: React.DragEvent) => {
      if (!canEdit) return e.preventDefault();
      setDragId(id);
      e.dataTransfer.setData('text/plain', id);
      e.dataTransfer.effectAllowed = 'move';
    },
    onDragEnd: () => {
      setDragId(null);
      setDropOn(null);
    },
  });
  const dropSlot = (i: number) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!dragId) return;
      e.preventDefault();
      setDropOn(i);
    },
    onDrop: (e: React.DragEvent) => {
      if (!dragId) return;
      e.preventDefault();
      place(dragId, i);
      setDragId(null);
      setDropOn(null);
      setSel(null);
    },
  });

  const summaryPlan = plan && plan.N ? planSummary(plan, view.team.plan) : null;
  const firstSubs = (() => {
    if (!plan?.periods.length) return null;
    for (let k = 1; k < plan.P; k++) {
      const L = subsOf(plan, k).filter((x) => x.type === 'sub');
      if (L.length) return { k, L };
    }
    return null;
  })();

  return (
    <section className="view">
      <div className="view-head" style={{ marginBottom: 14 }}>
        <div className="seg subtabs" role="group" aria-label="Loại chiến thuật">
          <Link href={`/t/${teamId}/chien-thuat`} role="button" aria-pressed={mode === 'tong'}>Chiến thuật tổng</Link>
          <Link href={`/t/${teamId}/tran-toi`} role="button" aria-pressed={mode === 'tran'}>Trận sắp tới</Link>
        </div>
        <span className="muted" style={{ fontSize: 12.5 }}>
          {mode === 'tran' && match ? 'Đội hình và sơ đồ ở đây chỉ áp dụng cho trận đang chọn, lấy từ danh sách điểm danh.' : ''}
        </span>
      </div>
      <div className="tacbar">
        <div className="tb-grp">
          <span className="tb-lbl">Sơ đồ</span>
          <div className="seg disp" role="group" aria-label="Sơ đồ">
            {FORMATION_IDS.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={f === formation}
                disabled={!canEdit}
                onClick={() => {
                  if (f === formation) return;
                  const nl = changeFormation(formation, lineup, f, (id, pos) => {
                    const p = byId(id);
                    return p ? positionScore(p.stats, p.foot, pos) : 0;
                  });
                  setSel(null);
                  commit({ formation: f, lineup: nl }, 'Đã đổi sang sơ đồ ' + f);
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="tb-stats">
          <span><b style={{ color: sum.avg != null ? tierColor(sum.avg) : 'inherit' }}>{sum.avg != null ? fmt1(sum.avg) : '–'}</b>Điểm đội hình</span>
          <span><b>{sum.filled}/{sum.size}</b>Ra sân</span>
          <span><b>{sum.natural}/{sum.filled}</b>Đúng sở trường</span>
        </div>
        {canEdit && (
          <div className="row-actions">
            <button className="btn sm" type="button" onClick={() => {
              setSel(null);
              commit({ formation, lineup: autoPick(pool, formation) }, match ? 'Đã xếp từ những người đi trận này' : 'Đã xếp đội hình mạnh nhất theo điểm');
            }}>Xếp tự động</button>
            <button className="btn ghost sm" type="button" onClick={() => {
              setSel(null);
              commit({ formation, lineup: lineup.map(() => null) });
            }}>Bỏ hết</button>
          </div>
        )}
      </div>

      <div className="tac">
        <div className="pitch-col">
          <div className="pitch">
            <svg className="lines" viewBox="0 0 400 600" preserveAspectRatio="none" aria-hidden="true">
              <rect x="14" y="14" width="372" height="572" rx="2" /><line x1="14" y1="300" x2="386" y2="300" />
              <circle cx="200" cy="300" r="52" /><circle className="dot" cx="200" cy="300" r="3.5" />
              <rect x="100" y="14" width="200" height="96" /><rect x="155" y="14" width="90" height="34" /><circle className="dot" cx="200" cy="82" r="3" />
              <rect x="100" y="490" width="200" height="96" /><rect x="155" y="552" width="90" height="34" /><circle className="dot" cx="200" cy="518" r="3" />
              <rect x="170" y="4" width="60" height="10" /><rect x="170" y="586" width="60" height="10" />
            </svg>
            <div>
              {slots.map(([pos, x, y], i) => {
                const p = byId(lineup[i]);
                const isSel = selSlot === i;
                const fs = i in glow ? <span className="fs" style={{ ['--fit' as string]: tierColor(glow[i]) }}>{i === bestSlot ? '★ ' : ''}{fmt1(glow[i])}</span> : null;
                const style = { left: `${x}%`, top: `${y}%` } as React.CSSProperties;
                if (!p) {
                  return (
                    <button key={i} type="button" className={`slot${pos === 'GK' ? ' gk' : ''}${isSel ? ' sel' : ''}${glowCls(i)}${dropOn === i ? ' drop' : ''}`} style={style} onClick={() => slotClick(i)} aria-label={`${POS_INFO[pos].vn}, trống`} {...dropSlot(i)}>
                      {fs}<span className="disc">+</span><span className="nm">{pos}</span>
                    </button>
                  );
                }
                const sc = positionScore(p.stats, p.foot, pos);
                const nat = isNatural(p, pos);
                const mv = mvp.get(p.id);
                return (
                  <button key={i} type="button" className={`slot filled${pos === 'GK' ? ' gk' : ''}${isSel ? ' sel' : ''}${glowCls(i)}${dropOn === i ? ' drop' : ''}`} style={{ ...style, ['--fit' as string]: tierColor(sc) }} onClick={() => slotClick(i)} aria-label={`${shortName(p)} số ${p.num ?? ''}, ${POS_INFO[pos].vn}, điểm ${fmt1(sc)}`} {...drag(p.id)} {...dropSlot(i)}>
                    {fs}
                    <span className="disc">
                      {p.avatarUrl ? <Avatar p={p} size={44} /> : (p.num ?? '')}
                      {p.isCaptain && <span className="cap">C</span>}
                      {mv ? <span className="mvps" title={`${mv} lần MVP năm ${view.year}`}>★{mv}</span> : null}
                      {p.avatarUrl && p.num != null && <span className="shirt">{p.num}</span>}
                      <span className="rt">{fmt1(sc)}</span>
                    </span>
                    <span className="nm">{shortName(p)}</span>
                    <span className="ps">{pos}{nat ? '' : ' · lệch'}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="legend">
            <span><i style={{ background: 'var(--good)' }} />Rất hợp (≥ 8)</span>
            <span><i style={{ background: 'var(--ok)' }} />Tạm ổn (6.5–7.9)</span>
            <span><i style={{ background: 'var(--bad)' }} />Không hợp (&lt; 6.5)</span>
          </div>
        </div>

        <div className="tac-side">
          {mode === 'tran' && (
            <div className="panel matchbar">
              <div className="mb-row">
                <div className="field" style={{ flex: 1, minWidth: 200 }}>
                  <label htmlFor="tacMatch">Trận</label>
                  <select id="tacMatch" value={match?.id ?? ''} disabled={!upcoming.length} onChange={(e) => router.push(`/t/${teamId}/tran-toi?tran=${e.target.value}`)}>
                    {upcoming.length ? upcoming.map((m) => (
                      <option key={m.id} value={m.id}>{DAY_SHORT[dayOfWeek(m.date)]} {dm(m.date)} {m.time ?? ''} vs {m.opponent} · {goingIds(m).length} người đi</option>
                    )) : <option>Chưa có trận sắp tới</option>}
                  </select>
                </div>
                <button type="button" className="btn sm" disabled={!match} onClick={() => setAttOpen(true)}>Điểm danh</button>
              </div>
              <div className="attsum">
                {match ? (
                  <>
                    <span><b>{pool.length}</b> đi</span>
                    <span><b>{Object.values(match.attendance).filter((a) => a.status === 'nghi').length}</b> nghỉ</span>
                    <span><b>{Math.max(0, players.length - Object.keys(match.attendance).length)}</b> chưa trả lời</span>
                    {match.venue && <span className="muted">{match.venue}</span>}
                    {pool.length < view.team.fullSquad && <span className="warn">Thiếu {view.team.fullSquad - pool.length} người</span>}
                  </>
                ) : (
                  <span className="muted">Tạo trận ở tab Lịch đấu để lên đội hình cho trận.</span>
                )}
              </div>
              {match && (
                <button type="button" className="plansum" onClick={() => setPlanOpen(true)}>
                  <span className="t">Đề xuất thay người</span>
                  {!plan?.N ? (
                    <span className="d">Chưa ai xác nhận đi trận này. Bấm Điểm danh trước.</span>
                  ) : (
                    <>
                      <span className="d">
                        {plan.N} người đi · {plan.P} đợt × {Math.round(summaryPlan!.step)}&apos; · {summaryPlan!.subs} lượt thay ·{' '}
                        {plan.N < 7 ? <span className="warn">thiếu {7 - plan.N} người</span> : `ai cũng đá ít nhất ${summaryPlan!.minMinutes}'`}
                      </span>
                      {firstSubs ? (
                        <span className="nx">
                          <b>{Math.round(firstSubs.k * summaryPlan!.step)}&apos;</b>{' '}
                          {firstSubs.L.slice(0, 2).map((x) => (x.type === 'sub' ? `${shortName(byId(x.in.player.id))} vào${x.out ? ', ' + shortName(byId(x.out.player.id)) + ' ra' : ''}` : '')).join(' · ')}
                          {firstSubs.L.length > 2 ? ' …' : ''}
                        </span>
                      ) : (
                        <span className="nx">Giữ nguyên đội hình cả trận</span>
                      )}
                    </>
                  )}
                  <span className="go">Xem kế hoạch ›</span>
                </button>
              )}
            </div>
          )}

          <div className={`pcard2${focusP || focusPos ? ' open' : ''}`} aria-live="polite">
            {focusP ? (
              <PlayerCard
                p={focusP}
                slotIndex={lineup.indexOf(focusP.id)}
                pos={lineup.indexOf(focusP.id) >= 0 ? slots[lineup.indexOf(focusP.id)][0] : rankedPositions(focusP.stats, focusP.foot)[0][0]}
                bestText={bestSlot >= 0 ? `Hợp nhất trên sân: ${slots[bestSlot][0]} (${fmt1(glow[bestSlot])}). ` : ''}
                hint={!canEdit ? '' : focusPos ? 'Chạm vị trí khác trên sân để đổi chỗ, hoặc chọn người thay bên dưới.' : 'Chạm vị trí sáng trên sân để xếp vào.'}
                mvp={mvp.get(focusP.id) ?? 0}
                onClose={() => setSel(null)}
                onProfile={() => modal.open(focusP.id)}
                onBench={canEdit && lineup.includes(focusP.id) ? () => {
                  commit({ formation, lineup: removeFromLineup(lineup, focusP.id) });
                  setSel(null);
                } : undefined}
                suggestions={focusPos && canEdit ? <Suggest pos={focusPos} ids={topIds} onPick={(id) => { place(id, selSlot); setSel(null); }} /> : null}
              />
            ) : focusPos ? (
              <>
                <div className="pc2-top">
                  <span className={`posb big ${lineCls(focusPos)}`}>{focusPos}</span>
                  <div className="pc2-id"><h3>{POS_INFO[focusPos].vn}</h3><div className="muted" style={{ fontSize: 12 }}>Vị trí đang trống{canEdit ? ' · chọn người ở dưới hoặc ở bảng dự bị' : ''}</div></div>
                  <button type="button" className="btn ghost sm" onClick={() => setSel(null)} aria-label="Bỏ chọn">Bỏ chọn</button>
                </div>
                <div className="sec-title">Người hợp nhất ở {focusPos}</div>
                <Suggest pos={focusPos} ids={topIds} onPick={(id) => { if (canEdit) { place(id, selSlot); setSel(null); } }} />
              </>
            ) : (
              <>
                <div className="sec-title">Tổng quan đội hình</div>
                <div className="styles-sum" style={{ margin: 0 }}>
                  <span className="lbl">Lối chơi nổi bật</span>
                  {sum.styles.length ? sum.styles.map(([x, c]) => <span key={x} className="tag big">{x} ×{c}</span>) : <span className="lbl">chưa có ai trên sân</span>}
                </div>
                <p className="hint" style={{ margin: 0 }}>{sum.tips.length ? sum.tips.join(' ') : 'Đội hình cân bằng. Sẵn sàng ra sân.'}</p>
              </>
            )}
          </div>

          <div className="panel" style={{ padding: '8px 10px' }}>
            <div className="twrap">
              <table className="ltbl">
                <thead><tr><th>Vị trí</th><th>Cầu thủ</th><th>Điểm</th></tr></thead>
                <tbody>
                  {slots.map(([pos], i) => {
                    const p = byId(lineup[i]);
                    const g = i in glow ? (glow[i] >= 8 ? ' g-good' : glow[i] >= 6.5 ? ' g-ok' : ' g-bad') + (i === bestSlot && glow[i] >= 6.5 ? ' g-top' : '') : '';
                    const sc = p ? positionScore(p.stats, p.foot, pos) : 0;
                    return (
                      <tr key={i} className={`${selSlot === i ? 'sel' : ''}${g}${dropOn === i ? ' drop' : ''}`} tabIndex={0} onClick={(e) => !(e.target as Element).closest('[data-x]') && slotClick(i)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), slotClick(i))} {...(p ? drag(p.id) : {})} {...dropSlot(i)}>
                        <td><span className={`posb ${lineCls(pos)}`}>{pos}</span>{i in glow && <small className="gl" style={{ color: tierColor(glow[i]) }}>{i === bestSlot ? '★ ' : ''}{fmt1(glow[i])}</small>}</td>
                        <td>{p ? who(p) : <span className="muted">Trống</span>}</td>
                        <td>{p && <><span className="sc" tabIndex={0} data-x={`p:${p.id}:${pos}`} style={{ ['--fit' as string]: tierColor(sc) }}>{fmt1(sc)}</span>{!isNatural(p, pos) && <small className="lech">lệch</small>}</>}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tbody
                  className={`bench-b${dropOn === 'bench' ? ' drop' : ''}`}
                  onDragOver={(e) => {
                    if (dragId && onPitch.has(dragId)) {
                      e.preventDefault();
                      setDropOn('bench');
                    }
                  }}
                  onDrop={(e) => {
                    if (!dragId) return;
                    e.preventDefault();
                    commit({ formation, lineup: removeFromLineup(lineup, dragId) });
                    setDragId(null);
                    setDropOn(null);
                  }}
                >
                  <tr className="sep"><th colSpan={3}>Dự bị · {bench.length}{focusPos ? ` · điểm ở vị trí ${focusPos}` : ''}</th></tr>
                  {bench.length ? bench.map((p) => {
                    const isSel = sel?.type === 'bench' && sel.id === p.id;
                    let [bk, bv] = rankedPositions(p.stats, p.foot)[0] as [Position, number];
                    let g = '';
                    let rk = '';
                    if (focusPos) {
                      bk = focusPos;
                      bv = positionScore(p.stats, p.foot, focusPos);
                      g = bv >= 8 ? ' g-good' : bv >= 6.5 ? ' g-ok' : ' g-bad';
                      const t = topIds.indexOf(p.id);
                      if (t >= 0) {
                        rk = t === 0 ? 'Hợp nhất' : 'Hợp #' + (t + 1);
                        if (t === 0) g += ' g-top';
                      }
                    }
                    return (
                      <tr key={p.id} className={`brow${isSel ? ' sel' : ''}${g}`} tabIndex={0} onClick={(e) => !(e.target as Element).closest('[data-x]') && benchClick(p.id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), benchClick(p.id))} {...drag(p.id)}>
                        <td><span className={`posb ${lineCls(bk)}`}>{bk}</span></td>
                        <td>{who(p)}{rk && <span className="rk">{rk}</span>}</td>
                        <td><span className="sc" tabIndex={0} data-x={`p:${p.id}:${bk}`} style={{ ['--fit' as string]: tierColor(bv) }}>{fmt1(bv)}</span></td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan={3} className="muted" style={{ textAlign: 'left' }}>
                      {!pool.length ? (match ? 'Chưa ai xác nhận đi trận này. Bấm Điểm danh ở trên.' : 'Đội chưa có ai. Thêm cầu thủ ở tab Cầu thủ.') : 'Mọi người đều đang trên sân.'}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="hint" style={{ margin: '8px 6px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Tip text="Chạm một cầu thủ để xem thẻ và các vị trí hợp với họ, rồi chạm vị trí trên sân hoặc dòng trong bảng để xếp. Chạm một vị trí để xem ai hợp nhất. Trên máy tính có thể kéo thả." />
              Cách xếp đội hình
            </p>
          </div>
        </div>
      </div>
      {modal.node}
      {planOpen && match && (
        <PlanModal
          match={match}
          pool={pool}
          formation={formation}
          onClose={() => setPlanOpen(false)}
          onApply={(first) => commit({ formation, lineup: first }, 'Đã đưa đội hình đợt 1 lên sân')}
        />
      )}
      {attOpen && match && <MatchModal matchId={match.id} initialTab="att" onClose={() => setAttOpen(false)} />}
    </section>
  );

  function Suggest({ pos, ids, onPick }: { pos: Position; ids: string[]; onPick: (id: string) => void }) {
    const L = ids.map((id) => byId(id)!).filter(Boolean);
    if (!L.length) return <p className="hint" style={{ margin: 0 }}>Không có người dự bị nào đạt từ 6.5 ở vị trí này.</p>;
    return (
      <div className="sugg">
        {L.map((p, i) => {
          const v = positionScore(p.stats, p.foot, pos);
          return (
            <button key={p.id} type="button" className="sg" onClick={() => onPick(p.id)}>
              <Avatar p={p} size={30} />
              <span>{shortName(p)}<small>{i === 0 ? 'Hợp nhất' : 'Hợp #' + (i + 1)} · dự bị</small></span>
              <b style={{ color: tierColor(v) }}>{fmt1(v)}</b>
            </button>
          );
        })}
      </div>
    );
  }
}

function PlayerCard(props: {
  p: PlayerDTO; slotIndex: number; pos: Position; bestText: string; hint: string; mvp: number; onClose: () => void; onProfile: () => void;
  onBench?: () => void; suggestions: React.ReactNode;
}) {
  const { view } = useTeam();
  const { p, pos } = props;
  const cs = positionScore(p.stats, p.foot, pos);
  const se = playerSeason(seasonOf(view.matches), view.year, p.id);
  const a = ageOf(p.dob, new Date(view.now));
  const rk = rankedPositions(p.stats, p.foot).filter(([k, v]) => !(k === 'GK' && v < 6)).slice(0, 4);
  return (
    <>
      <div className="pc2-top">
        <Avatar p={p} size={64} />
        <div className="pc2-id">
          <div className="pc2-pos">
            <span className={`posb ${lineCls(pos)}`}>{pos}</span>
            <b tabIndex={0} style={{ color: tierColor(cs) }} data-x={`p:${p.id}:${pos}`}>{fmt1(cs)}</b>
            <span className="muted">{props.slotIndex >= 0 ? 'vị trí đang đá' : 'vị trí hợp nhất'}</span>
          </div>
          <h3>{p.num != null && <small>{p.num}</small>}{shortName(p)}{props.mvp > 0 && <> <span className="mvpt" style={{ fontSize: 20 }}>★{props.mvp}</span></>}</h3>
          <div className="muted" style={{ fontSize: 12 }}>
            {p.fullName}{a != null ? ` · ${a} tuổi` : ''} · chân {p.foot.toLowerCase()} · <span className={`chip ${p.payType}`}>{p.payType === 'le' ? 'Đá lẻ' : 'Quỹ'}</span>
          </div>
        </div>
        <button type="button" className="btn ghost sm" onClick={props.onClose} aria-label="Bỏ chọn">Bỏ chọn</button>
      </div>
      <div className="face2">{faceStats(p.stats).map((f) => <div key={f.label}><b style={{ color: tierColor(f.value) }}>{Math.round(f.value * 10)}</b><span>{f.label}</span></div>)}</div>
      <div className="pc-pos">
        {rk.map(([k, v], i) => <span key={k} className={`pchip${i === 0 ? ' best' : ''}`} tabIndex={0} data-x={`p:${p.id}:${k}`} style={{ ['--fit' as string]: tierColor(v) }}><b>{k}</b><em>{fmt1(v)}</em></span>)}
        {p.styles.slice(0, 3).map((x) => <span key={x} className="tag">{x}</span>)}
      </div>
      <div className="season"><span><b>{se.gp}</b>trận</span><span><b>{se.goals}</b>bàn</span><span><b>{se.assists}</b>kiến tạo</span><span><b>{se.mvp}</b>MVP {view.year}</span></div>
      <p className="hint" style={{ margin: 0 }}>{props.bestText}{props.hint}</p>
      {props.suggestions && <><div className="sec-title">Người thay hợp nhất ở {pos}</div>{props.suggestions}</>}
      <div className="row-actions">
        <button type="button" className="btn sm" onClick={props.onProfile}>Xem hồ sơ</button>
        {props.onBench && <button type="button" className="btn ghost sm" onClick={props.onBench}>Cho ra dự bị</button>}
      </div>
    </>
  );
}
