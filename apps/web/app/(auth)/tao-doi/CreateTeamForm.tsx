'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { DAY_ORDER, DAY_SHORT, POSITIONS, POS_INFO, type Position } from '@san7/core';
import { checkTeamNameAction, createTeamAction, logoutAction } from '@/app/actions';

export function CreateTeamForm() {
  const router = useRouter();
  const [err, setErr] = useState('');
  const [name, setName] = useState('');
  const [taken, setTaken] = useState<boolean | null>(null);
  const [days, setDays] = useState<number[]>([]);
  const [pending, start] = useTransition();

  // Kiểm tra trùng tên khi gõ (debounce 300 ms) — BRD 3.1
  useEffect(() => {
    if (name.trim().length < 2) {
      setTaken(null);
      return;
    }
    const t = setTimeout(() => checkTeamNameAction(name).then(setTaken), 300);
    return () => clearTimeout(t);
  }, [name]);

  return (
    <>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const s = (k: string) => String(f.get(k) ?? '').trim();
          const pos1 = s('pos1') as Position;
          const pos2 = s('pos2') as Position | '';
          const ratings: Partial<Record<Position, number>> = { [pos1]: Number(s('r1')) || 7 };
          if (pos2) ratings[pos2] = Number(s('r2')) || 6;
          start(async () => {
            setErr('');
            const r = await createTeamAction({
              name: s('name'), foundedOn: s('foundedOn') || null, slogan: s('slogan') || null, homeName: s('homeName') || null,
              homeMapUrl: s('homeMapUrl') || null, homeDays: days, homeFrom: s('homeFrom') || null, homeTo: s('homeTo') || null,
              homeCost: Number(s('homeCost')) || 0, captainNum: s('num') ? Number(s('num')) : null, captainFoot: s('foot') || 'Phải',
              captainRatings: ratings,
            });
            if (!r.ok) setErr(r.error);
            else router.replace(`/t/${r.data}/doi?moi=1`);
          });
        }}
      >
        <div className="field">
          <label htmlFor="cName">Tên đội</label>
          <input id="cName" name="name" required maxLength={40} placeholder="VD: Sao Băng FC" value={name} onChange={(e) => setName(e.target.value)} aria-describedby="cNameHint" />
          <small className="hint" id="cNameHint" style={{ margin: 0, color: taken ? 'var(--bad)' : undefined }}>
            {taken === true ? 'Tên đội đã có, hãy chọn tên khác' : taken === false ? 'Tên đội dùng được' : ''}
          </small>
        </div>
        <div className="fgrid">
          <div className="field c3"><label htmlFor="cFounded">Ngày thành lập</label><input id="cFounded" name="foundedOn" type="date" /></div>
          <div className="field c3"><label htmlFor="cSlogan">Khẩu hiệu</label><input id="cSlogan" name="slogan" maxLength={80} /></div>
        </div>
        <div className="fgrid">
          <div className="field c3"><label htmlFor="cHome">Sân nhà</label><input id="cHome" name="homeName" maxLength={50} placeholder="VD: Sân Chảo Lửa" /></div>
          <div className="field c3"><label htmlFor="cMap">Link bản đồ (https://)</label><input id="cMap" name="homeMapUrl" type="url" placeholder="https://maps.app.goo.gl/..." /></div>
        </div>
        <div className="field">
          <label>Ngày đá trong tuần</label>
          <div className="days">
            {DAY_ORDER.map((d) => (
              <button key={d} type="button" aria-pressed={days.includes(d)} onClick={() => setDays((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]))}>
                {DAY_SHORT[d]}
              </button>
            ))}
          </div>
        </div>
        <div className="fgrid">
          <div className="field c2 h3"><label htmlFor="cFrom">Giờ đá</label><input id="cFrom" name="homeFrom" type="time" defaultValue="19:30" /></div>
          <div className="field c2 h3"><label htmlFor="cTo">Đến</label><input id="cTo" name="homeTo" type="time" defaultValue="21:00" /></div>
          <div className="field c2"><label htmlFor="cCost">Tiền sân/buổi (đ)</label><input id="cCost" name="homeCost" type="number" min={0} step={10000} defaultValue={0} /></div>
        </div>
        <div className="sec-title">Hồ sơ cầu thủ của bạn</div>
        <div className="fgrid">
          <div className="field c2"><label htmlFor="cNum">Số áo</label><input id="cNum" name="num" type="number" min={0} max={99} /></div>
          <div className="field c2"><label htmlFor="cFoot">Chân thuận</label><select id="cFoot" name="foot"><option>Phải</option><option>Trái</option><option>Hai chân</option></select></div>
          <div className="field c2"><label htmlFor="cR1">Tự chấm (1–10)</label><input id="cR1" name="r1" type="number" min={1} max={10} step={0.5} defaultValue={7} /></div>
          <div className="field c3"><label htmlFor="cPos1">Vị trí sở trường</label><select id="cPos1" name="pos1" defaultValue="CB">{POSITIONS.map((p) => <option key={p} value={p}>{p} · {POS_INFO[p].vn}</option>)}</select></div>
          <div className="field c3"><label htmlFor="cPos2">Vị trí phụ</label><select id="cPos2" name="pos2" defaultValue=""><option value="">Không có</option>{POSITIONS.map((p) => <option key={p} value={p}>{p} · {POS_INFO[p].vn}</option>)}</select></div>
          <input type="hidden" name="r2" value="6" />
        </div>
        <p className="hint" style={{ margin: 0 }}>Quỹ tháng mặc định 200.000đ, đá lẻ 80.000đ/trận — đổi được ở tab Quỹ.</p>
        <div className="err" role="alert">{err}</div>
        <button className="btn primary" type="submit" disabled={pending || taken === true}>Tạo đội</button>
      </form>
      <p style={{ margin: 0, fontSize: 13 }}>
        <button type="button" className="linkbtn" onClick={() => logoutAction()}>Đăng xuất</button>
      </p>
    </>
  );
}
