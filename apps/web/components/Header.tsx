'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import type { MyTeam, Role } from '@/lib/types';
import { logoutAction, notificationsAction, readAllAction, readOneAction, selectTeamAction, setAttendanceAction } from '@/app/actions';
import { TeamCrest } from './TeamCrest';
import { Avatar } from './ui';
import { Bell, TAB_ICONS } from './Icons';

const TAB_LABEL: Record<string, string> = {
  doi: 'Đội', toi: 'Của tôi', 'chien-thuat': 'Chiến thuật', 'cau-thu': 'Cầu thủ', lich: 'Lịch đấu', 'thong-ke': 'Thống kê',
  quy: 'Quỹ đội', duyet: 'Duyệt', 'kham-pha': 'Khám phá', 'he-thong': 'Hệ thống',
};
const ROLE_LABEL: Record<Role, [string, string]> = { admin: ['Admin', 'admin'], captain: ['Đội trưởng', 'cap'], member: ['Thành viên', ''], guest: ['Khách', ''] };

interface Props {
  team: { id: string; name: string; photoUrl: string | null } | null;
  role: Role | null;
  tabs: string[];
  approvalCount: number;
  me: { id: string; name: string; isAdmin: boolean };
  myTeams: MyTeam[];
  initialUnread: number;
}

type Notif = { id: string; kind: string; text: string; teamId: string | null; teamName: string | null; matchId: string | null; view: string | null; read: boolean; at: string };

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'vừa xong';
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  return `${Math.floor(s / 86400)} ngày trước`;
}

export function Header({ team, role, tabs, approvalCount, me, myTeams, initialUnread }: Props) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[] | null>(null);
  const [unread, setUnread] = useState(initialUnread);
  const [, start] = useTransition();
  const panel = useRef<HTMLDivElement>(null);
  const roleL = role ? ROLE_LABEL[role] : null;

  const load = () =>
    start(async () => {
      const r = await notificationsAction();
      if (r.ok) {
        setItems(r.data.items);
        setUnread(r.data.unread);
      }
    });

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!e.composedPath().some((el) => (el as HTMLElement).id === 'npanel' || (el as HTMLElement).id === 'bellBtn')) setOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);

  const active = (v: string) => path.endsWith('/' + v) || (v === 'chien-thuat' && path.endsWith('/tran-toi'));
  const href = (v: string) => (v === 'kham-pha' ? '/kham-pha' : v === 'he-thong' ? '/he-thong' : `/t/${team?.id}/${v}`);

  const openNotif = (n: Notif) =>
    start(async () => {
      if (!n.read) await readOneAction(n.id);
      setOpen(false);
      if (!n.teamId) return;
      const base = `/t/${n.teamId}`;
      if (n.matchId) router.push(`${base}/lich?tran=${n.matchId}&tab=${n.kind === 'vote' ? 'att' : n.kind === 'claim' && n.view === 'duyet' ? 'res' : n.kind === 'mvp' || n.kind === 'result' ? 'res' : 'att'}`);
      else router.push(`${base}/${n.view || 'doi'}`);
    });

  return (
    <>
    <header className="top">
      <div className="brand">
        {team ? <TeamCrest name={team.name} photoUrl={team.photoUrl} /> : <TeamCrest name="San7" />}
        <div style={{ minWidth: 0 }}>
          <h1><span className="tname">{team?.name ?? process.env.NEXT_PUBLIC_APP_NAME ?? 'Đom Đóm FC'}</span></h1>
        </div>
      </div>
      <div className="userbar">
        {myTeams.length > 1 && (
          <select
            aria-label="Chọn đội"
            value={team && myTeams.some((t) => t.id === team.id) ? team.id : ''}
            onChange={(e) => start(async () => {
              await selectTeamAction(e.target.value);
              router.push(`/t/${e.target.value}/doi`);
            })}
          >
            {!team || !myTeams.some((t) => t.id === team.id) ? <option value="">Chọn đội…</option> : null}
            {myTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
        <button
          type="button"
          className="ubtn"
          id="bellBtn"
          aria-label={`Thông báo${unread ? `, ${unread} chưa đọc` : ''}`}
          aria-expanded={open}
          onClick={() => {
            setOpen((o) => !o);
            if (!open) load();
          }}
        >
          <Bell />
          {unread > 0 && <span className="bdg">{unread}</span>}
        </button>
        <span className="me-chip">
          <Avatar p={{ id: me.id, nick: me.name }} size={30} />
          <span>
            <b>{me.name}</b>
            {roleL && <span className={`role ${roleL[1]}`}>{roleL[0]}</span>}
          </span>
        </span>
        <button type="button" className="btn ghost sm" onClick={() => logoutAction()}>Đăng xuất</button>
      </div>
      <nav className="tabs" aria-label="Chức năng">
        {tabs.map((v) => (
          <Link key={v} href={href(v)} aria-current={active(v) ? 'page' : undefined} prefetch={false}>
            {TAB_ICONS[v]}
            {TAB_LABEL[v]}
            {v === 'duyet' && approvalCount > 0 && <span className="nb">{approvalCount}</span>}
          </Link>
        ))}
      </nav>
    </header>
      <div className="npanel" id="npanel" ref={panel} hidden={!open}>
        <div className="nhead">
          <b>Thông báo</b>
          {items?.some((n) => !n.read) && (
            <button type="button" className="linkbtn" onClick={() => start(async () => {
              await readAllAction();
              setItems((x) => x?.map((n) => ({ ...n, read: true })) ?? null);
              setUnread(0);
            })}>Đánh dấu đã đọc hết</button>
          )}
        </div>
        {items === null ? (
          <div className="empty-list">Đang tải…</div>
        ) : items.length ? (
          items.map((n) => (
            <div key={n.id} className={`nitem${n.read ? '' : ' unread'}`} role="button" tabIndex={0} onClick={() => openNotif(n)} onKeyDown={(e) => e.key === 'Enter' && openNotif(n)}>
              <span>{n.text}</span>
              <small>{n.teamName ? n.teamName + ' · ' : ''}{ago(n.at)}</small>
              {n.kind === 'vote' && n.matchId && n.teamId && !n.text.startsWith('Nhắc') && (
                <QuickVote teamId={n.teamId} matchId={n.matchId} onDone={load} />
              )}
            </div>
          ))
        ) : (
          <div className="empty-list">Chưa có thông báo.</div>
        )}
      </div>
    </>
  );
}

/** Nút Đi/Nghỉ ngay trong thông báo (BRD 6.3). */
function QuickVote({ teamId, matchId, onDone }: { teamId: string; matchId: string; onDone: () => void }) {
  const [msg, setMsg] = useState('');
  const [, start] = useTransition();
  const vote = (s: 'di' | 'nghi') => (e: React.MouseEvent) => {
    e.stopPropagation();
    start(async () => {
      const me = await fetch(`/api/me/player?teamId=${teamId}`).then((r) => (r.ok ? r.json() : null));
      if (!me?.playerId) return setMsg('Không tìm thấy hồ sơ của bạn');
      const r = await setAttendanceAction(teamId, matchId, me.playerId, s);
      setMsg(r.ok ? (s === 'di' ? 'Đã vote Đi' : 'Đã vote Nghỉ') : r.error);
      onDone();
    });
  };
  return (
    <span className="qa">
      <button type="button" className="btn sm" onClick={vote('di')}>Đi</button>
      <button type="button" className="btn sm" onClick={vote('nghi')}>Nghỉ</button>
      {msg && <small>{msg}</small>}
    </span>
  );
}
