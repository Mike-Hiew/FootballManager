'use client';

import { useState } from 'react';
import { STAT_KEYS, dm, fillStats, fmt1, rankedPositions, shortName, type Stats } from '@san7/core';
import { useTeam } from './TeamContext';
import { Avatar, tierColor } from './ui';
import { InvitePanel } from './InvitePanel';
import { MatchModal } from './matches/MatchModal';
import { PlayerModal, type PlayerDraft } from './players/PlayerModal';
import { profilePayload } from './players/PlayersView';
import { approveEditAction, approveJoinAction, decideClaimAction, rejectEditAction, rejectJoinAction } from '@/app/actions';
import type { ApprovalsDTO, PlayerDTO } from '@/lib/types';

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  return `${Math.floor(s / 86400)} ngày trước`;
}

const draftOf = (p: Record<string, unknown>): PlayerDraft => ({
  fullName: String(p.fullName ?? ''), nick: (p.nick as string) ?? null, dob: (p.dob as string) ?? null, num: (p.num as number) ?? null,
  foot: String(p.foot ?? 'Phải'), payType: String(p.payType ?? 'quy'), avatarUrl: (p.avatarUrl as string) ?? null,
  styles: (p.styles as string[]) ?? [], stats: fillStats((p.stats as Stats) ?? {}), ratings: (p.ratings as never) ?? undefined,
});

function Top3({ stats, foot }: { stats: Stats; foot: string }) {
  return (
    <div className="pc-pos" style={{ marginTop: 4 }}>
      {rankedPositions(stats, foot).filter(([k, v]) => !(k === 'GK' && v < 6)).slice(0, 3).map(([k, v]) => (
        <span key={k} className="pchip" style={{ ['--fit' as string]: tierColor(v) }}><b>{k}</b><em>{fmt1(v)}</em></span>
      ))}
    </div>
  );
}

/** So sánh cũ/mới, trường đổi tô đậm (BRD 3.5). */
function Diff({ p, d }: { p: PlayerDTO; d: PlayerDraft }) {
  const out: React.ReactNode[] = [];
  const lab: Array<[keyof PlayerDraft & keyof PlayerDTO, string]> = [['fullName', 'Họ tên'], ['nick', 'Biệt danh'], ['dob', 'Ngày sinh'], ['num', 'Số áo'], ['foot', 'Chân thuận']];
  for (const [k, l] of lab) if (String(p[k] ?? '') !== String(d[k] ?? '')) out.push(<span key={k}>{l}: {String(p[k] ?? '–')} → <b>{String(d[k] ?? '–')}</b></span>);
  if ((p.avatarUrl ?? '') !== (d.avatarUrl ?? '')) out.push(<span key="av"><b>Ảnh đại diện mới</b></span>);
  const st = STAT_KEYS.filter((k) => p.stats[k] !== d.stats[k]);
  if (st.length) out.push(<span key="st">Chỉ số: {st.map((k, i) => <span key={k}>{i ? ', ' : ''}{k} {fmt1(p.stats[k])} → <b>{fmt1(d.stats[k])}</b></span>)}</span>);
  if (JSON.stringify(p.styles) !== JSON.stringify(d.styles)) out.push(<span key="sty">Phong cách: <b>{d.styles.join(', ') || '–'}</b></span>);
  return <div className="diff">{out.length ? out : <span>Không có thay đổi</span>}</div>;
}

/** Tab Duyệt (BRD 8.6). */
export function ApprovalsView({ data }: { data: ApprovalsDTO }) {
  const { view, byId, nameOf, matchById, act, teamId, players } = useTeam();
  // Vote MVP đang mở hoặc cần chỉ định (prototype liệt kê cả hai; badge chỉ đếm loại cần chỉ định)
  const mvpList = view.matches.filter((m) => m.mvpVote && m.mvpVote.status !== 'done' && (m.mvpVote.status === 'open' || data.mvpNeed.includes(m.id)));
  const [joinEdit, setJoinEdit] = useState<{ id: string; draft: PlayerDraft } | null>(null);
  const [editEdit, setEditEdit] = useState<{ id: string; draft: PlayerDraft; name: string } | null>(null);
  const [mvpMatch, setMvpMatch] = useState<string | null>(null);
  const reject = (fn: (reason: string) => void) => {
    const reason = prompt('Lý do từ chối (không bắt buộc):') ?? null;
    if (reason !== null) fn(reason);
  };
  const joinPayload = (d: PlayerDraft) => ({ ...profilePayload(d), ratings: d.ratings });

  return (
    <section className="view">
      <div style={{ display: 'grid', gap: 14 }}>
        <h2 className="vt">Duyệt</h2>
        <div className="apwrap">
          <div className="panel">
            <h3 className="st">Xin vào đội ({data.joins.length})</h3>
            {data.joins.length ? data.joins.map((j) => {
              const d = draftOf(j.payload);
              const dupNum = d.num != null && players.some((p) => p.num === d.num);
              return (
                <div key={j.id} className="apcard">
                  <Avatar p={{ id: j.id, fullName: d.fullName, nick: d.nick, avatarUrl: d.avatarUrl }} size={40} />
                  <div className="t">
                    <b>{d.fullName}</b>{d.nick ? ' · ' + d.nick : ''}
                    <small>{j.phone} · {d.num != null ? `số ${d.num}${dupNum ? ' (trùng!)' : ''} · ` : ''}{d.payType === 'le' ? 'Đá lẻ' : 'Đóng quỹ'} · {ago(j.createdAt)}</small>
                    <Top3 stats={d.stats} foot={d.foot} />
                  </div>
                  <div className="acts">
                    <button type="button" className="btn sm" onClick={() => setJoinEdit({ id: j.id, draft: d })}>Xem, sửa chỉ số</button>
                    <button type="button" className="btn primary sm" onClick={() => act(() => approveJoinAction(teamId, j.id), `Đã duyệt ${d.fullName} vào đội`)}>Duyệt vào đội</button>
                    <button type="button" className="btn ghost sm danger" onClick={() => reject((r) => act(() => rejectJoinAction(teamId, j.id, r), 'Đã từ chối đơn'))}>Từ chối</button>
                  </div>
                </div>
              );
            }) : <div className="empty-list">Không có đơn nào.</div>}
          </div>

          <div className="panel">
            <h3 className="st">Cập nhật hồ sơ, chỉ số ({data.edits.length})</h3>
            {data.edits.length ? data.edits.map((e) => {
              const p = byId(e.playerId);
              if (!p) return null;
              const d = draftOf({ ...e.payload, payType: p.payType });
              return (
                <div key={e.id} className="apcard">
                  <Avatar p={p} size={40} />
                  <div className="t"><b>{shortName(p)}</b><small>Gửi {ago(e.createdAt)}</small></div>
                  <div className="acts">
                    <button type="button" className="btn sm" onClick={() => setEditEdit({ id: e.id, draft: d, name: shortName(p) })}>Sửa thêm</button>
                    <button type="button" className="btn primary sm" onClick={() => act(() => approveEditAction(teamId, e.id), 'Đã duyệt cập nhật hồ sơ')}>Duyệt</button>
                    <button type="button" className="btn ghost sm danger" onClick={() => reject((r) => act(() => rejectEditAction(teamId, e.id, r), 'Đã từ chối cập nhật'))}>Từ chối</button>
                  </div>
                  <Diff p={p} d={d} />
                </div>
              );
            }) : <div className="empty-list">Không có thay đổi nào.</div>}
          </div>

          <div className="panel">
            <h3 className="st">Khai báo bàn thắng, kiến tạo ({data.claims.length})</h3>
            {data.claims.length ? data.claims.map((c) => {
              const m = matchById(c.matchId);
              const p = byId(c.playerId);
              const cur = m?.events[c.playerId] ?? { goals: 0, assists: 0 };
              return (
                <div key={c.id} className="apcard">
                  {p && <Avatar p={p} size={40} />}
                  <div className="t">
                    <b>{nameOf(c.playerId)}</b> · vs {m?.opponent} {m ? dm(m.date) : ''}
                    <small>Khai <b style={{ color: 'var(--ink)' }}>{c.goals} bàn, {c.assists} kiến tạo</b> · đang ghi nhận {cur.goals} bàn, {cur.assists} kiến tạo</small>
                  </div>
                  <div className="acts">
                    <button type="button" className="btn primary sm" onClick={() => act(() => decideClaimAction(teamId, c.id, true), 'Đã duyệt khai báo')}>Duyệt</button>
                    <button type="button" className="btn ghost sm danger" onClick={() => act(() => decideClaimAction(teamId, c.id, false), 'Đã từ chối khai báo')}>Từ chối</button>
                  </div>
                </div>
              );
            }) : <div className="empty-list">Không có khai báo nào.</div>}
          </div>

          <div className="panel">
            <h3 className="st">Vote MVP ({mvpList.length})</h3>
            {mvpList.length ? mvpList.map((m) => {
              const v = m.mvpVote!;
              const goers = Object.values(m.attendance).filter((a) => a.status === 'di').length;
              const left = Math.max(0, Math.ceil((new Date(v.closesAt).getTime() - new Date(view.now).getTime()) / 3600e3));
              return (
                <div key={m.id} className="apcard">
                  <span className="tier ex">★</span>
                  <div className="t">
                    <b>vs {m.opponent}</b> · {dm(m.date)}
                    <small>{v.status === 'open' ? `Đang vote · ${v.ballots}/${goers} phiếu · hết hạn trong ${left} giờ` : <span className="warn">Chưa đủ 60% phiếu hoặc hoà, cần đội trưởng chỉ định</span>}</small>
                  </div>
                  <div className="acts"><button type="button" className="btn sm" onClick={() => setMvpMatch(m.id)}>Mở trận</button></div>
                </div>
              );
            }) : <div className="empty-list">Không có vote MVP nào cần xử lý.</div>}
          </div>
        </div>
        <InvitePanel />
      </div>

      {joinEdit && (
        <PlayerModal
          mode="app"
          initial={joinEdit.draft}
          title={`Hồ sơ đăng ký · ${joinEdit.draft.nick || joinEdit.draft.fullName}`}
          saveLabel="Duyệt vào đội"
          onClose={() => setJoinEdit(null)}
          onSave={async (d) => !!(await act(() => approveJoinAction(teamId, joinEdit.id, joinPayload(d)), `Đã duyệt ${d.fullName} vào đội`))}
        />
      )}
      {editEdit && (
        <PlayerModal
          mode="app"
          initial={editEdit.draft}
          title={`Cập nhật hồ sơ · ${editEdit.name}`}
          saveLabel="Duyệt cập nhật"
          onClose={() => setEditEdit(null)}
          onSave={async (d) => !!(await act(() => approveEditAction(teamId, editEdit.id, profilePayload(d)), 'Đã duyệt cập nhật hồ sơ'))}
        />
      )}
      {mvpMatch && <MatchModal matchId={mvpMatch} initialTab="res" onClose={() => setMvpMatch(null)} />}
    </section>
  );
}
