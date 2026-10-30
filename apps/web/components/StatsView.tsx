'use client';

import { useMemo, useState } from 'react';
import { compareLines, dm, leaderboard, resultOf, seasonTable, shortName, teamSeason, type PlayerLine, type TableKey } from '@san7/core';
import { useTeam } from './TeamContext';
import { Avatar } from './ui';
import { isPlayed, seasonOf } from '@/lib/season';

type Key = TableKey;
const COLS: Array<[Key, string]> = [['gp', 'Trận'], ['goals', 'Bàn'], ['assists', 'KT'], ['ga', 'B+KT'], ['mvp', 'MVP'], ['rate', '% tham gia']];

interface Snapshot { year: number; data: { record: { n: number; w: number; d: number; l: number; gf: number; ga: number }; boot: { name: string | null; value: number } | null; assist: { name: string | null; value: number } | null; mvp: { name: string | null; value: number } | null } }

/** Tab Thống kê mùa (BRD 6.7) + bộ chọn mùa + Bảng vàng các mùa (BRD 9.3). */
export function StatsView({ snapshots }: { snapshots: Snapshot[] }) {
  const { view, players, byId, nameOf } = useTeam();
  const years = useMemo(() => [...new Set([view.year, ...view.matches.filter(isPlayed).map((m) => Number(m.date.slice(0, 4)))])].sort((a, b) => b - a), [view]);
  const [year, setYear] = useState(view.year);
  const [sort, setSort] = useState<{ k: Key; dir: 1 | -1 }>({ k: 'goals', dir: -1 });
  const season = useMemo(() => seasonOf(view.matches), [view.matches]);
  const ts = teamSeason(season, year);
  const ids = [...new Set([...players.map((p) => p.id), ...view.matches.flatMap((m) => Object.keys(m.attendance))])];
  const rows = seasonTable(season, year, ids).filter((r) => byId(r.playerId) || r.gp > 0);
  const top = (k: 'goals' | 'assists' | 'mvp') => leaderboard(rows, k)[0];
  const tg = top('goals'), ta = top('assists'), tm = top('mvp');
  const sorted = [...rows].sort(compareLines(sort.k, sort.dir));
  const played = [...ts.matches].reverse();
  const p = (l: PlayerLine) => byId(l.playerId);

  return (
    <section className="view">
      <div style={{ display: 'grid', gap: 16 }}>
        <div className="view-head">
          <h2 className="vt">Thống kê mùa {year}</h2>
          {years.length > 1 && (
            <select aria-label="Chọn mùa" value={year} onChange={(e) => setYear(+e.target.value)}>
              {years.map((y) => <option key={y} value={y}>Mùa {y}</option>)}
            </select>
          )}
        </div>
        <div className="tiles">
          <div className="tile hl"><div className="k">Thành tích</div><div className="v">{ts.w}T {ts.d}H {ts.l}B</div><div className="s">{ts.n} trận · {ts.n ? Math.round((ts.w / ts.n) * 100) : 0}% thắng</div></div>
          <div className="tile"><div className="k">Bàn thắng – thua</div><div className="v">{ts.gf}–{ts.ga}</div><div className="s">Hiệu số {ts.gf - ts.ga >= 0 ? '+' : ''}{ts.gf - ts.ga}</div></div>
          <div className="tile"><div className="k">Vua phá lưới</div><div className="v">{tg ? nameOf(tg.playerId) : '–'}</div><div className="s">{tg ? tg.goals + ' bàn' : 'Chưa có bàn thắng'}{ta ? ` · Kiến tạo nhiều nhất: ${nameOf(ta.playerId)} (${ta.assists})` : ''}</div></div>
          <div className="tile"><div className="k">MVP nhiều nhất</div><div className="v">{tm ? nameOf(tm.playerId) : '–'}</div><div className="s">{tm ? tm.mvp + ' lần' : 'Chưa bầu MVP'}</div></div>
        </div>
        <div className="grid2">
          <div className="panel">
            <h3 className="st">Bảng cá nhân</h3>
            <div className="twrap">
              {sorted.length ? (
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>#</th><th>Cầu thủ</th>
                      {COLS.map(([k, n]) => (
                        <th key={k} aria-sort={k === sort.k ? (sort.dir < 0 ? 'descending' : 'ascending') : undefined}>
                          <button type="button" onClick={() => setSort((s) => ({ k, dir: s.k === k ? ((-s.dir) as 1 | -1) : -1 }))}>{n}{k === sort.k ? (sort.dir < 0 ? ' ↓' : ' ↑') : ''}</button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((r, i) => {
                      const pl = p(r);
                      return (
                        <tr key={r.playerId}>
                          <td>{i + 1}</td>
                          <td><span className="who">{pl && <Avatar p={pl} size={26} />}{pl ? shortName(pl) : nameOf(r.playerId)}</span></td>
                          {COLS.map(([k]) => <td key={k} className={k === sort.k ? 'hi' : ''}>{k === 'rate' ? `${r.rate}%` : r[k]}</td>)}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : <div className="empty-list">Chưa có cầu thủ.</div>}
            </div>
          </div>
          <div className="panel">
            <h3 className="st">Lịch sử trận</h3>
            {played.length ? played.map((m) => {
              const r = resultOf(m);
              const sc = Object.entries(m.events).filter(([, e]) => e.goals).map(([id, e]) => nameOf(id) + (e.goals > 1 ? ' ×' + e.goals : '')).join(', ');
              return (
                <div key={m.id} className="ritem">
                  <span className="res" style={{ background: r === 'T' ? 'var(--good)' : r === 'B' ? 'var(--bad)' : 'var(--ok)' }}>{r}</span>
                  <div className="t"><span>vs {m.opponent}</span><span className="tnum">{m.scoreUs}–{m.scoreThem}</span></div>
                  <div className="d">{dm(m.date)}{sc ? ' · Ghi bàn: ' + sc : ''}{m.mvpPlayerId ? ' · MVP: ' + nameOf(m.mvpPlayerId) : ''}</div>
                </div>
              );
            }) : <div className="empty-list">Chưa có trận nào có kết quả.</div>}
          </div>
        </div>
        {snapshots.length > 0 && (
          <div className="panel">
            <h3 className="st">Bảng vàng các mùa</h3>
            <div className="twrap">
              <table className="tbl">
                <thead><tr><th>Mùa</th><th>Thành tích</th><th>Giày vàng</th><th>Vua kiến tạo</th><th>MVP nhiều nhất</th></tr></thead>
                <tbody>
                  {snapshots.map((s) => (
                    <tr key={s.year}>
                      <td>{s.year}</td>
                      <td>{s.data.record.w}T {s.data.record.d}H {s.data.record.l}B · {s.data.record.gf}–{s.data.record.ga}</td>
                      <td>{s.data.boot ? `${s.data.boot.name} (${s.data.boot.value})` : '–'}</td>
                      <td>{s.data.assist ? `${s.data.assist.name} (${s.data.assist.value})` : '–'}</td>
                      <td>{s.data.mvp ? `${s.data.mvp.name} (${s.data.mvp.value})` : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
