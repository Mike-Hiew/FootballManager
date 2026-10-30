'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { POSITIONS, POS_INFO, STYLES, type Position } from '@san7/core';
import { logoutAction, submitJoinAction } from '@/app/actions';

export function JoinForm({ code, me }: { code: string; me: { name: string; phone: string } | null }) {
  const router = useRouter();
  const [err, setErr] = useState('');
  const [styles, setStyles] = useState<string[]>([]);
  const [pending, start] = useTransition();
  return (
    <>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const s = (k: string) => String(f.get(k) ?? '').trim();
          const ratings: Partial<Record<Position, number>> = {};
          if (s('pos1')) ratings[s('pos1') as Position] = Number(s('r1')) || 7;
          if (s('pos2')) ratings[s('pos2') as Position] = Number(s('r2')) || 6;
          start(async () => {
            setErr('');
            const r = await submitJoinAction(code, {
              fullName: s('fullName'), nick: s('nick') || null, dob: s('dob') || null, phone: s('phone'), password: s('password'),
              num: s('num') ? Number(s('num')) : null, foot: s('foot'), payType: s('payType'), styles, ratings,
            });
            if (!r.ok) setErr(r.error);
            else router.replace('/bat-dau');
          });
        }}
      >
        <div className="fgrid">
          <div className="field c4"><label htmlFor="jName">Họ và tên</label><input id="jName" name="fullName" required maxLength={60} defaultValue={me?.name ?? ''} /></div>
          <div className="field c2"><label htmlFor="jNum">Số áo muốn mặc</label><input id="jNum" name="num" type="number" min={0} max={99} /></div>
          <div className="field c3"><label htmlFor="jPhone">Số điện thoại</label><input id="jPhone" name="phone" inputMode="tel" required defaultValue={me?.phone ?? ''} readOnly={!!me} /></div>
          {!me && (
            <div className="field c3">
              <label htmlFor="jPw">Mật khẩu</label>
              <input id="jPw" name="password" type="password" required autoComplete="new-password" />
              <small className="hint" style={{ margin: 0 }}>Nếu số điện thoại đã có tài khoản, nhập mật khẩu cũ.</small>
            </div>
          )}
          <div className="field c3"><label htmlFor="jNick">Biệt danh</label><input id="jNick" name="nick" maxLength={24} /></div>
          <div className="field c3"><label htmlFor="jDob">Ngày sinh</label><input id="jDob" name="dob" type="date" /></div>
          <div className="field c3"><label htmlFor="jFoot">Chân thuận</label><select id="jFoot" name="foot"><option>Phải</option><option>Trái</option><option>Hai chân</option></select></div>
          <div className="field c3"><label htmlFor="jPay">Hình thức đóng tiền</label><select id="jPay" name="payType"><option value="quy">Đóng quỹ tháng</option><option value="le">Đá lẻ theo trận</option></select></div>
          <div className="field c4"><label htmlFor="jPos1">Vị trí sở trường</label><select id="jPos1" name="pos1" defaultValue="ST">{POSITIONS.map((p) => <option key={p} value={p}>{p} · {POS_INFO[p].vn}</option>)}</select></div>
          <div className="field c2"><label htmlFor="jR1">Tự chấm (1–10)</label><input id="jR1" name="r1" type="number" min={1} max={10} step={0.5} defaultValue={7} /></div>
          <div className="field c4"><label htmlFor="jPos2">Vị trí phụ</label><select id="jPos2" name="pos2" defaultValue=""><option value="">Không có</option>{POSITIONS.map((p) => <option key={p} value={p}>{p} · {POS_INFO[p].vn}</option>)}</select></div>
          <div className="field c2"><label htmlFor="jR2">Tự chấm</label><input id="jR2" name="r2" type="number" min={1} max={10} step={0.5} defaultValue={6} /></div>
        </div>
        <div>
          <div className="sec-title" style={{ marginBottom: 6 }}>Phong cách thi đấu</div>
          <div className="stylepick">
            {STYLES.filter((x) => x !== 'Thủ lĩnh').map((t) => (
              <button key={t} type="button" className="chipbtn" aria-pressed={styles.includes(t)} onClick={() => setStyles((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]))}>{t}</button>
            ))}
          </div>
        </div>
        <p className="hint" style={{ margin: 0 }}>Từ điểm tự chấm, hệ thống ước lượng bộ chỉ số ban đầu. Đội trưởng có thể chỉnh lại khi duyệt.</p>
        <div className="err" role="alert">{err}</div>
        <button className="btn primary" type="submit" disabled={pending}>Gửi đăng ký vào đội</button>
      </form>
      {me ? (
        <p style={{ margin: 0, fontSize: 13 }}>
          Đang đăng nhập: <b>{me.name}</b>. <button type="button" className="linkbtn" onClick={() => logoutAction()}>Dùng tài khoản khác</button>
        </p>
      ) : (
        <p style={{ margin: 0, fontSize: 13 }}>Đã có tài khoản? Nhập số điện thoại và mật khẩu cũ ở trên.</p>
      )}
    </>
  );
}
