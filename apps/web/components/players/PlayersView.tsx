'use client';

import { useMemo, useState } from 'react';
import { POS_INFO, ageOf, faceStats, foldText, rankedPositions, shortName, playerSeason } from '@san7/core';
import { useTeam } from '../TeamContext';
import { Avatar, Modal } from '../ui';
import { InvitePanel } from '../InvitePanel';
import { seasonOf } from '@/lib/season';
import { PlayerModal, blankPlayer, type PlayerDraft } from './PlayerModal';
import { removePlayerAction, savePlayerAction, submitProfileEditAction, requestStatReviewAction, requestStatReviewManyAction, remindUpdateStatsAction } from '@/app/actions';
import type { PlayerDTO } from '@/lib/types';

const GROUPS = ['Tất cả', 'Thủ môn', 'Hậu vệ', 'Tiền vệ', 'Tiền đạo', 'Đá lẻ'] as const;
type Sort = 'num' | 'best' | 'name';

export const toDraft = (p: PlayerDTO): PlayerDraft => ({
  id: p.id, fullName: p.fullName, nick: p.nick, dob: p.dob, num: p.num, foot: p.foot, payType: p.nextPayType ?? p.payType,
  avatarUrl: p.avatarUrl, styles: p.styles, stats: p.stats, isCaptain: p.isCaptain,
});

export const profilePayload = (d: PlayerDraft) => ({
  fullName: d.fullName.trim(), nick: d.nick?.trim() || null, dob: d.dob || null, num: d.num, foot: d.foot, styles: d.styles,
  avatarUrl: d.avatarUrl || null, stats: d.stats, payType: d.payType, isCaptain: d.isCaptain,
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
  const { view, players, canEdit } = useTeam();
  const [group, setGroup] = useState<(typeof GROUPS)[number]>('Tất cả');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('num');
  const modal = usePlayerModal();
  const [poll, setPoll] = useState(false);
  const now = new Date(view.now);
  const season = useMemo(() => seasonOf(view.matches), [view.matches]);

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
              return (
                <div key={p.id} className="pcard" tabIndex={0} role="button" aria-label={`Mở hồ sơ ${p.fullName}`} onClick={(e) => !(e.target as Element).closest('[data-x]') && modal.open(p.id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget && (e.preventDefault(), modal.open(p.id))}>
                  <div className="pc-top">
                    <Avatar p={p} size={52} />
                    <div className="who">
                      <b>{shortName(p)}{p.isCaptain && <> <span className="chip" style={{ background: 'var(--ink)', color: 'var(--accent)', border: 0 }}>C</span></>}</b>
                      <span>{p.fullName}{se.mvp > 0 && <> · <span className="mvpt">★ {se.mvp} MVP {view.year}</span></>}</span>
                    </div>
                    <div className="pc-num">{p.num ?? '–'}</div>
                  </div>
                  <div className="pc-meta">
                    {a != null && <><span>{a} tuổi</span>·</>}
                    <span>chân {p.foot.toLowerCase()}</span>
                    <span className={`chip ${p.payType}`}>{p.payType === 'le' ? 'Đá lẻ' : 'Quỹ'}</span>
                    {p.nextPayType && <span className="chip" data-tt={`Từ tháng sau chuyển sang ${p.nextPayType === 'le' ? 'đá lẻ' : 'quỹ'}`}>→ {p.nextPayType === 'le' ? 'Lẻ' : 'Quỹ'}</span>}
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
              );
            })
          )}
        </div>
      </div>
      {modal.node}
      {poll && <StatPollModal onClose={() => setPoll(false)} />}
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
