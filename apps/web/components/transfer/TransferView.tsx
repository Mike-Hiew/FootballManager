'use client';

import { useMemo, useState } from 'react';
import {
  MV_MAX, MV_MIN, OFFER_LABEL, cardTier, POS_INFO, POSITIONS, dm, formatValue, formatValueFull, formatValueShort, parseValue, shortName, valueChange,
  type OfferStatus, type Position,
} from '@san7/core';
import { useTeam } from '../TeamContext';
import { Avatar, Modal } from '../ui';
import {
  makeOfferAction, remindValueAction, respondOfferAction, setListedAction, setMyValueAction, setPlayerValueAction, setValueLockAction,
} from '@/app/actions';
import type { MarketData, MarketPlayer, OfferDTO } from '@/server/services/transfer';

type Tab = 'doi-hinh' | 'thi-truong' | 'de-nghi' | 'bang-tin';

/* ---------------- Phụ trợ ---------------- */

/** Hạng thẻ dùng chung toàn app (BRD 13): Đom Đóm ≥ 85 · Vàng 75–84 · Bạc < 75. */
const tier = cardTier;

function Trend({ prev, cur }: { prev: number | null; cur: number | null }) {
  const c = valueChange(prev, cur);
  if (c == null || c === 0) return <span className="tm-trend flat" aria-label="Không đổi">–</span>;
  const up = c > 0;
  return (
    <span className={`tm-trend ${up ? 'up' : 'down'}`} aria-label={`${up ? 'Tăng' : 'Giảm'} ${Math.abs(c)}%`}>
      {up ? '▲' : '▼'} {Math.abs(c).toString().replace('.', ',')}%
    </span>
  );
}

/** Biểu đồ giá nhỏ (lịch sử giá trị). */
function Spark({ points, w = 120, h = 34 }: { points: number[]; w?: number; h?: number }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const xy = points.map((v, i) => [(i / (points.length - 1)) * (w - 4) + 2, h - 3 - ((v - min) / span) * (h - 6)]);
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const up = points[points.length - 1] >= points[0];
  return (
    <svg className={`tm-spark ${up ? 'up' : 'down'}`} width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <path d={`${d} L${w - 2} ${h} L2 ${h} Z`} className="fill" />
      <path d={d} className="line" />
      <circle cx={xy[xy.length - 1][0]} cy={xy[xy.length - 1][1]} r="2.6" className="dot" />
    </svg>
  );
}

/** Ô nhập giá M/B: gõ "150M", "1.2B", "150" (= 150M); hiện ngay giá đọc được. */
function ValueInput({ id, value, onChange, label = 'Giá trị (M = triệu, B = tỷ)', autoFocus }: { id: string; value: string; onChange: (s: string) => void; label?: string; autoFocus?: boolean }) {
  const units = value.trim() ? parseValue(value) : null;
  const bad = !!value.trim() && units == null;
  return (
    <div className="field tm-vin">
      <label htmlFor={id}>{label}</label>
      <div className="tm-vin-row">
        <input id={id} inputMode="decimal" autoComplete="off" autoFocus={autoFocus} value={value} onChange={(e) => onChange(e.target.value)} placeholder="VD: 150M hoặc 1.2B" aria-invalid={bad} aria-describedby={`${id}-h`} />
        <span className={`tm-vin-out${bad ? ' bad' : ''}`} id={`${id}-h`} aria-live="polite">
          {bad ? `Từ ${formatValueShort(MV_MIN)} đến ${formatValueShort(MV_MAX)}, bước 0,1M` : units != null ? `= ${formatValue(units)}` : ''}
        </span>
      </div>
      <div className="tm-quick" role="group" aria-label="Chọn nhanh">
        {['50M', '100M', '200M', '500M', '1B', '2B'].map((q) => (
          <button key={q} type="button" className="chip" onClick={() => onChange(q)}>{q}</button>
        ))}
      </div>
    </div>
  );
}

const unitsToInput = (u: number | null | undefined) => (u == null ? '' : formatValueShort(u).replace(',', '.'));

/* ---------------- Thẻ cầu thủ kiểu thẻ chuyển nhượng ---------------- */

function MvCard({ p, onOffer, mine, onOpen }: { p: MarketPlayer; onOffer?: () => void; mine?: boolean; onOpen?: () => void }) {
  return (
    <article className={`tm-card ${tier(p.ovr)}`} aria-label={`${shortName(p)}, ${p.pos} ${p.ovr}, ${formatValue(p.value)}`}>
      <button type="button" className="tm-card-hit" onClick={onOpen} aria-label={`Xem lịch sử giá ${shortName(p)}`} />
      <div className="tm-card-top">
        <div className="tm-ovr"><b>{p.ovr}</b><span>{p.pos}</span></div>
        {p.listedAt && <span className="tm-tag sale">Đang rao</span>}
      </div>
      <div className="tm-card-av"><Avatar p={p} size={74} /></div>
      <div className="tm-card-name">{shortName(p)}</div>
      <div className="tm-card-team">{p.teamName}{p.num != null ? ` · #${p.num}` : ''}</div>
      <div className="tm-card-val">
        <b>{formatValueFull(p.value ?? 0)}</b><small>đ</small>
        <Trend prev={p.prevValue} cur={p.value} />
      </div>
      {(onOffer || mine) && (
        <div className="tm-card-act">
          {mine ? <span className="tm-mine">Đội của bạn</span> : <button type="button" className="btn primary sm" onClick={onOffer}>Đề nghị mua</button>}
        </div>
      )}
    </article>
  );
}

/* ---------------- Modal ---------------- */

function HistoryModal({ p, onClose }: { p: MarketPlayer; onClose: () => void }) {
  const pts = p.history.map((h) => h.value);
  const SRC: Record<string, string> = { self: 'Tự định giá', captain: 'Đội trưởng', transfer: 'Chuyển nhượng' };
  return (
    <Modal title={`Giá trị · ${shortName(p)}`} onClose={onClose} wide={520}>
      <div className="tm-hist">
        <div className="tm-hist-head">
          <div className={`tm-ovr big ${tier(p.ovr)}`}><b>{p.ovr}</b><span>{p.pos}</span></div>
          <div>
            <div className="tm-hist-val">{formatValue(p.value)} <Trend prev={p.prevValue} cur={p.value} /></div>
            <div className="muted">{p.fullName} · {POS_INFO[p.pos].vn} · {p.teamName}</div>
          </div>
        </div>
        {pts.length > 1 && <Spark points={pts} w={460} h={90} />}
        {p.history.length ? (
          <ol className="tm-hist-list">
            {[...p.history].reverse().map((h, i) => (
              <li key={i}><span>{dm(h.at.slice(0, 10))}/{h.at.slice(2, 4)}</span><b>{formatValue(h.value)}</b><span className="muted">{SRC[h.source] ?? h.source}</span></li>
            ))}
          </ol>
        ) : <p className="muted">Chưa có lịch sử giá.</p>}
      </div>
    </Modal>
  );
}

function SetValueModal({ p, onClose }: { p: MarketPlayer; onClose: () => void }) {
  const { act, teamId } = useTeam();
  const [v, setV] = useState(unitsToInput(p.value));
  const units = parseValue(v);
  return (
    <Modal
      title={`Định giá · ${shortName(p)}`}
      onClose={onClose}
      wide={480}
      footer={
        <button className="btn primary" type="button" disabled={units == null} onClick={async () => {
          const r = await act(() => setPlayerValueAction(teamId, p.id, units!), `Đã đặt giá ${shortName(p)}: ${formatValue(units)}`);
          if (r !== undefined) onClose();
        }}>Lưu giá</button>
      }
    >
      <p className="muted" style={{ marginTop: 0 }}>Giá hiện tại: <b>{formatValue(p.value)}</b>. Đội trưởng sửa giá thì áp dụng ngay và báo cho {shortName(p)}.</p>
      <ValueInput id="tmCapVal" value={v} onChange={setV} autoFocus />
    </Modal>
  );
}

function OfferModal({ p, buyerTeams, onClose, initial, title }: { p: { id: string; name: string; value: number | null; teamName: string }; buyerTeams: Array<{ id: string; name: string }>; onClose: () => void; initial?: number; title?: string }) {
  const { act, teamId } = useTeam();
  const [buyer, setBuyer] = useState(buyerTeams[0]?.id ?? '');
  const [v, setV] = useState(unitsToInput(initial ?? p.value));
  const [msg, setMsg] = useState('');
  const units = parseValue(v);
  const diff = valueChange(p.value, units);
  return (
    <Modal
      title={title ?? `Đề nghị mua · ${p.name}`}
      onClose={onClose}
      wide={500}
      footer={
        <button className="btn primary" type="button" disabled={units == null || !buyer} onClick={async () => {
          const r = await act(() => makeOfferAction(teamId, p.id, { buyerTeamId: buyer, amount: units!, message: msg }), `Đã gửi đề nghị ${formatValue(units)} cho ${p.teamName}`);
          if (r !== undefined) onClose();
        }}>Gửi đề nghị</button>
      }
    >
      <div className="tm-offer-form">
        <div className="tm-offer-sum">
          <span>Cầu thủ <b>{p.name}</b> · {p.teamName}</span>
          <span>Giá trị hiện tại <b>{formatValue(p.value)}</b></span>
        </div>
        {buyerTeams.length > 1 && (
          <div className="field">
            <label htmlFor="tmBuyer">Mua cho đội</label>
            <select id="tmBuyer" value={buyer} onChange={(e) => setBuyer(e.target.value)}>{buyerTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          </div>
        )}
        <ValueInput id="tmOffer" value={v} onChange={setV} label="Giá đề nghị (M = triệu, B = tỷ)" autoFocus />
        {diff != null && <p className={`tm-diff ${diff >= 0 ? 'up' : 'down'}`}>{diff >= 0 ? 'Cao hơn' : 'Thấp hơn'} giá trị {Math.abs(diff).toString().replace('.', ',')}%</p>}
        <div className="field"><label htmlFor="tmMsg">Lời nhắn (không bắt buộc)</label><input id="tmMsg" maxLength={120} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="VD: Cần thêm tiền đạo cho giải tháng sau" /></div>
        <p className="hint">Đội bán chấp nhận, trả giá hoặc từ chối. Hai đội thống nhất giá xong, cầu thủ đồng ý thì chuyển đội.</p>
      </div>
    </Modal>
  );
}

function CounterModal({ o, onClose }: { o: OfferDTO; onClose: () => void }) {
  const { act, teamId } = useTeam();
  const [v, setV] = useState(unitsToInput(Math.max(o.amount + 10, o.player.value ?? 0)));
  const units = parseValue(v);
  return (
    <Modal
      title={`Trả giá · ${o.player.name}`}
      onClose={onClose}
      wide={480}
      footer={
        <button className="btn primary" type="button" disabled={units == null || units <= o.amount} onClick={async () => {
          const r = await act(() => respondOfferAction(teamId, o.id, { action: 'counter', counter: units! }), `Đã trả giá ${formatValue(units)}`);
          if (r !== undefined) onClose();
        }}>Gửi giá</button>
      }
    >
      <p className="muted" style={{ marginTop: 0 }}>{o.buyer.name} đề nghị <b>{formatValue(o.amount)}</b>. Giá trả lại phải cao hơn.</p>
      <ValueInput id="tmCounter" value={v} onChange={setV} label="Giá bạn muốn bán" autoFocus />
    </Modal>
  );
}

/* ---------------- Khối "Giá trị của tôi" ---------------- */

function MyValue({ me }: { me: MarketPlayer }) {
  const { act, teamId } = useTeam();
  const [v, setV] = useState('');
  const units = parseValue(v);
  const pts = me.history.map((h) => h.value);
  return (
    <section className={`tm-me${me.isDefault ? ' empty' : ''}`} aria-labelledby="tmMeT">
      <div className="tm-me-card">
        <div className={`tm-ovr big ${tier(me.ovr)}`}><b>{me.ovr}</b><span>{me.pos}</span></div>
        <div className="tm-me-info">
          <h3 id="tmMeT">Giá trị của tôi</h3>
          <div className="tm-me-val">{formatValue(me.value)} {me.isDefault ? <span className="tm-nov">Mặc định — hãy tự định giá</span> : <Trend prev={me.prevValue} cur={me.value} />}</div>
          {me.valueAt && <small className="muted">Cập nhật {dm(me.valueAt.slice(0, 10))}</small>}
        </div>
        <Spark points={pts} />
      </div>
      {me.locked ? (
        <p className="tm-lock">🔒 Đội trưởng đã khoá giá của bạn.</p>
      ) : (
        <form
          className="tm-me-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (units == null) return;
            const r = await act(() => setMyValueAction(teamId, units), `Đã đặt giá trị ${formatValue(units)}`);
            if (r !== undefined) setV('');
          }}
        >
          <ValueInput id="tmMyVal" value={v} onChange={setV} label={me.isDefault ? 'Đặt giá trị chuyển nhượng của bạn' : 'Đổi giá trị (áp dụng ngay)'} />
          <button className="btn primary" type="submit" disabled={units == null}>{me.isDefault ? 'Đặt giá' : 'Cập nhật giá'}</button>
        </form>
      )}
    </section>
  );
}

/* ---------------- Đề nghị ---------------- */

const STEPS: Array<[OfferStatus[], string]> = [
  [['pending', 'countered', 'agreed', 'completed'], 'Gửi đề nghị'],
  [['agreed', 'completed'], 'Hai đội thống nhất'],
  [['completed'], 'Cầu thủ đồng ý'],
];

function OfferCard({ o, buyerTeams }: { o: OfferDTO; buyerTeams: MarketData['buyerTeams'] }) {
  const { act, teamId } = useTeam();
  const [counter, setCounter] = useState(false);
  const [raise, setRaise] = useState(false);
  const [armReject, setArmReject] = useState(false);
  const respond = (action: 'accept' | 'reject' | 'withdraw', msg: string) => act(() => respondOfferAction(teamId, o.id, { action }), msg);
  const closed = !['pending', 'countered', 'agreed'].includes(o.status);
  const acceptLabel = o.status === 'pending' ? 'Chấp nhận' : o.status === 'countered' ? `Đồng ý giá ${formatValue(o.counter)}` : 'Đồng ý chuyển đội';
  const rejectLabel = o.status === 'agreed' && !o.can.includes('accept') ? 'Huỷ thương vụ' : o.status === 'countered' && o.can.includes('accept') ? 'Không đồng ý' : 'Từ chối';
  return (
    <article className={`tm-offer s-${o.status}`} aria-label={`Đề nghị ${o.player.name}: ${o.buyer.name} mua từ ${o.seller.name}`}>
      <div className="tm-offer-main">
        <div className={`tm-ovr ${tier(o.player.ovr)}`}><b>{o.player.ovr}</b><span>{o.player.pos}</span></div>
        <Avatar p={{ id: o.player.id, nick: o.player.name, avatarUrl: o.player.avatarUrl }} size={42} />
        <div className="tm-offer-who">
          <b>{o.player.name}</b>
          <span className="tm-route"><span>{o.seller.name}</span><i aria-hidden>→</i><span>{o.buyer.name}</span></span>
        </div>
        <div className="tm-offer-price">
          <b>{formatValue(o.status === 'countered' ? o.counter : o.amount)}</b>
          {o.status === 'countered' && <small>Đội mua đề nghị {formatValue(o.amount)}</small>}
          {o.status !== 'countered' && o.player.value != null && <small>Giá trị {formatValue(o.player.value)}</small>}
        </div>
      </div>
      {!closed || o.status === 'completed' ? (
        <ol className="tm-steps" aria-label="Tiến trình">
          {STEPS.map(([on, label]) => <li key={label} className={on.includes(o.status) ? 'on' : ''}>{label}</li>)}
        </ol>
      ) : null}
      <div className="tm-offer-foot">
        <span className={`tm-status s-${o.status}`}>{OFFER_LABEL[o.status]}</span>
        <span className="muted">{dm(o.updatedAt.slice(0, 10))}</span>
        {o.message && <span className="tm-msg">“{o.message}”</span>}
        {o.reason && <span className="tm-msg">{o.reason}</span>}
        <span className="tm-offer-acts">
          {o.can.includes('accept') && <button type="button" className="btn primary sm" onClick={() => respond('accept', o.status === 'agreed' ? 'Đã đồng ý chuyển đội' : 'Đã chấp nhận')}>{acceptLabel}</button>}
          {o.can.includes('counter') && <button type="button" className="btn sm" onClick={() => setCounter(true)}>Trả giá</button>}
          {o.can.includes('raise') && <button type="button" className="btn sm" onClick={() => setRaise(true)}>Nâng giá</button>}
          {o.can.includes('reject') && (
            <button type="button" className="btn ghost sm" onClick={() => {
              if (!armReject) {
                setArmReject(true);
                setTimeout(() => setArmReject(false), 2500);
                return;
              }
              respond('reject', 'Đã từ chối');
            }}>{armReject ? `Xác nhận ${rejectLabel.toLowerCase()}` : rejectLabel}</button>
          )}
          {o.can.includes('withdraw') && <button type="button" className="btn ghost sm" onClick={() => respond('withdraw', 'Đã rút đề nghị')}>Rút đề nghị</button>}
        </span>
      </div>
      {counter && <CounterModal o={o} onClose={() => setCounter(false)} />}
      {raise && (
        <OfferModal
          title={`Nâng giá · ${o.player.name}`}
          p={{ id: o.player.id, name: o.player.name, value: o.player.value, teamName: o.seller.name }}
          buyerTeams={buyerTeams.filter((t) => t.id === o.buyer.id).length ? buyerTeams.filter((t) => t.id === o.buyer.id) : [o.buyer]}
          initial={Math.max(o.amount, o.counter ?? 0)}
          onClose={() => setRaise(false)}
        />
      )}
    </article>
  );
}

/* ---------------- Bảng giá cầu thủ (kiểu bảng giá thị trường) ---------------- */

const POS_GROUP: Record<Position, string> = { GK: 'gk', CB: 'df', LB: 'df', RB: 'df', CM: 'mf', ST: 'fw' };
type SortKey = 'value' | 'ovr' | 'pos';

function PriceTable({ rows, showTeam, myPlayerId, onOpen, actions, rank }: {
  rows: MarketPlayer[];
  showTeam?: boolean;
  myPlayerId?: string | null;
  onOpen: (p: MarketPlayer) => void;
  actions?: (p: MarketPlayer) => React.ReactNode;
  rank?: boolean;
}) {
  const [key, setKey] = useState<SortKey>('value');
  const [desc, setDesc] = useState(true);
  const sorted = useMemo(() => {
    const order = POSITIONS as readonly string[];
    const cmp: Record<SortKey, (a: MarketPlayer, b: MarketPlayer) => number> = {
      value: (a, b) => (a.value ?? -1) - (b.value ?? -1),
      ovr: (a, b) => a.ovr - b.ovr,
      pos: (a, b) => order.indexOf(b.pos) - order.indexOf(a.pos),
    };
    return [...rows].sort((a, b) => (desc ? -1 : 1) * cmp[key](a, b) || (b.value ?? -1) - (a.value ?? -1));
  }, [rows, key, desc]);
  const head = (k: SortKey, label: string, cls: string) => (
    <button type="button" className={`tm-th ${cls}${key === k ? ' on' : ''}`} aria-label={`Sắp xếp theo ${label}`} onClick={() => (key === k ? setDesc((d) => !d) : (setKey(k), setDesc(true)))}>
      {label}{key === k && <i aria-hidden>{desc ? '⌄' : '⌃'}</i>}
    </button>
  );
  const withActs = !!actions && rows.some((p) => actions(p));
  const ranks = new Map([...rows].filter((p) => p.value != null).sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).map((p, i) => [p.id, i + 1]));
  return (
    <div className={`tm-table${showTeam ? ' team' : ''}${withActs ? ' acts' : ''}`}>
      <div className="tm-thead">
        {head('pos', 'Vị trí', 'c-pos')}
        <span className="tm-th c-name">Tên cầu thủ</span>
        {head('ovr', 'OVR', 'c-ovr')}
        {showTeam && <span className="tm-th c-team">Thuộc</span>}
        {head('value', 'Giá trị cầu thủ', 'c-val')}
      </div>
      <ol className="tm-rows">
        {sorted.map((p) => {
          const acts = actions?.(p);
          return (
            <li key={p.id} className={`tm-row${p.isDefault ? ' nov' : ''}${p.id === myPlayerId ? ' me' : ''}`}>
              <span className={`tm-pos ${POS_GROUP[p.pos]}`} title={POS_INFO[p.pos].vn}>{p.pos}</span>
              <button type="button" className="tm-who" onClick={() => onOpen(p)} aria-label={`${shortName(p)}: xem lịch sử giá`}>
                {rank && <span className="tm-rank">{ranks.get(p.id) ?? '–'}</span>}
                <Avatar p={p} size={30} />
                <span>
                  <span className="tm-nm">
                    <b>{shortName(p)}</b>
                    {p.listedAt && <span className="tm-tag sale">Đang rao</span>}
                    {p.locked && <span className="tm-tag lock">Khoá giá</span>}
                    {p.isCaptain && <span className="tm-tag cap">ĐT</span>}
                  </span>
                  <small>{showTeam ? p.teamName : p.fullName}{p.num != null ? ` · #${p.num}` : ''}</small>
                </span>
              </button>
              <span className={`tm-o ${tier(p.ovr)}`}>{p.ovr}</span>
              {showTeam && <span className="tm-team">{p.teamName}</span>}
              <span className="tm-val">
                {p.value != null ? <><b>{formatValueFull(p.value)}</b>{p.isDefault ? <span className="tm-nov">Mặc định</span> : <Trend prev={p.prevValue} cur={p.value} />}</> : <span className="tm-nov">Chưa định giá</span>}
              </span>
              {withActs && <span className="tm-acts">{acts}</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ---------------- Màn chính ---------------- */

export function TransferView({ data }: { data: MarketData }) {
  const { act, teamId, view } = useTeam();
  const needMe = data.offers.filter((o) => o.can.some((c) => c === 'accept' || c === 'counter'));
  const [tab, setTab] = useState<Tab>(needMe.length ? 'de-nghi' : 'doi-hinh');
  const [hist, setHist] = useState<MarketPlayer | null>(null);
  const [edit, setEdit] = useState<MarketPlayer | null>(null);
  const [offer, setOffer] = useState<MarketPlayer | null>(null);
  const [pos, setPos] = useState<'all' | Position>('all');
  const [sort, setSort] = useState<'val-desc' | 'val-asc' | 'ovr' | 'new'>('val-desc');
  const [maxV, setMaxV] = useState<number>(0);
  const [q, setQ] = useState('');
  const [layout, setLayout] = useState<'list' | 'cards'>('list');
  const me = data.squad.find((p) => p.id === data.myPlayerId) ?? null;
  const top = data.squad.find((p) => p.id === data.totals.top) ?? null;
  const unvalued = data.squad.filter((p) => p.isDefault);
  const canBuyHere = data.buyerTeams.length > 0 && !data.myTeamIds.includes(teamId);
  const open = data.offers.filter((o) => ['pending', 'countered', 'agreed'].includes(o.status));
  const done = data.offers.filter((o) => !['pending', 'countered', 'agreed'].includes(o.status));

  const market = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = data.market.filter((p) => (pos === 'all' || p.pos === pos) && (!maxV || (p.value ?? 0) <= maxV) && (!s || `${p.fullName} ${p.nick ?? ''} ${p.teamName}`.toLowerCase().includes(s)));
    const by: Record<typeof sort, (a: MarketPlayer, b: MarketPlayer) => number> = {
      'val-desc': (a, b) => (b.value ?? 0) - (a.value ?? 0),
      'val-asc': (a, b) => (a.value ?? 0) - (b.value ?? 0),
      ovr: (a, b) => b.ovr - a.ovr,
      new: (a, b) => (b.listedAt ?? '').localeCompare(a.listedAt ?? ''),
    };
    return [...list].sort(by[sort]);
  }, [data.market, pos, sort, maxV, q]);

  const tabs: Array<[Tab, string]> = [
    ['doi-hinh', 'Đội hình'],
    ['thi-truong', `Thị trường (${data.market.length})`],
    ...(data.offers.length || data.insider ? ([['de-nghi', `Đề nghị${open.length ? ` (${open.length})` : ''}`]] as Array<[Tab, string]>) : []),
    ['bang-tin', 'Bảng tin'],
  ];

  return (
    <section className="view tm">
      <div className="tm-hero">
        <div className="tm-hero-l">
          <span className="tm-kicker">Thị trường chuyển nhượng</span>
          <h2 className="vt">Chuyển nhượng</h2>
          <div className="tm-total" aria-label={`Tổng giá trị đội hình ${formatValue(data.totals.value)}`}>
            <small>Tổng giá trị đội hình</small>
            <b>{formatValueFull(data.totals.value)}</b><span>đ</span>
          </div>
        </div>
        <dl className="tm-hero-r">
          <div><dt>Đã định giá</dt><dd>{data.totals.valued}/{data.totals.players}</dd></div>
          <div><dt>Trung bình</dt><dd>{data.totals.valued ? formatValue(data.totals.avg) : '–'}</dd></div>
          <div><dt>Đắt giá nhất</dt><dd>{top ? <>{shortName(top)} <small>{formatValue(top.value)}</small></> : '–'}</dd></div>
          <div><dt>Đề nghị đang mở</dt><dd>{open.length}</dd></div>
        </dl>
      </div>

      {needMe.length > 0 && (
        <button type="button" className="tm-alert" onClick={() => setTab('de-nghi')}>
          <span className="tm-alert-dot" aria-hidden />
          <b>{needMe.length} đề nghị cần bạn trả lời</b>
          <span>Xem ngay →</span>
        </button>
      )}

      {me && <MyValue me={me} />}

      <div className="seg tm-tabs" role="tablist" aria-label="Mục chuyển nhượng">
        {tabs.map(([k, label]) => <button key={k} type="button" role="tab" aria-selected={tab === k} aria-pressed={tab === k} onClick={() => setTab(k)}>{label}</button>)}
      </div>

      {tab === 'doi-hinh' && (
        <div className="panel tm-squad">
          <div className="tm-squad-h">
            <h3 className="st">Giá trị đội hình · {view.team.name}</h3>
            {data.canEdit && unvalued.some((p) => p.hasAccount) && (
              <button type="button" className="btn sm" onClick={() => act(() => remindValueAction(teamId, null), (n) => `Đã nhắc ${n} người định giá`)}>Nhắc tất cả chưa định giá ({unvalued.filter((p) => p.hasAccount).length})</button>
            )}
          </div>
          <PriceTable
            rows={data.squad}
            rank
            myPlayerId={data.myPlayerId}
            onOpen={setHist}
            actions={(p) =>
              data.canEdit || (canBuyHere && !p.isCaptain) ? (
                <>
                  {data.canEdit && (
                    <>
                      {p.isDefault && p.hasAccount && (
                        <button type="button" className="btn sm" onClick={() => act(() => remindValueAction(teamId, p.id), `Đã nhắc ${shortName(p)} định giá`)}>Nhắc</button>
                      )}
                      <button type="button" className="btn ghost sm" aria-label={`Sửa giá ${shortName(p)}`} onClick={() => setEdit(p)}>Sửa giá</button>
                      <button type="button" className="btn ghost sm" aria-label={`${p.locked ? 'Mở khoá' : 'Khoá'} giá ${shortName(p)}`} onClick={() => act(() => setValueLockAction(teamId, p.id, !p.locked), p.locked ? `Đã mở khoá giá ${shortName(p)}` : `Đã khoá giá ${shortName(p)}`)}>{p.locked ? 'Mở khoá' : 'Khoá'}</button>
                      {p.value != null && (
                        <button type="button" className="btn ghost sm" aria-label={`${p.listedAt ? 'Gỡ rao' : 'Rao bán'} ${shortName(p)}`} onClick={() => act(() => setListedAction(teamId, p.id, !p.listedAt), p.listedAt ? `Đã gỡ rao ${shortName(p)}` : `Đã rao bán ${shortName(p)}`)}>{p.listedAt ? 'Gỡ rao' : 'Rao bán'}</button>
                      )}
                    </>
                  )}
                  {canBuyHere && !p.isCaptain && <button type="button" className="btn primary sm" aria-label={`Đề nghị mua ${shortName(p)}`} onClick={() => setOffer(p)}>Đề nghị mua</button>}
                </>
              ) : null
            }
          />
          <p className="hint">Giá trị tính bằng đồng (đ); khi nhập gõ tắt M = triệu, B = tỷ. Thành viên tự đặt giá, áp dụng ngay; đội trưởng sửa / khoá được. Bấm tên để xem lịch sử giá, bấm tiêu đề cột để sắp xếp.</p>
        </div>
      )}

      {tab === 'thi-truong' && (
        <div className="tm-market">
          <div className="panel tm-filter" role="search">
            <div className="field"><label htmlFor="tmQ">Tìm cầu thủ / đội</label><input id="tmQ" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tên, biệt danh, đội…" /></div>
            <div className="field"><label htmlFor="tmPos">Vị trí</label>
              <select id="tmPos" value={pos} onChange={(e) => setPos(e.target.value as typeof pos)}>
                <option value="all">Tất cả</option>
                {POSITIONS.map((k) => <option key={k} value={k}>{k} · {POS_INFO[k].vn}</option>)}
              </select>
            </div>
            <div className="field"><label htmlFor="tmMax">Giá tối đa</label>
              <select id="tmMax" value={maxV} onChange={(e) => setMaxV(Number(e.target.value))}>
                <option value={0}>Không giới hạn</option>
                {[500, 1000, 2000, 5000, 10000, 50000].map((u) => <option key={u} value={u}>≤ {formatValueShort(u)}</option>)}
              </select>
            </div>
            <div className="field"><label htmlFor="tmSort">Sắp xếp</label>
              <select id="tmSort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
                <option value="val-desc">Giá cao → thấp</option>
                <option value="val-asc">Giá thấp → cao</option>
                <option value="ovr">Chỉ số cao nhất</option>
                <option value="new">Mới rao</option>
              </select>
            </div>
          </div>
          <div className="seg tm-layout" role="group" aria-label="Kiểu hiển thị">
            <button type="button" aria-pressed={layout === 'list'} onClick={() => setLayout('list')}>Bảng giá</button>
            <button type="button" aria-pressed={layout === 'cards'} onClick={() => setLayout('cards')}>Thẻ cầu thủ</button>
          </div>
          {market.length ? (
            layout === 'list' ? (
              <div className="panel tm-squad">
                <PriceTable
                  rows={market}
                  showTeam
                  onOpen={setHist}
                  actions={(p) =>
                    data.myTeamIds.includes(p.teamId) ? <span className="tm-mine">Đội của bạn</span>
                    : data.buyerTeams.some((t) => t.id !== p.teamId) ? <button type="button" className="btn primary sm" aria-label={`Đề nghị mua ${shortName(p)}`} onClick={() => setOffer(p)}>Đề nghị mua</button>
                    : null
                  }
                />
              </div>
            ) : (
              <div className="tm-grid">
                {market.map((p) => (
                  <MvCard
                    key={p.id}
                    p={p}
                    onOpen={() => setHist(p)}
                    mine={data.myTeamIds.includes(p.teamId)}
                    onOffer={data.buyerTeams.some((t) => t.id !== p.teamId) && !data.myTeamIds.includes(p.teamId) ? () => setOffer(p) : undefined}
                  />
                ))}
              </div>
            )
          ) : <div className="empty-list">Không có cầu thủ nào đang rao khớp bộ lọc.</div>}
          {!data.buyerTeams.length && !data.canEdit && <p className="hint">Chỉ đội trưởng mới gửi được đề nghị mua.</p>}
        </div>
      )}

      {tab === 'de-nghi' && (
        <div className="tm-offers">
          {open.length ? open.map((o) => <OfferCard key={o.id} o={o} buyerTeams={data.buyerTeams} />) : <div className="empty-list">Không có đề nghị nào đang mở.</div>}
          {done.length > 0 && (
            <details className="tm-done">
              <summary>Đã kết thúc ({done.length})</summary>
              {done.map((o) => <OfferCard key={o.id} o={o} buyerTeams={data.buyerTeams} />)}
            </details>
          )}
        </div>
      )}

      {tab === 'bang-tin' && (
        <div className="tm-news">
          {data.news.length ? data.news.map((n) => (
            <article key={n.id} className="tm-news-item">
              <span className="tm-hwg">HERE WE GO</span>
              <div className="tm-news-main">
                <div className={`tm-ovr ${tier(n.player.ovr)}`}><b>{n.player.ovr}</b><span>{n.player.pos}</span></div>
                <Avatar p={{ id: n.player.id, nick: n.player.name, avatarUrl: n.player.avatarUrl }} size={44} />
                <div>
                  <b>{n.player.name}</b>
                  <span className="tm-route"><span>{n.seller.name}</span><i aria-hidden>→</i><span>{n.buyer.name}</span></span>
                </div>
                <div className="tm-news-fee"><b>{formatValue(n.amount)}</b><small>{dm(n.at.slice(0, 10))}</small></div>
              </div>
            </article>
          )) : <div className="empty-list">Chưa có thương vụ nào hoàn tất.</div>}
        </div>
      )}

      {hist && <HistoryModal p={hist} onClose={() => setHist(null)} />}
      {edit && <SetValueModal p={edit} onClose={() => setEdit(null)} />}
      {offer && (
        <OfferModal
          p={{ id: offer.id, name: shortName(offer), value: offer.value, teamName: offer.teamName }}
          buyerTeams={data.buyerTeams.filter((t) => t.id !== offer.teamId)}
          onClose={() => setOffer(null)}
        />
      )}
    </section>
  );
}
