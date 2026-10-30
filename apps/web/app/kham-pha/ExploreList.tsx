'use client';

import Link from 'next/link';
import { useState } from 'react';
import { foldText } from '@san7/core';
import { TeamCrest } from '@/components/TeamCrest';

interface T { id: string; name: string; slogan: string | null; photoUrl: string | null; homeName: string | null; members: number; record: { w: number; d: number; l: number }; form: string[] }

/** Lưới thẻ đội, tìm theo tên bỏ dấu (BRD 8.5). */
export function ExploreList({ teams }: { teams: T[] }) {
  const [q, setQ] = useState('');
  const f = foldText(q);
  const list = f ? teams.filter((t) => foldText(t.name).includes(f)) : teams;
  return (
    <>
      <input type="search" placeholder="Tìm đội theo tên" aria-label="Tìm đội" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 320 }} />
      <div className="exlist">
        {list.length ? list.map((t) => (
          <div key={t.id} className="excard panel">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <TeamCrest name={t.name} photoUrl={t.photoUrl} size={52} />
              <div style={{ minWidth: 0 }}>
                <b style={{ fontFamily: 'var(--f-display)', fontSize: 18 }}>{t.name}</b>
                {t.slogan && <div className="muted" style={{ fontSize: 12.5 }}>{t.slogan}</div>}
              </div>
            </div>
            <div className="muted" style={{ fontSize: 12.5, margin: '8px 0' }}>
              {t.members} thành viên{t.homeName ? ` · ${t.homeName}` : ''} · Mùa này {t.record.w}T-{t.record.d}H-{t.record.l}B
            </div>
            <div className="row-actions" style={{ justifyContent: 'space-between' }}>
              <div className="form5">{t.form.length ? t.form.map((r, i) => <span key={i} className={`fp ${r}`}>{r}</span>) : <span className="muted" style={{ fontSize: 12 }}>Chưa đá trận nào</span>}</div>
              <Link className="btn sm" href={`/t/${t.id}/doi`}>Xem</Link>
            </div>
          </div>
        )) : <div className="empty-list">Không tìm thấy đội nào.</div>}
      </div>
    </>
  );
}
