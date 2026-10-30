import { timingSafeEqual } from 'node:crypto';
import { after, type NextRequest } from 'next/server';
import { tick } from '@/server/jobs/tick';
import { handle, json } from '@/server/http';
import { now } from '@/server/clock';

export const maxDuration = 30;

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!secret || got.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(secret));
}

/** Job tick mỗi 5 phút do scheduler ngoài gọi, ký bằng CRON_SECRET (ARCHITECTURE ADR-07). */
async function run(req: NextRequest) {
  return handle(async () => {
    if (!authorized(req)) return json({ error: 'Unauthorized' }, 401);
    const at = now();
    const result = await tick(at);
    after(() => console.info(JSON.stringify({ job: 'tick', at: at.toISOString(), ...result })));
    return { at: at.toISOString(), ...result };
  });
}

export { run as POST, run as GET };
