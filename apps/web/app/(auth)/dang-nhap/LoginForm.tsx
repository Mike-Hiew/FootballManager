'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { loginAction } from '@/app/actions';

export function LoginForm({ demo, next }: { demo: Array<{ label: string; sub: string; id: string; pw: string }>; next?: string }) {
  const router = useRouter();
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();
  const go = (id: string, pw: string) =>
    start(async () => {
      setErr('');
      const r = await loginAction(id, pw);
      if (!r.ok) setErr(r.error);
      else router.replace(next ?? '/');
    });
  return (
    <>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          go(String(f.get('id') ?? ''), String(f.get('pw') ?? ''));
        }}
      >
        <div className="field">
          <label htmlFor="lId">Số điện thoại hoặc email</label>
          <input id="lId" name="id" autoComplete="username" required />
        </div>
        <div className="field">
          <label htmlFor="lPw">Mật khẩu</label>
          <input id="lPw" name="pw" type="password" autoComplete="current-password" required />
        </div>
        <div className="err" role="alert">{err}</div>
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
      </form>
      <p style={{ margin: 0, fontSize: 13 }}>
        Bạn là đội trưởng muốn lập đội? <Link className="linkbtn" href="/dang-ky">Đăng ký và tạo đội</Link>
        {' · '}
        <Link className="linkbtn" href="/quen-mat-khau">Quên mật khẩu</Link>
      </p>
      {demo.length > 0 && (
        <div>
          <div className="sec-title" style={{ marginBottom: 6 }}>Tài khoản demo · bấm để đăng nhập</div>
          <div className="demo">
            {demo.map((d) => (
              <button key={d.id} type="button" onClick={() => go(d.id, d.pw)} disabled={pending}>
                <b>{d.label}</b>
                {d.sub}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
