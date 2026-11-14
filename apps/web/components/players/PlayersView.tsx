'use client';

import { useMemo, useState } from 'react';
import { POS_INFO, ageOf, allScores, cardTier, dm, faceStats, fmt1, foldText, rankedPositions, shortName, playerSeason, type SeasonMatch } from '@san7/core';
import { useTeam } from '../TeamContext';
import { Avatar, Modal } from '../ui';
import { InvitePanel } from '../InvitePanel';
import { byKick, isPlayed, seasonOf } from '@/lib/season';
import { Radar } from './Radar';
import { ViewCardButton } from '../honors/PlayerCard';
import { XOverlay } from '../v2/XOverlay';
import { Locker } from '../locker/Locker';
import { lineCls } from '@/lib/pos';
import { PlayerModal, blankPlayer, type PlayerDraft } from './PlayerModal';
import { removePlayerAction, savePlayerAction, submitProfileEditAction, requestStatReviewAction, requestStatReviewManyAction, remindUpdateStatsAction } from '@/app/actions';
import type { MatchDTO, PlayerDTO } from '@/lib/types';

const GROUPS = ['Tất cả', 'Thủ môn', 'Hậu vệ', 'Tiền vệ', 'Tiền đạo', 'Đá lẻ'] as const;
type Sort = 'num' | 'best' | 'name';

export const toDraft = (p: PlayerDTO): PlayerDraft => ({
  id: p.id, fullName: p.fullName, nick: p.nick, dob: p.dob, num: p.num, foot: p.foot, payType: p.nextPayType ?? p.payType,
  avatarUrl: p.avatarUrl, styles: p.styles, stats: p.stats, isCaptain: p.isCaptain,
  curPayType: p.payType, payFrom: p.nextPayType ? 'next' : 'now',
});

export const profilePayload = (d: PlayerDraft) => ({
  fullName: d.fullName.trim(), nick: d.nick?.trim() || null, dob: d.dob || null, num: d.num, foot: d.foot, styles: d.styles,
  avatarUrl: d.avatarUrl || null, stats: d.stats, payType: d.payType, isCaptain: d.isCaptain, payFrom: d.payFrom,
});

/** Hook mở modal cầu thủ đúng chế độ: sửa (ĐT), tự sửa (thành viên), xem (khách). */
export function usePlayerModal() {
  const { view, byId, act, teamId, canEdit } = useTeam();
  const [open, setOpen] = useState<{ id: string | null } | null>(null);
  const node = (() => {
    if (!open) return null;
    const p = open.id ? byId(open.id) : undefined;
    if (open.id && !p) return null;
    const mode = canEdit ? 'edit' : p && p.id === view.myPlayerId ? 'self' : 'view';
    if (!p && mode !== 'edit') return null;
    const title = p ? `${shortName(p)}${mode === 'view' ? ' · chỉ xem' : mode === 'self' ? ' · hồ sơ của tôi' : ''}` : 'Thêm cầu thủ';
    return (
      <PlayerModal
        key={open.id ?? 'new'}
        mode={mode}
        initial={p ? toDraft(p) : blankPlayer()}
        title={title}
        pendingNote={mode === 'self' && view.myPendingEdit}
        onClose={() => setOpen(null)}
        onSave={async (d) => {
          if (mode === 'self') return !!(await act(() => submitProfileEditAction(teamId, profilePayload(d)), 'Đã gửi — cả đội chấm, đội trưởng chốt'));
          const r = await act(() => savePlayerAction(teamId, p?.id ?? null, profilePayload(d)), p ? 'Đã lưu hồ sơ' : 'Đã thêm cầu thủ');
          return !!r;
        }}
        onDelete={p ? async () => void (await act(() => removePlayerAction(teamId, p.id), (r) => (r.soft ? `Đã chuyển ${shortName(p)} sang "đã rời đội"` : `Đã xoá ${shortName(p)}`))) : undefined}
        footerExtra={
          // ĐT: lấy ý kiến cả đội về chỉ số của người này, hoặc nhắc người đó tự cập nhật (BRD 4.7)
          mode === 'edit' && p ? (
            <>
              <button type="button" className="btn sm" onClick={() => act(() => requestStatReviewAction(teamId, p.id), (n) => `Đã nhờ ${n} người chấm chỉ số ${shortName(p)}`)}>Yêu cầu cả đội chấm</button>
              {p.hasAccount && p.id !== view.myPlayerId && (
                <button type="button" className="btn sm" onClick={() => act(() => remindUpdateStatsAction(teamId, p.id), `Đã nhắc ${shortName(p)} cập nhật chỉ số`)}>Nhắc cập nhật chỉ số</button>
              )}
            </>
          ) : undefined
        }
      />
    );
  })();
  return { open: (id: string | null) => setOpen({ id }), node };
}

export function PlayersView() {
  const { view, players, canEdit, byId } = useTeam();
  const [group, setGroup] = useState<(typeof GROUPS)[number]>('Tất cả');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('num');
  const modal = usePlayerModal();
  const [poll, setPoll] = useState(false);
  const [locker, setLocker] = useState(false);
  const now = new Date(view.now);
  const season = useMemo(() => seasonOf(view.matches), [view.matches]);
  const played = useMemo(() => view.matches.filter(isPlayed).sort(byKick), [view.matches]);
  const reviewing = new Set(view.statReviews.map((r) => r.playerId));
  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  const flip = (id: string) => setFlipped((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  // So sánh 2 cầu thủ: chọn người thứ nhất → khay nhắc chọn người thứ hai → mở bảng so sánh
  const [cmp, setCmp] = useState<string[]>([]);
  const [pair, setPair] = useState<[string, string] | null>(null);
  const toggleCmp = (id: string) => {
    const next = cmp.includes(id) ? cmp.filter((x) => x !== id) : [...cmp, id].slice(-2);
    if (next.length === 2) {
      setPair([next[0], next[1]]);
      setCmp([]);
    } else setCmp(next);
  };

  const list = useMemo(() => {
    let ps = players.map((p) => ({ p, rk: rankedPositions(p.stats, p.foot) }));
    if (group === 'Đá lẻ') ps = ps.filter((x) => x.p.payType === 'le');
    else if (group !== 'Tất cả') ps = ps.filter((x) => POS_INFO[x.rk[0][0]].group === group);
    if (q.trim()) {
      const f = foldText(q);
      ps = ps.filter((x) => foldText(x.p.fullName).includes(f) || foldText(x.p.nick).includes(f));
    }
    const by: Record<Sort, (a: (typeof ps)[number], b: (typeof ps)[number]) => number> = {
      num: (a, b) => (a.p.num ?? 99) - (b.p.num ?? 99),
      best: (a, b) => b.rk[0][1] - a.rk[0][1],
      name: (a, b) => shortName(a.p).localeCompare(shortName(b.p), 'vi'),
    };
    return ps.sort(by[sort]);
  }, [players, group, q, sort]);

  return (
    <section className="view">
      <div style={{ display: 'grid', gap: 14 }}>
        <div className="view-head">
          <h2 className="vt">Cầu thủ <span>· {players.length} người</span></h2>
          <div className="row-actions">
            <div className="filters">
              {GROUPS.map((g) => <button key={g} type="button" className="chipbtn" aria-pressed={g === group} onClick={() => setGroup(g)}>{g}</button>)}
            </div>
            <input type="search" className="mini" placeholder="Tìm tên" aria-label="Tìm cầu thủ" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="mini" aria-label="Sắp xếp" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="num">Theo số áo</option>
              <option value="best">Điểm cao nhất</option>
              <option value="name">Theo tên</option>
            </select>
            <button className="btn" type="button" onClick={() => setLocker(true)}>Phòng thay đồ 3D</button>
            {canEdit && <button className="btn" type="button" onClick={() => setPoll(true)}>Trưng cầu chỉ số</button>}
            {canEdit && <button className="btn primary" type="button" onClick={() => modal.open(null)}>+ Thêm cầu thủ</button>}
          </div>
        </div>
        <InvitePanel />
        <div className="plist">
          {!players.length ? (
            <div className="empty-list" style={{ gridColumn: '1/-1' }}>Đội chưa có ai.{canEdit ? <> Bấm <b>+ Thêm cầu thủ</b> để tạo hồ sơ đầu tiên.</> : null}</div>
          ) : !list.length ? (
            <div className="empty-list" style={{ gridColumn: '1/-1' }}>Không có cầu thủ trong nhóm này.</div>
          ) : (
            list.map(({ p, rk }) => {
              const top = rk.filter(([k, v]) => !(k === 'GK' && v < 6)).slice(0, 3);
              const a = ageOf(p.dob, now);
              const se = playerSeason(season, view.year, p.id);
              const ovr = Math.round(top[0][1] * 10);
              const onCmp = cmp.includes(p.id);
              return (
                <div
                  key={p.id}
                  className={`pcard tier-${cardTier(ovr)}${flipped.has(p.id) ? ' flip' : ''}`}
                  tabIndex={0}
                  role="button"
                  aria-label={`Thẻ ${p.fullName}, chạm để lật`}
                  aria-pressed={flipped.has(p.id)}
                  onClick={(e) => !(e.target as Element).closest('[data-x],button') && flip(p.id)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget && (e.preventDefault(), flip(p.id))}
                  onPointerMove={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    e.currentTarget.style.setProperty('--mx', `${(((e.clientX - r.left) / r.width) * 100).toFixed(0)}%`);
                    e.currentTarget.style.setProperty('--my', `${(((e.clientY - r.top) / r.height) * 100).toFixed(0)}%`);
                  }}
                >
                  <div className="pc-inner">
                    <div className="pc-face pc-front">
                      <div className="pc-card">
                        <div className="pc-ovr"><b data-x={`p:${p.id}:${top[0][0]}`} tabIndex={-1}>{ovr}</b><span className={`posb ${lineCls(top[0][0])}`}>{top[0][0]}</span></div>
                        <Avatar p={p} size={68} />
                        <div className="pc-num">{p.num ?? '–'}</div>
                      </div>
                      <div className="pc-top">
                        <div className="who">
                          <b>{shortName(p)}{p.isCaptain && <> <span className="cbadge" title="Đội trưởng">C</span></>}</b>
                          <span>{p.fullName}{se.mvp > 0 && <> · <span className="mvpt">★ {se.mvp} MVP {view.year}</span></>}</span>
                        </div>
                      </div>
                      <div className="pc-meta">
                        {a != null && <><span>{a} tuổi</span>·</>}
                        <span>chân {p.foot.toLowerCase()}</span>
                        <span className={`chip ${p.payType}`}>{p.payType === 'le' ? 'Đá lẻ' : 'Quỹ'}</span>
                        {p.nextPayType && <span className="chip" data-tt={`Từ tháng sau chuyển sang ${p.nextPayType === 'le' ? 'đá lẻ' : 'quỹ'}`}>→ {p.nextPayType === 'le' ? 'Lẻ' : 'Quỹ'}</span>}
                        {reviewing.has(p.id) && <span className="chip le" data-tt="Cả đội đang chấm chỉ số người này">Đang chấm</span>}
                      </div>
                      <div className="pc-pos">
                        {top.map(([k, v], i) => (
                          <span key={k} className={`pchip${i === 0 ? ' best' : ''}`} data-x={`p:${p.id}:${k}`} tabIndex={0} style={{ ['--fit' as string]: `var(--${v >= 8 ? 'good' : v >= 6.5 ? 'ok' : 'bad'})` }}>
                            <b>{k}</b><em>{v.toFixed(1)}</em>
                          </span>
                        ))}
                      </div>
                      <div className="face">{faceStats(p.stats).map((f) => <span key={f.label}><b>{Math.round(f.value * 10)}</b>{f.label}</span>)}</div>
                      <div className="season"><span><b>{se.gp}</b>trận</span><span><b>{se.goals}</b>bàn</span><span><b>{se.assists}</b>kiến tạo</span><span><b>{se.mvp}</b>MVP</span></div>
                    </div>
                    <div className="pc-face pc-back" aria-hidden={!flipped.has(p.id)}>
                      <div className="pcb-h"><b>{shortName(p)}</b><span className="muted" style={{ fontSize: 12 }}>chạm để lật lại</span></div>
                      <div className="radar"><Radar stats={p.stats} /></div>
                      <div className="pcb-form"><span>5 trận gần nhất</span><FormChips p={p} played={played} /></div>
                      <div className="row-actions">
                        <button type="button" className="btn primary sm" onClick={() => modal.open(p.id)} aria-label={`Mở hồ sơ ${p.fullName}`}>Mở hồ sơ</button>
                        <ViewCardButton p={p} team={view.team.name} />
                        <button type="button" className="btn sm" aria-pressed={onCmp} onClick={() => toggleCmp(p.id)}>{onCmp ? 'Bỏ so sánh' : 'So sánh'}</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      {modal.node}
      {poll && <StatPollModal onClose={() => setPoll(false)} />}
      {locker && <Locker matchId={null} onClose={() => setLocker(false)} />}
      {cmp.length === 1 && byId(cmp[0]) && (
        <div id="cmpTray" role="status">
          <span>So sánh <b>{shortName(byId(cmp[0])!)}</b> với… lật một thẻ khác và bấm So sánh</span>
          <button type="button" className="btn sm" onClick={() => setCmp([])}>Huỷ</button>
        </div>
      )}
      {pair && byId(pair[0]) && byId(pair[1]) && <Compare a={byId(pair[0])!} b={byId(pair[1])!} season={season} onClose={() => setPair(null)} />}
    </section>
  );
}

/**
 * ĐT trưng cầu ý kiến cả đội về chỉ số của nhiều cầu thủ cùng lúc (BRD 4.7): mỗi người được chọn mở một
 * đợt chấm, mỗi thành viên nhận một thông báo gộp. Người đang có đợt chấm thì giữ đợt cũ.
 */
function StatPollModal({ onClose }: { onClose: () => void }) {
  const { view, players, act, teamId } = useTeam();
  const open = new Set(view.statReviews.map((r) => r.playerId));
  const [pick, setPick] = useState<Set<string>>(() => new Set(players.map((p) => p.id)));
  const all = pick.size === players.length;
  const toggle = (id: string) => setPick((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <Modal
      title="Trưng cầu chỉ số"
      wide={560}
      onClose={onClose}
      footer={
        <>
          <span className="hint" style={{ margin: 0, marginRight: 'auto' }}>Đã chọn {pick.size}/{players.length}</span>
          <button type="button" className="btn" onClick={onClose}>Huỷ</button>
          <button
            type="button"
            className="btn primary"
            disabled={!pick.size}
            onClick={async () => {
              const r = await act(() => requestStatReviewManyAction(teamId, [...pick]), (d) => `Đã mở ${d.rounds} đợt chấm, báo ${d.notified} người`);
              if (r) onClose();
            }}
          >
            Gửi cả đội chấm
          </button>
        </>
      }
    >
      <p style={{ marginTop: 0 }}>Cả đội (kể cả bạn) chấm chỉ số những người được chọn; bạn chốt theo trung bình ở tab Duyệt.</p>
      <label className="poll-all"><input type="checkbox" checked={all} onChange={() => setPick(all ? new Set() : new Set(players.map((p) => p.id)))} /> Chọn tất cả</label>
      <div className="poll-list">
        {players.map((p) => (
          <label key={p.id} className="poll-row">
            <input type="checkbox" checked={pick.has(p.id)} onChange={() => toggle(p.id)} />
            <Avatar p={p} size={28} />
            <span>{shortName(p)}{p.num != null ? <small> · số {p.num}</small> : null}</span>
            {open.has(p.id) && <span className="chip le" style={{ marginLeft: 'auto' }}>Đang chấm</span>}
          </label>
        ))}
      </div>
    </Modal>
  );
}

/** 5 trận gần nhất của một người: nghỉ (–), có mặt (✓), ghi bàn (B), kiến tạo (KT). */
function FormChips({ p, played }: { p: PlayerDTO; played: MatchDTO[] }) {
  const ms = played.slice(-5);
  if (!ms.length) return <span>Chưa đá trận nào</span>;
  return (
    <>
      {ms.map((m) => {
        const on = m.attendance[p.id]?.status === 'di';
        const e = m.events[p.id] ?? { goals: 0, assists: 0 };
        const t = !on ? '–' : e.goals ? `${e.goals}B` : e.assists ? `${e.assists}KT` : '✓';
        const what = !on ? 'nghỉ' : [e.goals ? `${e.goals} bàn` : '', e.assists ? `${e.assists} kiến tạo` : ''].filter(Boolean).join(', ') || 'có mặt';
        return <i key={m.id} className={!on ? '' : e.goals ? 'g' : e.assists ? 'a' : 'on'} title={`${dm(m.date)} vs ${m.opponent}: ${what}`}>{t}</i>;
      })}
    </>
  );
}

/** Radar hai lớp chồng nhau cho bảng so sánh. */
function Radar2({ a, b }: { a: PlayerDTO; b: PlayerDTO }) {
  const fa = faceStats(a.stats), fb = faceStats(b.stats);
  const cx = 130, cy = 112, R = 78, n = fa.length;
  const pt = (i: number, r: number) => {
    const t = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return `${(cx + r * Math.cos(t)).toFixed(1)},${(cy + r * Math.sin(t)).toFixed(1)}`;
  };
  const poly = (f: typeof fa, c: string) => <polygon className={c} points={f.map(({ value }, i) => pt(i, (R * value) / 10)).join(' ')} />;
  return (
    <svg viewBox="0 0 260 226" role="img" aria-label={`So sánh chỉ số ${shortName(a)} và ${shortName(b)}`}>
      {[0.25, 0.5, 0.75, 1].map((t) => <polygon key={t} className="rg" points={fa.map((_, i) => pt(i, R * t)).join(' ')} />)}
      {poly(fa, 'ra')}{poly(fb, 'rb')}
      {fa.map(({ label }, i) => {
        const [x, y] = pt(i, R + 18).split(',');
        return <text key={label} x={x} y={y} textAnchor="middle" dominantBaseline="middle">{label}</text>;
      })}
    </svg>
  );
}

function Compare({ a, b, season, onClose }: { a: PlayerDTO; b: PlayerDTO; season: SeasonMatch[]; onClose: () => void }) {
  const { view } = useTeam();
  const ra = allScores(a.stats, a.foot), rb = allScores(b.stats, b.foot);
  const sa = playerSeason(season, view.year, a.id), sb = playerSeason(season, view.year, b.id);
  const fa = faceStats(a.stats), fb = faceStats(b.stats);
  const row = (l: string, x: number, y: number, f?: (v: number) => string) => (
    <div key={l} className="cr"><b className={x > y ? 'w a' : ''}>{f ? f(x) : x}</b><span>{l}</span><b className={y > x ? 'w b' : ''}>{f ? f(y) : y}</b></div>
  );
  const pos = (Object.keys(POS_INFO) as Array<keyof typeof POS_INFO>).filter((k) => k !== 'GK' || ra.GK >= 6 || rb.GK >= 6);
  const head = (p: PlayerDTO, c: string) => {
    const [k, v] = rankedPositions(p.stats, p.foot)[0];
    return <div className={`cmp-p ${c}`}><Avatar p={p} size={56} /><b>{shortName(p)}</b><em>{Math.round(v * 10)}</em><span className={`posb ${lineCls(k)}`}>{k}</span></div>;
  };
  return (
    <XOverlay cls="cmpbox" label={`So sánh ${shortName(a)} và ${shortName(b)}`} onClose={onClose}>
      <div className="cmp-h">{head(a, 'a')}<i>VS</i>{head(b, 'b')}</div>
      <div className="radar"><Radar2 a={a} b={b} /></div>
      <div className="cr-t">Chỉ số</div>
      {fa.map(({ label, value }, i) => row(label, Math.round(value * 10), Math.round(fb[i].value * 10)))}
      <div className="cr-t">Điểm theo vị trí</div>
      {pos.map((k) => row(`${k} · ${POS_INFO[k].vn}`, ra[k], rb[k], fmt1))}
      <div className="cr-t">Mùa {view.year}</div>
      {row('Trận', sa.gp, sb.gp)}{row('Bàn', sa.goals, sb.goals)}{row('Kiến tạo', sa.assists, sb.assists)}{row('MVP', sa.mvp, sb.mvp)}
      <button type="button" className="btn" style={{ justifySelf: 'center', marginTop: 12 }} onClick={onClose}>Đóng</button>
    </XOverlay>
  );
}
