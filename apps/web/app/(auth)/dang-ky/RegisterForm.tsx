'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { registerAction } from '@/app/actions';

export function RegisterForm() {
  const router = useRouter();
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();
  return (
    <>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const f = Object.fromEntries(new FormData(e.currentTarget));
          start(async () => {
            setErr('');
            const r = await registerAction(f);
            if (!r.ok) setErr(r.error);
            else router.replace('/tao-doi');
          });
        }}
      >
        <div className="field"><label htmlFor="rName">Họ và tên</label><input id="rName" name="name" required maxLength={60} autoComplete="name" /></div>
        <div className="fgrid">
          <div className="field c3"><label htmlFor="rPhone">Số điện thoại</label><input id="rPhone" name="phone" inputMode="tel" required autoComplete="tel" placeholder="09xxxxxxxx" /></div>
          <div className="field c3"><label htmlFor="rEmail">Email</label><input id="rEmail" name="email" type="email" required autoComplete="email" /></div>
        </div>
        <div className="fgrid">
          <div className="field c3"><label htmlFor="rPw">Mật khẩu</label><input id="rPw" name="password" type="password" required minLength={8} autoComplete="new-password" /></div>
          <div className="field c3"><label htmlFor="rPw2">Nhập lại mật khẩu</label><input id="rPw2" name="confirm" type="password" required autoComplete="new-password" /></div>
        </div>
        <p className="hint" style={{ margin: 0 }}>Mật khẩu tối thiểu 8 ký tự, tránh mật khẩu phổ biến như 12345678.</p>
        <div className="err" role="alert">{err}</div>
        <button className="btn primary" type="submit" disabled={pending}>Tiếp tục: tạo đội</button>
      </form>
      <p style={{ margin: 0, fontSize: 13 }}>Đã có tài khoản? <Link className="linkbtn" href="/dang-nhap">Đăng nhập</Link></p>
    </>
  );
}
