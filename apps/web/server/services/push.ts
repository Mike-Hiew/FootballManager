import webpush from 'web-push';
import { prisma } from '@san7/db';

let configured: boolean | null = null;
function setup(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  configured = !!(pub && priv);
  if (configured) webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', pub!, priv!);
  return configured;
}

export async function saveSubscription(userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  });
}

/**
 * Đẩy Web Push cho thông báo chưa đẩy (outbox). Cập nhật có điều kiện để hai lần chạy
 * chồng nhau không gửi trùng; 404/410 → xoá subscription (ARCHITECTURE 6.3).
 */
export async function dispatchOutbox(limit = 200): Promise<number> {
  const pending = await prisma.notification.findMany({ where: { pushedAt: null }, orderBy: { createdAt: 'asc' }, take: limit });
  if (!pending.length) return 0;
  const enabled = setup();
  let sent = 0;
  for (const n of pending) {
    const claimed = await prisma.notification.updateMany({ where: { id: n.id, pushedAt: null }, data: { pushedAt: new Date() } });
    if (!claimed.count || !enabled) continue;
    const subs = await prisma.pushSubscription.findMany({ where: { userId: n.userId } });
    const payload = JSON.stringify({
      title: 'Sân 7', body: n.text, teamId: n.teamId, matchId: n.matchId, view: n.view, kind: n.kind,
      actions: n.kind === 'vote' && n.matchId && !n.text.startsWith('Nhắc') ? [{ action: 'di', title: 'Đi' }, { action: 'nghi', title: 'Nghỉ' }] : [],
    });
    for (const s of subs) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
      }
    }
  }
  return sent;
}
