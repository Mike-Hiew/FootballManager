'use client';
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from 'react';
import { DAY_ORDER, DAY_SHORT } from '@san7/core';
import { useTeam } from '../TeamContext';
import { Modal } from '../ui';
import { checkTeamNameAction, updateTeamAction } from '@/app/actions';
import { uploadImage, type ImageKind } from '@/lib/image';

/** Modal "Sửa thông tin đội" (BRD 8.1). */
export function TeamInfoModal({ onClose }: { onClose: () => void }) {
  const { view, act, teamId, toast } = useTeam();
  const t = view.team;
  const [name, setName] = useState(t.name);
  const [taken, setTaken] = useState(false);
  const [days, setDays] = useState<number[]>(t.homeDays);
  const [img, setImg] = useState({ photoUrl: t.photoUrl, awardBootUrl: t.awardBootUrl, awardAssistUrl: t.awardAssistUrl });
  useEffect(() => {
    if (name.trim().length < 2 || name === t.name) return setTaken(false);
    const id = setTimeout(() => checkTeamNameAction(name, teamId).then(setTaken), 300);
    return () => clearTimeout(id);
  }, [name, t.name, teamId]);

  const pick = (k: keyof typeof img, kind: ImageKind) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const url = await uploadImage(f, kind);
      setImg((x) => ({ ...x, [k]: url }));
    } catch (err) {
      toast((err as Error).message);
    }
  };

  return (
    <Modal
      title="Thông tin đội"
      wide={720}
      onClose={onClose}
      footer={
        <>
          <button className="btn" type="button" style={{ marginLeft: 'auto' }} onClick={onClose}>Huỷ</button>
          <button className="btn primary" type="submit" form="tForm" disabled={taken}>Lưu thông tin</button>
        </>
      }
    >
      <form
        id="tForm"
        autoComplete="off"
        style={{ display: 'grid', gap: 18 }}
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const s = (k: string) => String(f.get(k) ?? '').trim();
          const r = await act(() => updateTeamAction(teamId, {
            name, foundedOn: s('foundedOn') || null, slogan: s('slogan') || null, homeName: s('homeName') || null, homeAddress: s('homeAddress') || null,
            homeMapUrl: s('homeMapUrl') || null, homeDays: days, homeFrom: s('homeFrom') || null, homeTo: s('homeTo') || null, homeCost: Number(s('homeCost')) || 0, fullSquad: Number(s('fullSquad')) || t.fullSquad,
            rulesText: s('rules'), photoUrl: img.photoUrl ?? '', awardBootUrl: img.awardBootUrl ?? '', awardAssistUrl: img.awardAssistUrl ?? '',
          }), 'Đã lưu thông tin đội');
          if (r !== undefined) onClose();
        }}
      >
        <div>
          <div className="sec-title" style={{ marginBottom: 8 }}>Ảnh đội bóng</div>
          <div className="tphoto">{img.photoUrl ? <img src={img.photoUrl} alt="Ảnh đội" /> : <span className="hint">Chưa có ảnh</span>}</div>
          <div className="row-actions" style={{ marginTop: 8 }}>
            <label className="btn sm">Tải ảnh lên<input type="file" accept="image/*" hidden onChange={pick('photoUrl', 'team')} /></label>
            {img.photoUrl && <button type="button" className="btn ghost sm" onClick={() => setImg((x) => ({ ...x, photoUrl: null }))}>Bỏ ảnh</button>}
            <span className="hint" style={{ margin: 0 }}>Ảnh tập thể hoặc logo, dùng cả làm biểu tượng đội ở góc trên.</span>
          </div>
        </div>
        <div>
          <div className="sec-title" style={{ marginBottom: 8 }}>Hình cúp giải thưởng <span>không bắt buộc · để trống sẽ dùng hình minh hoạ có sẵn</span></div>
          <div className="awardup">
            {([['awardBootUrl', 'Giày vàng'], ['awardAssistUrl', 'Vua kiến tạo']] as const).map(([k, label]) => (
              <div key={k} className="row-actions">
                <b style={{ minWidth: 100 }}>{label}</b>
                {img[k] && <img src={img[k]!} alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} />}
                <label className="btn sm">Tải ảnh<input type="file" accept="image/png,image/*" hidden onChange={pick(k, 'award')} /></label>
                {img[k] && <button type="button" className="btn ghost sm" onClick={() => setImg((x) => ({ ...x, [k]: null }))}>Bỏ</button>}
              </div>
            ))}
          </div>
        </div>
        <div className="fgrid">
          <div className="field c4">
            <label htmlFor="tName">Tên đội</label>
            <input id="tName" maxLength={40} required value={name} onChange={(e) => setName(e.target.value)} />
            {taken && <small className="err" style={{ margin: 0 }}>Tên đội đã có, hãy chọn tên khác</small>}
          </div>
          <div className="field c2"><label htmlFor="tFounded">Ngày thành lập</label><input id="tFounded" name="foundedOn" type="date" defaultValue={t.foundedOn ?? ''} /></div>
          <div className="field c6"><label htmlFor="tSlogan">Khẩu hiệu</label><input id="tSlogan" name="slogan" maxLength={80} defaultValue={t.slogan ?? ''} /></div>
        </div>
        <div className="fgrid">
          <div className="c6 sec-title">Sân nhà</div>
          <div className="field c3"><label htmlFor="hName">Tên sân</label><input id="hName" name="homeName" maxLength={50} defaultValue={t.homeName ?? ''} /></div>
          <div className="field c3"><label htmlFor="hAddr">Địa chỉ</label><input id="hAddr" name="homeAddress" maxLength={80} defaultValue={t.homeAddress ?? ''} /></div>
          <div className="field c6"><label htmlFor="hMap">Link địa điểm (Google Maps, bắt đầu bằng https://)</label><input id="hMap" name="homeMapUrl" type="url" inputMode="url" pattern="https://.*" defaultValue={t.homeMapUrl ?? ''} /></div>
          <div className="field c6">
            <label>Ngày đá cố định</label>
            <div className="days">
              {DAY_ORDER.map((d) => <button key={d} type="button" aria-pressed={days.includes(d)} onClick={() => setDays((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]))}>{DAY_SHORT[d]}</button>)}
            </div>
          </div>
          <div className="field c2 h3"><label htmlFor="hFrom">Giờ bắt đầu</label><input id="hFrom" name="homeFrom" type="time" defaultValue={t.homeFrom ?? ''} /></div>
          <div className="field c2 h3"><label htmlFor="hTo">Giờ kết thúc</label><input id="hTo" name="homeTo" type="time" defaultValue={t.homeTo ?? ''} /></div>
          <div className="field c2"><label htmlFor="hCost">Tiền sân / buổi (đ)</label><input id="hCost" name="homeCost" type="number" min={0} step={10000} inputMode="numeric" defaultValue={t.homeCost} /></div>
          <div className="field c2">
            <label htmlFor="tSquad">Đủ người khi có</label>
            <input id="tSquad" name="fullSquad" type="number" min={7} max={30} step={1} inputMode="numeric" required defaultValue={t.fullSquad} />
            <small className="hint" style={{ margin: 0 }}>Số người Đi để trận được báo Đủ (7 ra sân + dự bị)</small>
          </div>
        </div>
        <div className="field">
          <label htmlFor="tRulesIn">Quy định đội bóng <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>· mỗi dòng một quy định · 2 dòng đầu hiện nổi bật, còn lại thu gọn thành icon</span></label>
          <textarea id="tRulesIn" name="rules" rows={7} style={{ resize: 'vertical', lineHeight: 1.5 }} defaultValue={t.rules.join('\n')} />
        </div>
      </form>
    </Modal>
  );
}
