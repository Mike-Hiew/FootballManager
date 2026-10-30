'use client';

import Link from 'next/link';
import { use, useState, useTransition } from 'react';
import { resetAction } from '@/app/actions';
import { AuthShell } from '@/components/AuthShell';

export default function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <AuthShell>
      <h2>Đặt lại mật khẩu</h2>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          if (f.get('pw') !== f.get('pw2')) return setMsg({ ok: false, text: 'Mật khẩu nhập lại không khớp' });
          start(async () => {
            const r = await resetAction(token, String(f.get('pw')));
            setMsg(r.ok ? { ok: true, text: 'Đã đặt lại mật khẩu. Hãy đăng nhập lại.' } : { ok: false, text: r.error });
          });
        }}
      >
        <div className="field"><label htmlFor="pw">Mật khẩu mới</label><input id="pw" name="pw" type="password" minLength={8} required autoComplete="new-password" /></div>
        <div className="field"><label htmlFor="pw2">Nhập lại</label><input id="pw2" name="pw2" type="password" required autoComplete="new-password" /></div>
        {msg && <div className={msg.ok ? 'ok-msg' : 'err'} role="status">{msg.text}</div>}
        <button className="btn primary" type="submit" disabled={pending}>Đặt lại</button>
      </form>
      <p style={{ margin: 0, fontSize: 13 }}><Link className="linkbtn" href="/dang-nhap">Về đăng nhập</Link></p>
    </AuthShell>
  );
}
