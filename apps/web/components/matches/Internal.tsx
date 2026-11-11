'use client';

import { useMemo, useState } from 'react';
import { defaultShare, money, overall, shortName, splitTotal, summarize, type SplitPlayer } from '@san7/core';
import { useTeam } from '../TeamContext';
import { Avatar } from '../ui';
import { requestLeAction, setSidesAction, setSplitAction, shuffleSidesAction } from '@/app/actions';
import type { MatchDTO, PlayerDTO } from '@/lib/types';

/** Đá nội bộ: Đội A mặc áo sáng (= tỉ số "của mình"), Đội B áo tối. */
export const SIDE_A = 'Đội A';
export const SIDE_B = 'Đội B';

const goersOf = (m: MatchDTO, players: PlayerDTO[]) =>
  players.filter((p) => m.attendance[p.id]?.status === 'di').sort((a, b) => (a.num ?? 99) - (b.num ?? 99));

type Zone = 'a' | 'b' | 'rest';

/**
 * Tab "Chia đội": ĐT tự xếp (bấm → A / → B, bấm người trong đội để đổi bên, ✕ để bỏ ra, hoặc kéo-thả),
 * hoặc bấm chia ngẫu nhiên cân bằng (cả đội / chỉ người chưa xếp). Thanh cân bằng cập nhật ngay.
 */
export function SidesTab({ m }: { m: MatchDTO }) {
  const { players, byId, canEdit, act, teamId } = useTeam();
  const goers = goersOf(m, players);
  const server = m.sides ?? { a: [], b: [] };
  const serverKey = JSON.stringify(server);
  // xếp tạm phía client để bấm liên tục không bị giật / ghi đè nhau
  const [local, setLocal] = useState(server);
  const [seen, setSeen] = useState(serverKey);
  if (seen !== serverKey) {
    setSeen(serverKey);
    setLocal(server);
  }
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<Zone | null>(null);
  const goerIds = new Set(goers.map((p) => p.id));
  const sides = { a: local.a.filter((id) => goerIds.has(id)), b: local.b.filter((id) => goerIds.has(id)) };
  const inSide = new Set([...sides.a, ...sides.b]);
  const rest = goers.filter((p) => !inSide.has(p.id));
  const map = useMemo(() => new Map<string, SplitPlayer>(players.map((p) => [p.id, { id: p.id, stats: p.stats, foot: p.foot }])), [players]);
  const A = summarize(sides.a, map);
  const B = summarize(sides.b, map);
  const sum = A.total + B.total;
  const pctA = sum ? Math.round((A.total / sum) * 100) : 50;
  const diff = Math.abs(A.avg - B.avg) * 10;
  const verdict = !sides.a.length || !sides.b.length ? null : diff <= 2 && Math.abs(sides.a.length - sides.b.length) <= 1 ? 'Rất cân' : diff <= 5 ? 'Khá cân' : 'Lệch — nên đổi bớt người';
  const anyAssigned = sides.a.length + sides.b.length > 0;

  const move = (id: string, to: Zone) => {
    const a = sides.a.filter((x) => x !== id);
    const b = sides.b.filter((x) => x !== id);
    if (to === 'a') a.push(id);
    if (to === 'b') b.push(id);
    setLocal({ a, b });
    // lỗi thì trả về như trên server
    void act(() => setSidesAction(teamId, m.id, { a, b })).then((r) => r === undefined && setLocal(server));
  };
  const name = (id: string) => {
    const p = byId(id);
    return p ? shortName(p) : '';
  };
  const dropZone = (z: Zone) =>
    canEdit
      ? {
          onDragOver: (e: React.DragEvent) => {
            if (!drag) return;
            e.preventDefault();
            setOver(z);
          },
          onDragLeave: () => setOver((o) => (o === z ? null : o)),
          onDrop: (e: React.DragEvent) => {
            e.preventDefault();
            setOver(null);
            if (drag) move(drag, z);
            setDrag(null);
          },
        }
      : {};
  const dragProps = (id: string) =>
    canEdit
      ? { draggable: true, onDragStart: (e: React.DragEvent) => { e.dataTransfer.effectAllowed = 'move'; setDrag(id); }, onDragEnd: () => { setDrag(null); setOver(null); } }
      : {};

  const col = (key: 'a' | 'b', ids: string[], s: typeof A) => (
    <section className={`sd-col sd-${key}${over === key ? ' drop' : ''}`} aria-label={key === 'a' ? `${SIDE_A} · áo sáng` : `${SIDE_B} · áo tối`} {...dropZone(key)}>
      <header>
        <span className="sd-shirt" aria-hidden>
          <svg viewBox="0 0 24 24"><path d="M8 3 3 6l2 4 2-1v12h10V9l2 1 2-4-5-3a4 4 0 0 1-8 0Z" /></svg>
        </span>
        <div>
          <b>{key === 'a' ? SIDE_A : SIDE_B}</b>
          <small>{key === 'a' ? 'Áo sáng' : 'Áo tối'} · {ids.length} người</small>
        </div>
        <span className="sd-ovr" title="OVR trung bình"><b>{Math.round(s.avg * 10) || '—'}</b><small>OVR TB</small></span>
      </header>
      <div className="sd-lines" aria-label="Số người theo tuyến">
        {(['GK', 'DF', 'MF', 'FW'] as const).map((l) => <span key={l}>{l} <b>{s.lines[l]}</b></span>)}
      </div>
      <ul>
        {ids.map((id) => {
          const p = byId(id);
          if (!p) return null;
          const o = overall(p.stats, p.foot);
          const body = (
            <>
              <Avatar p={p} size={30} />
              <span className="sd-n">{shortName(p)}<small>{o.pos}</small></span>
              <span className="sd-o">{o.ovr}</span>
            </>
          );
          return (
            <li key={id} className={drag === id ? 'dragging' : undefined} {...dragProps(id)}>
              {canEdit ? (
                <div className="sd-row">
                  <button type="button" className="sd-p" onClick={() => move(id, key === 'a' ? 'b' : 'a')} aria-label={`Chuyển ${shortName(p)} sang ${key === 'a' ? SIDE_B : SIDE_A}`}>
                    {body}<span className="sd-mv" aria-hidden>{key === 'a' ? '→' : '←'}</span>
                  </button>
                  <button type="button" className="sd-out" onClick={() => move(id, 'rest')} aria-label={`Bỏ ${shortName(p)} ra khỏi ${key === 'a' ? SIDE_A : SIDE_B}`}>✕</button>
                </div>
              ) : <div className="sd-p">{body}</div>}
            </li>
          );
        })}
        {!ids.length && <li className="sd-empty">{canEdit ? 'Bấm → hoặc kéo người vào đây' : 'Chưa có ai'}</li>}
      </ul>
    </section>
  );

  return (
    <div className="sd">
      <div className="sd-top">
        <p className="hint" style={{ margin: 0 }}>
          {goers.length} người điểm danh Đi.{' '}
          {canEdit
            ? 'Tự xếp: bấm → A / → B (hoặc kéo-thả), bấm người trong đội để đổi bên. Hoặc để app chia ngẫu nhiên cân bằng theo chỉ số và vị trí.'
            : m.sides && anyAssigned ? 'Đội trưởng đã chia đội.' : 'Đội trưởng chưa chia đội.'}
        </p>
        {canEdit && (
          <div className="sd-acts">
            <button type="button" className="btn primary sd-dice" disabled={goers.length < 2} onClick={() => act(() => shuffleSidesAction(teamId, m.id), 'Đã chia đội cân bằng')}>
              <span aria-hidden>🎲</span> {anyAssigned ? 'Chia lại ngẫu nhiên' : 'Chia ngẫu nhiên cân bằng'}
            </button>
            {anyAssigned && rest.length > 0 && (
              <button type="button" className="btn sm" onClick={() => act(() => shuffleSidesAction(teamId, m.id, true), `Đã chia nốt ${rest.length} người, giữ người bạn đã xếp`)}>
                <span aria-hidden>⚖️</span> Chia nốt {rest.length} người còn lại
              </button>
            )}
            {anyAssigned && (
              <button type="button" className="btn ghost sm" onClick={() => {
                setLocal({ a: [], b: [] });
                void act(() => setSidesAction(teamId, m.id, { a: [], b: [] }), 'Đã bỏ chia đội, xếp lại từ đầu');
              }}>Xếp lại từ đầu</button>
            )}
          </div>
        )}
      </div>
      {(anyAssigned || canEdit) && (
        <>
          <div className="sd-bal" aria-label={`Cân bằng: ${SIDE_A} ${pctA}% – ${SIDE_B} ${100 - pctA}%`}>
            <span className="sd-bar"><i style={{ width: `${pctA}%` }} /></span>
            <small>{SIDE_A} {pctA}% · {SIDE_B} {100 - pctA}%{verdict ? ` · ${verdict}` : ''}</small>
          </div>
          <div className="sd-grid">
            {col('a', sides.a, A)}
            <div className="sd-vs" aria-hidden>VS</div>
            {col('b', sides.b, B)}
          </div>
        </>
      )}
      {(rest.length > 0 || (canEdit && drag && inSide.has(drag))) && (
        <section className={`box sd-rest${over === 'rest' ? ' drop' : ''}`} aria-label="Chưa xếp đội" {...dropZone('rest')}>
          <h4>Chưa xếp đội ({rest.length})</h4>
          {rest.map((p) => {
            const o = overall(p.stats, p.foot);
            return (
              <div key={p.id} className={`arow${drag === p.id ? ' dragging' : ''}`} {...dragProps(p.id)}>
                <Avatar p={p} size={30} />
                <div className="n">{shortName(p)}<small>{o.pos} · OVR {o.ovr}</small></div>
                {canEdit && (
                  <div className="ctl">
                    <button type="button" className="btn sm sd-to-a" onClick={() => move(p.id, 'a')} aria-label={`Cho ${name(p.id)} vào ${SIDE_A}`}>→ A</button>
                    <button type="button" className="btn sm sd-to-b" onClick={() => move(p.id, 'b')} aria-label={`Cho ${name(p.id)} vào ${SIDE_B}`}>→ B</button>
                  </div>
                )}
              </div>
            );
          })}
          {!rest.length && <p className="hint" style={{ margin: 0 }}>Thả vào đây để bỏ ra khỏi đội</p>}
        </section>
      )}
    </div>
  );
}

const QUICK = ['Nước', 'Lôi', 'Trọng tài', 'Áo bib'];

/** Đá nội bộ — chia tiền: tiền sân + khoản thêm (nước, lôi…), mặc định chia đều; ĐT sửa phần từng người. */
export function SplitBox({ m }: { m: MatchDTO }) {
  const { view, players, canEdit, act, teamId } = useTeam();
  const goers = goersOf(m, players);
  const [items, setItems] = useState(m.splitItems.length ? m.splitItems : []);
  const [shares, setShares] = useState<Record<string, string>>(() =>
    Object.fromEntries(goers.filter((p) => m.attendance[p.id]?.shareSet).map((p) => [p.id, String(m.attendance[p.id]?.share ?? '')])),
  );
  const cost = m.cost ?? 0;
  const total = splitTotal(cost, items.filter((x) => x.label.trim()));
  const def = defaultShare(total, goers.length);
  const shareOf = (id: string) => (shares[id] ? Number(shares[id]) || 0 : def);
  const sum = goers.reduce((s, p) => s + shareOf(p.id), 0);
  const paid = goers.filter((p) => m.attendance[p.id]?.lePaid);
  const got = paid.reduce((s, p) => s + (m.attendance[p.id]?.share ?? 0), 0);
  const me = view.myPlayerId ? m.attendance[view.myPlayerId] : undefined;

  if (!canEdit) {
    if (me?.status !== 'di' || me.share == null) return null;
    return (
      <div className="note sp-mine">
        Phần của bạn trận nội bộ: <b>{money(me.share)}</b> {me.lePaid ? <span className="chip quy">Đã trả</span> : <span className="chip le">Chưa trả</span>}
        <small>Tiền sân {money(cost)}{m.splitItems.map((x) => ` + ${x.label} ${money(x.amount)}`).join('')} · {goers.length} người chia</small>
      </div>
    );
  }

  const dirty =
    JSON.stringify(items) !== JSON.stringify(m.splitItems) ||
    goers.some((p) => (shares[p.id] ? Number(shares[p.id]) : null) !== (m.attendance[p.id]?.shareSet ? m.attendance[p.id]?.share ?? null : null));
  const save = () =>
    act(
      () => setSplitAction(teamId, m.id, {
        items: items.filter((x) => x.label.trim()).map((x) => ({ label: x.label.trim(), amount: x.amount })),
        shares: Object.fromEntries(goers.map((p) => [p.id, shares[p.id] ? Number(shares[p.id]) || 0 : null])),
      }),
      'Đã lưu chia tiền',
    );
  const unpaid = goers.length - paid.length;

  return (
    <section className="box sp" aria-label="Chia tiền đá nội bộ">
      <h4>Chia tiền nội bộ</h4>
      <div className="sp-items">
        <div className="sp-item fixed"><span>Tiền sân</span><b>{money(cost)}</b></div>
        {items.map((x, i) => (
          <div key={i} className="sp-item">
            <input aria-label={`Tên khoản ${i + 1}`} value={x.label} maxLength={40} placeholder="VD: Nước" onChange={(e) => setItems((s) => s.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)))} />
            <input aria-label={`Số tiền ${x.label || `khoản ${i + 1}`}`} type="number" min={0} step={5000} inputMode="numeric" value={x.amount || ''} placeholder="0" onChange={(e) => setItems((s) => s.map((y, j) => (j === i ? { ...y, amount: Math.max(0, Number(e.target.value) || 0) } : y)))} />
            <button type="button" className="sp-x" aria-label={`Xoá khoản ${x.label || i + 1}`} onClick={() => setItems((s) => s.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <div className="sp-add">
          {QUICK.filter((q) => !items.some((x) => x.label === q)).map((q) => (
            <button key={q} type="button" className="btn ghost sm" onClick={() => setItems((s) => [...s, { label: q, amount: 0 }])}>+ {q}</button>
          ))}
          <button type="button" className="btn ghost sm" disabled={items.length >= 12} onClick={() => setItems((s) => [...s, { label: '', amount: 0 }])}>+ Khoản khác</button>
        </div>
      </div>
      <div className="sp-sum">
        <span>Tổng chi <b>{money(total)}</b></span>
        <span>{goers.length} người · mặc định <b>{money(def)}</b>/người</span>
        <span className={sum < total ? 'warn' : ''}>Cộng các phần <b>{money(sum)}</b>{sum < total ? ` · thiếu ${money(total - sum)}` : sum > total ? ` · dư ${money(sum - total)}` : ''}</span>
      </div>
      {goers.length > 0 && (
        <details className="sp-each">
          <summary>Sửa phần từng người (để trống = chia đều)</summary>
          {goers.map((p) => (
            <label key={p.id} className="sp-row">
              <span>{shortName(p)}</span>
              <input type="number" min={0} step={5000} inputMode="numeric" aria-label={`Phần của ${shortName(p)}`} placeholder={String(def)} value={shares[p.id] ?? ''} onChange={(e) => setShares((s) => ({ ...s, [p.id]: e.target.value }))} />
            </label>
          ))}
        </details>
      )}
      <div className="row-actions">
        <button type="button" className="btn primary sm" disabled={!dirty} onClick={save}>Lưu chia tiền</button>
        <span className="muted" style={{ fontSize: 12.5 }}>Đã thu <b>{paid.length}/{goers.length}</b> · {money(got)}</span>
        {unpaid > 0 && !dirty && def > 0 && (
          <button type="button" className="btn ghost sm" style={{ marginLeft: 'auto' }} onClick={() => act(() => requestLeAction(teamId, m.id, def), (n) => `Đã gửi yêu cầu trả tiền cho ${n} người`)}>
            Gửi yêu cầu trả tiền ({unpaid} người)
          </button>
        )}
      </div>
    </section>
  );
}
