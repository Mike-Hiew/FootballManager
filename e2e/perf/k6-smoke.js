/**
 * k6 smoke (BRD 9.4: API p95 < 300 ms; go-live checklist: 20 req/s).
 *
 *   k6 run e2e/perf/k6-smoke.js                                  # http://localhost:3000, dữ liệu demo
 *   BASE_URL=https://staging.example.com k6 run e2e/perf/k6-smoke.js
 *
 * Đăng nhập một lần ở setup (tài khoản ĐT demo, đổi bằng LOGIN_ID/LOGIN_PW), sau đó bắn đều
 * 20 request/giây vào các API đọc mà màn Đội, Lịch, Cầu thủ, Quỹ, Thống kê, Trận tới gọi.
 */
import http from 'k6/http';
import { check, fail } from 'k6';

const BASE = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const TEAM = __ENV.TEAM_ID || 't-domdom';
const RATE = Number(__ENV.RATE || 20);
const DURATION = __ENV.DURATION || '1m';

export const options = {
  scenarios: {
    smoke: { executor: 'constant-arrival-rate', rate: RATE, timeUnit: '1s', duration: DURATION, preAllocatedVUs: 20, maxVUs: 60 },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{kind:api}': ['p(95)<300'],
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'max'],
};

export function setup() {
  const res = http.post(`${BASE}/api/auth/login`, JSON.stringify({ identifier: __ENV.LOGIN_ID || '0901000002', password: __ENV.LOGIN_PW || '123456' }), {
    headers: { 'Content-Type': 'application/json', Origin: BASE },
  });
  if (res.status !== 200) fail(`Đăng nhập thất bại: ${res.status} ${res.body}`);
  const cookie = res.cookies.san7_session?.[0]?.value;
  if (!cookie) fail('Không nhận được cookie phiên');
  const ms = http.get(`${BASE}/api/teams/${TEAM}/matches`, { headers: { Cookie: `san7_session=${cookie}` } }).json('matches') || [];
  const next = ms.find((m) => m.scoreUs == null) || ms[0];
  return { cookie, matchId: next ? next.id : null };
}

export default function (data) {
  const paths = [
    `/api/teams/${TEAM}/dashboard`,
    `/api/teams/${TEAM}`,
    `/api/teams/${TEAM}/matches`,
    `/api/teams/${TEAM}/players`,
    `/api/teams/${TEAM}/fund`,
    `/api/teams/${TEAM}/season`,
    `/api/me/season?teamId=${TEAM}`,
    '/api/notifications',
    ...(data.matchId ? [`/api/matches/${data.matchId}/plan`] : []),
  ];
  const path = paths[Math.floor(Math.random() * paths.length)];
  const res = http.get(`${BASE}${path}`, {
    headers: { Cookie: `san7_session=${data.cookie}` },
    tags: { kind: 'api', name: path.replace(/[?].*$/, '').replace(data.matchId || '#', ':match') },
  });
  check(res, { '200': (r) => r.status === 200 });
}
