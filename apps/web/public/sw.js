/* Service worker Sân 7 (ARCHITECTURE D10, BRD 9.4):
 * - cài lên màn hình chính, xem trang/dữ liệu lần cuối khi mất mạng (network-first, rơi về cache)
 * - Web Push: hiển thị thông báo, nút Đi/Nghỉ gọi thẳng API điểm danh. */
const CACHE = 'san7-v2';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE_URL, '/icon.svg', '/manifest.webmanifest'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/jobs') || url.pathname.startsWith('/api/uploads')) return;
  // tài nguyên tĩnh có hash: cache-first
  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => (cachePut(req, res.clone()), res))));
    return;
  }
  // trang & GET API: network-first, lưu bản mới, mất mạng thì dùng bản lần cuối
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && (req.mode === 'navigate' || url.pathname.startsWith('/api/') || req.headers.get('RSC'))) cachePut(req, res.clone());
        return res;
      })
      .catch(async () => (await caches.match(req)) || (req.mode === 'navigate' ? caches.match(OFFLINE_URL) : Response.error())),
  );
});

function cachePut(req, res) {
  caches.open(CACHE).then((c) => c.put(req, res)).catch(() => {});
}

self.addEventListener('push', (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = { body: e.data && e.data.text() };
  }
  e.waitUntil(
    self.registration.showNotification(d.title || 'Đom Đóm FC', {
      body: d.body || '',
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: d.matchId ? `${d.kind}-${d.matchId}` : undefined,
      data: d,
      actions: d.actions || [],
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  const d = e.notification.data || {};
  e.notification.close();
  const open = (path) =>
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
      const c = cs.find((x) => new URL(x.url).origin === location.origin);
      if (c) return c.navigate(path).then((w) => w && w.focus());
      return self.clients.openWindow(path);
    });
  const base = d.teamId ? `/t/${d.teamId}` : '/';
  const target = d.matchId ? `${base}/lich?tran=${d.matchId}&tab=${d.kind === 'vote' ? 'att' : 'res'}` : d.view ? `${base}/${d.view}` : base;
  if ((e.action === 'di' || e.action === 'nghi') && d.teamId && d.matchId) {
    e.waitUntil(
      fetch(`/api/me/player?teamId=${encodeURIComponent(d.teamId)}`, { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((me) =>
          me && me.playerId
            ? fetch(`/api/matches/${d.matchId}/attendance/${me.playerId}`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: e.action }),
              })
            : null,
        )
        .then((r) =>
          self.registration.showNotification(r && r.ok ? 'Đã điểm danh' : 'Chưa điểm danh được', {
            body: r && r.ok ? (e.action === 'di' ? 'Bạn ĐI trận này' : 'Bạn NGHỈ trận này') : 'Mở app để điểm danh',
            icon: '/icon.svg',
            tag: `att-${d.matchId}`,
          }),
        )
        .catch(() => open(target)),
    );
    return;
  }
  e.waitUntil(open(target));
});
