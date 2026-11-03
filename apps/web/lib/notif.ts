/** Đường dẫn khi bấm một thông báo (chuông, popup lời nhắc). */
export function notifHref(n: { teamId: string | null; matchId: string | null; view: string | null; kind: string }): string | null {
  if (!n.teamId) return null;
  const base = `/t/${n.teamId}`;
  if (n.matchId) {
    const tab = n.kind === 'vote' ? 'att' : n.kind === 'claim' && n.view === 'duyet' ? 'res' : n.kind === 'mvp' || n.kind === 'result' ? 'res' : 'att';
    return `${base}/lich?tran=${n.matchId}&tab=${tab}`;
  }
  return `${base}/${n.view || 'doi'}`;
}

/** "vừa xong", "5 phút trước", "3 giờ trước", "2 ngày trước". */
export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'vừa xong';
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  return `${Math.floor(s / 86400)} ngày trước`;
}
