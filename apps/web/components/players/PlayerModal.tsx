'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  POSITIONS, POS_INFO, STAT_INFO, STAT_KEYS, STYLES, WEIGHTS, fillStats, fmt1, inferStats, rankedPositions, suggestStyles,
  type Position, type Ratings, type Stats,
} from '@san7/core';
import { Avatar, Modal, Tabs, tierColor } from '../ui';
import { Radar } from './Radar';
import { useTeam } from '../TeamContext';
import { uploadImage } from '@/lib/image';

export type PlayerMode = 'edit' | 'self' | 'view' | 'app';

export interface PlayerDraft {
  id?: string;
  fullName: string;
  nick: string | null;
  dob: string | null;
  num: number | null;
  foot: string;
  payType: string;
  avatarUrl: string | null;
  styles: string[];
  stats: Stats;
  isCaptain?: boolean;
  ratings?: Ratings;
}

export const blankPlayer = (): PlayerDraft => ({
  fullName: '', nick: '', dob: '', num: null, foot: 'Phải', payType: 'quy', avatarUrl: null, styles: [], isCaptain: false,
  stats: fillStats({ HAN: 3, REF: 3, GKP: 3 }),
});

interface Props {
  mode: PlayerMode;
  initial: PlayerDraft;
  title: string;
  pendingNote?: boolean;
  /** thông tin phụ ở đầu modal (VD: so sánh cũ/mới khi duyệt) */
  extra?: React.ReactNode;
  saveLabel?: string;
  onClose: () => void;
  onSave?: (d: PlayerDraft) => Promise<boolean | void>;
  onDelete?: () => Promise<void>;
  /** nút phụ ở chân modal (VD: Từ chối) */
  footerExtra?: React.ReactNode;
}

type Tab = 'ho-so' | 'chi-so' | 'uoc-luong';

/** Modal hồ sơ cầu thủ 3 tab: Hồ sơ · Chỉ số & vị trí · Ước lượng từ vị trí (BRD 4.6). */
export function PlayerModal({ mode, initial, title, pendingNote, extra, saveLabel, onClose, onSave, onDelete, footerExtra }: Props) {
  const { draft: draftRef, toast } = useTeam();
  const [d, setD] = useState<PlayerDraft>(initial);
  const [tab, setTab] = useState<Tab>('ho-so');
  const [self, setSelf] = useState<Ratings>(initial.ratings ?? {});
  const [fx, setFx] = useState(false);
  const [busy, setBusy] = useState(false);
  const [armDel, setArmDel] = useState(false);
  const lock = mode === 'view';
  const set = <K extends keyof PlayerDraft>(k: K, v: PlayerDraft[K]) => setD((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    draftRef.current = { stats: d.stats, foot: d.foot };
    return () => {
      draftRef.current = null;
    };
  }, [d.stats, d.foot, draftRef]);

  const ranked = useMemo(() => rankedPositions(d.stats, d.foot), [d.stats, d.foot]);
  const sug = useMemo(() => suggestStyles(d.stats), [d.stats]);

  const submit = async () => {
    if (!d.fullName.trim()) {
      setTab('ho-so');
      toast('Cần nhập họ và tên');
      return;
    }
    setBusy(true);
    const ok = await onSave?.(d);
    setBusy(false);
    if (ok !== false) onClose();
  };

  let g = '';
  return (
    <Modal
      title={title}
      onClose={onClose}
      tabs={<Tabs<Tab> value={tab} onChange={setTab} items={[['ho-so', 'Hồ sơ'], ['chi-so', 'Chỉ số & vị trí'], ['uoc-luong', 'Ước lượng từ vị trí', lock]]} />}
      footer={
        <>
          {mode === 'edit' && onDelete && (
            <button
              className="btn danger ghost"
              type="button"
              onClick={async () => {
                if (!armDel) {
                  setArmDel(true);
                  setTimeout(() => setArmDel(false), 2500);
                  return;
                }
                await onDelete();
                onClose();
              }}
            >
              {armDel ? 'Bấm lần nữa để xoá' : 'Xoá cầu thủ'}
            </button>
          )}
          {footerExtra}
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button className="btn" type="button" onClick={onClose}>{lock ? 'Đóng' : 'Huỷ'}</button>
            {!lock && (
              <button className="btn primary" type="button" disabled={busy} onClick={submit}>
                {saveLabel ?? (mode === 'self' ? 'Gửi đội trưởng duyệt' : 'Lưu')}
              </button>
            )}
          </div>
        </>
      }
    >
      <form className={lock ? 'locked' : undefined} autoComplete="off" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        {extra}
        <div hidden={tab !== 'ho-so'} style={{ display: tab === 'ho-so' ? 'grid' : undefined, gap: 18 }}>
          {pendingNote && <p className="note" style={{ margin: 0 }}>Bạn đang có một bản cập nhật chờ đội trưởng duyệt. Gửi lại sẽ thay bản đang chờ.</p>}
          <div className="prof">
            <div className="avpick">
              <Avatar p={{ id: d.id ?? 'new', nick: d.nick, fullName: d.fullName || '?', avatarUrl: d.avatarUrl }} size={104} />
              {!lock && (
                <>
                  <label className="btn sm">
                    Tải ảnh
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        try {
                          set('avatarUrl', await uploadImage(f, 'avatar'));
                        } catch (err) {
                          toast((err as Error).message);
                        }
                      }}
                    />
                  </label>
                  {d.avatarUrl && <button type="button" className="btn ghost sm" onClick={() => set('avatarUrl', null)}>Bỏ ảnh</button>}
                </>
              )}
            </div>
            <div className="fgrid">
              <div className="field c4"><label htmlFor="fFull">Họ và tên</label><input id="fFull" maxLength={60} disabled={lock} value={d.fullName} onChange={(e) => set('fullName', e.target.value)} placeholder="VD: Nguyễn Văn Quang" /></div>
              <div className="field c2 h3"><label htmlFor="fNum">Số áo</label><input id="fNum" type="number" min={0} max={99} inputMode="numeric" disabled={lock} value={d.num ?? ''} onChange={(e) => set('num', e.target.value === '' ? null : Math.max(0, Math.min(99, parseInt(e.target.value, 10))))} /></div>
              <div className="field c3"><label htmlFor="fNick">Biệt danh (hiện trên sân)</label><input id="fNick" maxLength={24} disabled={lock} value={d.nick ?? ''} onChange={(e) => set('nick', e.target.value)} /></div>
              <div className="field c3"><label htmlFor="fDob">Ngày sinh</label><input id="fDob" type="date" disabled={lock} value={d.dob ?? ''} onChange={(e) => set('dob', e.target.value)} /></div>
              <div className="field c3"><label htmlFor="fFoot">Chân thuận</label><select id="fFoot" disabled={lock} value={d.foot} onChange={(e) => set('foot', e.target.value)}><option>Phải</option><option>Trái</option><option>Hai chân</option></select></div>
              <div className="field c3">
                <label htmlFor="fPay">Hình thức đóng tiền</label>
                <select id="fPay" disabled={lock || mode === 'self'} value={d.payType} onChange={(e) => set('payType', e.target.value)}>
                  <option value="quy">Đóng quỹ tháng</option>
                  <option value="le">Đá lẻ (trả theo trận)</option>
                </select>
              </div>
              {mode === 'edit' && (
                <div className="c6"><label className="check"><input type="checkbox" checked={!!d.isCaptain} onChange={(e) => set('isCaptain', e.target.checked)} /> Đội trưởng (đeo băng C)</label></div>
              )}
            </div>
          </div>
          <div>
            <div className="sec-title" style={{ marginBottom: 8 }}>
              Phong cách thi đấu{' '}
              {!lock && (
                <button type="button" className="chipbtn" onClick={() => {
                  setD((x) => ({ ...x, styles: [...new Set([...x.styles, ...sug])] }));
                  toast(sug.length ? `Đã thêm ${sug.length} gợi ý` : 'Chưa có chỉ số nào đủ nổi bật');
                }}>
                  Gợi ý từ chỉ số{sug.length ? ` (${sug.length})` : ''}
                </button>
              )}
            </div>
            <div className="stylepick">
              {STYLES.map((s) => (
                <button key={s} type="button" aria-pressed={d.styles.includes(s)} disabled={lock} onClick={() => set('styles', d.styles.includes(s) ? d.styles.filter((x) => x !== s) : [...d.styles, s])}>{s}</button>
              ))}
            </div>
          </div>
        </div>

        <div hidden={tab !== 'chi-so'}>
          <div className="split">
            <div>
              <div className="sec-title">Chỉ số cơ bản <span>thang 1–10</span></div>
              <div className="posgrid">
                {STAT_KEYS.map((k) => {
                  const v = STAT_INFO[k];
                  const head = v.group !== g ? ((g = v.group), <div key={'g' + g} className="group-lbl">{g}</div>) : null;
                  return [
                    head,
                    <div key={k} className="prow">
                      <div className="code">{k}<small>{v.vn}</small></div>
                      <input type="range" min={1} max={10} step={0.5} disabled={lock} value={d.stats[k]} aria-label={`${v.vn}: ${v.desc}`} title={v.desc} onChange={(e) => set('stats', { ...d.stats, [k]: +e.target.value })} />
                      <div className="val">{fmt1(d.stats[k])}</div>
                    </div>,
                  ];
                })}
              </div>
            </div>
            <div className="preview">
              <div className="radar"><Radar stats={d.stats} /></div>
              <div className="sec-title" style={{ margin: '4px 0' }}>
                Điểm theo vị trí <button type="button" className="chipbtn" aria-expanded={fx} onClick={() => setFx(!fx)}>Bảng trọng số</button>
              </div>
              <div>
                {ranked.map(([k, v], i) => (
                  <button key={k} type="button" className={`pp${i === 0 ? ' best' : ''}`} data-x={`d:${k}`} aria-label={`${POS_INFO[k].vn} ${fmt1(v)}, xem cách tính`}>
                    <b>{k}</b>
                    <span className="pb"><i style={{ width: `${v * 10}%`, background: tierColor(v) }} /></span>
                    <em>{fmt1(v)}</em>
                  </button>
                ))}
              </div>
              <p className="hint" style={{ marginTop: 6, fontSize: 11.5 }}>Trỏ hoặc chạm vào một vị trí để xem cách tính.</p>
            </div>
          </div>
          {fx && (
            <div style={{ marginTop: 16 }}>
              <p style={{ margin: '0 0 8px', fontSize: 13 }}>
                <b>Điểm vị trí</b> = Σ (trọng số % × chỉ số) / 100, cộng điều chỉnh chân thuận ở vị trí cánh (đúng chân +0.3, ngược chân −0.3, hai chân +0.2).
              </p>
              <div className="twrap">
                <table className="ftable">
                  <thead><tr><th>Chỉ số</th>{(['GK', 'CB', 'LB', 'CDM', 'CM', 'LM', 'CAM', 'ST'] as Position[]).map((c) => <th key={c}>{c}{c === 'LB' ? '/RB' : c === 'LM' ? '/RM' : ''}</th>)}</tr></thead>
                  <tbody>
                    {STAT_KEYS.map((k) => (
                      <tr key={k}>
                        <th><b>{k}</b> {STAT_INFO[k].vn}</th>
                        {(['GK', 'CB', 'LB', 'CDM', 'CM', 'LM', 'CAM', 'ST'] as Position[]).map((c) => {
                          const w = WEIGHTS[c][k] || 0;
                          return <td key={c} style={{ ['--a' as string]: w / 32 }}>{w || ''}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div hidden={tab !== 'uoc-luong'}>
          <div className="sec-title">Tự đánh giá theo vị trí <span>chỉ cần các vị trí bạn biết · 0 = bỏ qua</span></div>
          <p className="hint" style={{ margin: '4px 0 8px' }}>Dùng khi chưa rõ chỉ số chi tiết. Hệ thống tìm bộ chỉ số khớp nhất với các điểm bạn nhập, rồi bạn chỉnh tiếp ở tab Chỉ số.</p>
          <div className="posgrid">
            {POSITIONS.map((k) => {
              const r = self[k] || 0;
              return (
                <div key={k} className={`prow${r ? '' : ' off'}`}>
                  <div className="code">{k}<small>{POS_INFO[k].vn}</small></div>
                  <input type="range" min={0} max={10} step={0.5} value={r} aria-label={`Tự đánh giá ${POS_INFO[k].vn}`} onChange={(e) => setSelf((s) => ({ ...s, [k]: +e.target.value }))} />
                  <div className="val">{r ? fmt1(r) : '—'}</div>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="btn primary"
            style={{ marginTop: 10 }}
            onClick={() => {
              const rs = Object.fromEntries(Object.entries(self).filter(([, v]) => (v ?? 0) > 0)) as Ratings;
              if (!Object.keys(rs).length) return toast('Kéo ít nhất 1 vị trí lên trên 0');
              set('stats', inferStats(rs, d.foot));
              setTab('chi-so');
              toast('Đã ước lượng chỉ số, bạn có thể chỉnh tiếp');
            }}
          >
            Ước lượng chỉ số
          </button>
        </div>
      </form>
    </Modal>
  );
}
