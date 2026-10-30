'use client';
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { useState } from 'react';
import { foldText } from '@san7/core';
import type { Role } from '@/lib/types';

interface T { id: string; name: string; slogan: string | null; photoUrl: string | null; homeName: string | null; founded: number | null; members: number; record: { w: number; d: number; l: number }; form: string[] }

const initials2 = (name: string) => name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

/** Khám phá (BRD 8.5) — thẻ đội theo markup prototype; thêm ô tìm bỏ dấu và chuỗi 5 trận theo BRD. */
export function ExploreList({ teams, mine, current }: { teams: T[]; mine: Array<{ id: string; role: Role }>; current: string | null }) {
  const [q, setQ] = useState('');
  const f = foldText(q);
  const list = f ? teams.filter((t) => foldText(t.name).includes(f)) : teams;
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="view-head">
        <div>
          <h2 className="vt">Các đội trên hệ thống</h2>
          <p className="hint" style={{ margin: '4px 0 0' }}>Đội nào cũng xem được lịch sử trận, thành viên và chỉ số của các đội khác.</p>
        </div>
        <input type="search" className="mini" placeholder="Tìm đội" aria-label="Tìm đội theo tên" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="exlist">
        {list.length ? list.map((t) => {
          const m = mine.find((x) => x.id === t.id);
          const cur = t.id === current;
          return (
            <div key={t.id} className="excard">
              <div className="top2">
                <span className="crest2" style={{ width: 46, height: 46 }}>{t.photoUrl ? <img src={t.photoUrl} alt="" /> : initials2(t.name)}</span>
                <div style={{ minWidth: 0 }}>
                  <b>{t.name}</b>
                  <div className="muted" style={{ fontSize: 12 }}>{t.founded ? `Thành lập ${t.founded}` : ''}{t.homeName ? `${t.founded ? ' · ' : ''}${t.homeName}` : ''}</div>
                </div>
              </div>
              <div className="facts">
                <div><b>{t.members}</b><span>thành viên</span></div>
                <div><b>{t.record.w}-{t.record.d}-{t.record.l}</b><span>thắng-hoà-thua</span></div>
              </div>
              <div className="row-actions">
                {cur ? <span className="chip quy">Đội đang mở</span> : m ? <Link className="btn primary sm" href={`/t/${t.id}/doi`}>{m.role === 'admin' ? 'Quản lý' : 'Vào đội của tôi'}</Link> : <Link className="btn sm" href={`/t/${t.id}/doi`}>Xem đội</Link>}
                {t.form.length > 0 && (
                  <span className="form5 sm" style={{ marginLeft: 'auto' }} aria-label={`5 trận gần nhất: ${t.form.join(' ')}`}>
                    {t.form.map((r, i) => <span key={i} className={`fp ${r}`}>{r}</span>)}
                  </span>
                )}
              </div>
            </div>
          );
        }) : <div className="empty-list">Không tìm thấy đội nào.</div>}
      </div>
    </div>
  );
}
