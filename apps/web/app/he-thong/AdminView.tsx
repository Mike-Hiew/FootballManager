'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { adminTeamAction, adminTransferAction, adminUserAction } from '@/app/actions';
import type { adminOverview } from '@/server/services/admin';

type Data = Awaited<ReturnType<typeof adminOverview>>;

const ROLE: Record<string, [string, string]> = { admin: ['Admin', 'admin'], cap: ['Đội trưởng', 'cap'], member: ['Thành viên', ''], pending: ['Chờ duyệt', ''] };

/** Tab Hệ thống (BRD 8.7) — bố cục như prototype, thêm thao tác khoá/đặt lại mật khẩu/chuyển ĐT/ẩn đội. */
export function AdminView({ data, meId }: { data: Data; meId: string }) {
  const [msg, setMsg] = useState('');
  const [, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>, ok: string | ((d: unknown) => string)) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? (typeof ok === 'function' ? ok(r.data) : ok) : (r as { error: string }).error);
    });
  return (
    <section className="view">
      <div style={{ display: 'grid', gap: 16 }}>
        <h2 className="vt">Hệ thống</h2>
        {msg && <div className="note" role="status">{msg}</div>}
        <div className="tiles">
          <div className="tile hl"><div className="k">Đội bóng</div><div className="v">{data.stats.teams}</div></div>
          <div className="tile"><div className="k">Tài khoản</div><div className="v">{data.stats.users}</div></div>
          <div className="tile"><div className="k">Trận tuần này</div><div className="v">{data.stats.weekMatches}</div></div>
          <div className="tile"><div className="k">Đơn chờ duyệt</div><div className="v">{data.stats.pending}</div></div>
        </div>
        <div className="panel">
          <h3 className="st">Đội bóng</h3>
          <div className="twrap">
            <table className="tbl">
              <thead><tr><th /><th>Đội</th><th>Đội trưởng</th><th>Thành viên</th><th>Trận</th><th>Mã mời</th><th /></tr></thead>
              <tbody>
                {data.teams.map((t, i) => (
                  <tr key={t.id}>
                    <td>{i + 1}</td>
                    <td>{t.name}{t.hidden && <> <span className="chip loss">Đã ẩn</span></>}</td>
                    <td>{t.captains.map((c) => c.name).join(', ') || <span className="warn">Chưa có</span>}</td>
                    <td>{t.members}{t.pending > 0 && <> <span className="chip le">+{t.pending} chờ</span></>}</td>
                    <td>{t.matches}</td>
                    <td>{t.inviteCode && <code>{t.inviteCode}</code>}</td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }} className="adm-acts">
                      <Link className="btn sm" href={`/t/${t.id}/doi`}>Quản lý</Link>
                      <button type="button" className="linkbtn" onClick={() => {
                        const u = prompt('Nhập SĐT thành viên sẽ làm đội trưởng mới:');
                        const target = u && data.users.find((x) => x.phone === u.replace(/\D/g, '').replace(/^84/, '0'));
                        if (u && !target) return setMsg('Không tìm thấy người dùng với SĐT này');
                        if (target) run(() => adminTransferAction(t.id, target.id), `Đã chuyển đội trưởng ${t.name} cho ${target.name}`);
                      }}>Chuyển ĐT</button>
                      <button type="button" className="linkbtn" style={{ color: 'var(--bad)' }} onClick={() => run(() => adminTeamAction(t.id, t.hidden ? 'show' : 'hide'), t.hidden ? 'Đã hiện đội' : 'Đã ẩn đội')}>{t.hidden ? 'Hiện' : 'Ẩn'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="panel">
          <h3 className="st">Tài khoản</h3>
          <div className="twrap">
            <table className="tbl">
              <thead><tr><th /><th>Tên</th><th>SĐT</th><th>Email</th><th>Vai trò</th><th /></tr></thead>
              <tbody>
                {data.users.map((u, i) => (
                  <tr key={u.id}>
                    <td>{i + 1}</td>
                    <td>{u.name}{u.disabled && <> <span className="chip loss">Đã khoá</span></>}</td>
                    <td>{u.phone}</td>
                    <td>{u.email ?? ''}</td>
                    <td style={{ whiteSpace: 'normal', textAlign: 'left' }}>
                      {u.roles.map((r, k) => <span key={k}>{k ? ' ' : ''}<span className={`role ${ROLE[r.kind][1]}`}>{ROLE[r.kind][0]}{r.team ? ' ' + r.team : ''}</span></span>)}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }} className="adm-acts">
                      {u.id !== meId && (
                        <>
                          <button type="button" className="linkbtn" onClick={() => run(() => adminUserAction(u.id, u.disabled ? 'unlock' : 'lock'), u.disabled ? 'Đã mở khoá' : 'Đã khoá tài khoản')}>{u.disabled ? 'Mở khoá' : 'Khoá'}</button>
                          <button type="button" className="linkbtn" onClick={() => confirm(`Đặt lại mật khẩu cho ${u.name}?`) && run(() => adminUserAction(u.id, 'reset'), (p) => `Mật khẩu tạm của ${u.name}: ${p} — gửi riêng cho người dùng.`)}>Đặt lại MK</button>
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
