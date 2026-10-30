'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { adminTeamAction, adminTransferAction, adminUserAction } from '@/app/actions';
import type { adminOverview } from '@/server/services/admin';

type Data = Awaited<ReturnType<typeof adminOverview>>;

/** Tab Hệ thống (BRD 8.7). */
export function AdminView({ data, meId }: { data: Data; meId: string }) {
  const [msg, setMsg] = useState('');
  const [, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>, ok: string | ((d: unknown) => string)) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? (typeof ok === 'function' ? ok(r.data) : ok) : (r as { error: string }).error);
    });
  const d = (iso: string) => new Date(iso).toLocaleDateString('vi-VN');
  return (
    <section className="view">
      <div style={{ display: 'grid', gap: 16 }}>
        <h2 className="vt">Hệ thống</h2>
        {msg && <div className="note" role="status">{msg}</div>}
        <div className="tiles">
          <div className="tile hl"><div className="k">Người dùng</div><div className="v">{data.stats.users}</div></div>
          <div className="tile"><div className="k">Đội</div><div className="v">{data.stats.teams}</div></div>
          <div className="tile"><div className="k">Trận tuần này</div><div className="v">{data.stats.weekMatches}</div></div>
        </div>
        <div className="panel">
          <h3 className="st">Đội bóng</h3>
          <div className="twrap">
            <table className="tbl">
              <thead><tr><th>Tên</th><th>Đội trưởng</th><th>Thành viên</th><th>Trận</th><th>Ngày tạo</th><th /></tr></thead>
              <tbody>
                {data.teams.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}{t.hidden && <> <span className="chip loss">Đã ẩn</span></>}</td>
                    <td>{t.captains.map((c) => c.name).join(', ') || '–'}</td>
                    <td>{t.members}</td>
                    <td>{t.matches}</td>
                    <td>{d(t.createdAt)}</td>
                    <td className="row-actions">
                      <Link className="btn sm" href={`/t/${t.id}/doi`}>Vào đội</Link>
                      <button type="button" className="btn ghost sm" onClick={() => {
                        const u = prompt('Nhập SĐT thành viên sẽ làm đội trưởng mới:');
                        const target = u && data.users.find((x) => x.phone === u.replace(/\D/g, '').replace(/^84/, '0'));
                        if (u && !target) return setMsg('Không tìm thấy người dùng với SĐT này');
                        if (target) run(() => adminTransferAction(t.id, target.id), `Đã chuyển đội trưởng ${t.name} cho ${target.name}`);
                      }}>Chuyển ĐT</button>
                      <button type="button" className="btn ghost sm danger" onClick={() => run(() => adminTeamAction(t.id, t.hidden ? 'show' : 'hide'), t.hidden ? 'Đã hiện đội' : 'Đã ẩn đội')}>{t.hidden ? 'Hiện' : 'Ẩn đội'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="panel">
          <h3 className="st">Người dùng</h3>
          <div className="twrap">
            <table className="tbl">
              <thead><tr><th>Tên</th><th>SĐT</th><th>Email</th><th>Vai trò</th><th>Các đội</th><th>Ngày tạo</th><th /></tr></thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}{u.disabled && <> <span className="chip loss">Đã khoá</span></>}</td>
                    <td>{u.phone}</td>
                    <td>{u.email ?? '–'}</td>
                    <td>{u.role === 'admin' ? 'Admin' : 'Người dùng'}</td>
                    <td style={{ whiteSpace: 'normal' }}>{u.teams.join(', ') || '–'}</td>
                    <td>{d(u.createdAt)}</td>
                    <td className="row-actions">
                      {u.id !== meId && (
                        <>
                          <button type="button" className="btn ghost sm" onClick={() => run(() => adminUserAction(u.id, u.disabled ? 'unlock' : 'lock'), u.disabled ? 'Đã mở khoá' : 'Đã khoá tài khoản')}>{u.disabled ? 'Mở khoá' : 'Khoá'}</button>
                          <button type="button" className="btn ghost sm" onClick={() => confirm(`Đặt lại mật khẩu cho ${u.name}?`) && run(() => adminUserAction(u.id, 'reset'), (p) => `Mật khẩu tạm của ${u.name}: ${p} — gửi riêng cho người dùng.`)}>Đặt lại mật khẩu</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
