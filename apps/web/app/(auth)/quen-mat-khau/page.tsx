'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { forgotAction } from '@/app/actions';
import { AuthShell } from '@/components/AuthShell';

export default function ForgotPage() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string; link?: string | null } | null>(null);
  const [pending, start] = useTransition();
  return (
    <AuthShell>
      <h2>Quên mật khẩu</h2>
      <p className="hint" style={{ margin: 0 }}>Nhập email tài khoản. Hệ thống gửi link đặt lại mật khẩu, hiệu lực 1 giờ.</p>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const email = String(new FormData(e.currentTarget).get('email') ?? '');
          start(async () => {
            const r = await forgotAction(email);
            setMsg(r.ok ? { ok: true, text: 'Nếu email có tài khoản, link đặt lại đã được gửi.', link: r.data.link } : { ok: false, text: r.error });
          });
        }}
      >
        <div className="field"><label htmlFor="fEmail">Email</label><input id="fEmail" name="email" type="email" required autoComplete="email" /></div>
        {msg && <div className={msg.ok ? 'ok-msg' : 'err'} role="status">{msg.text}</div>}
        {msg?.link && <p className="hint" style={{ margin: 0 }}>Môi trường thử: <Link className="linkbtn" href={msg.link.replace(/^https?:\/\/[^/]+/, '')}>mở link đặt lại</Link></p>}
        <button className="btn primary" type="submit" disabled={pending}>Gửi link đặt lại</button>
      </form>
      <p style={{ margin: 0, fontSize: 13 }}><Link className="linkbtn" href="/dang-nhap">Về đăng nhập</Link></p>
    </AuthShell>
  );
}
