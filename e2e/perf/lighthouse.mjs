/**
 * Lighthouse (mobile, Slow 4G mô phỏng + CPU chậm 4×, cấu hình mặc định của Lighthouse) cho các màn chính.
 * BRD 9.4: trang Đội LCP < 1.5 s trên 4G — vượt ngân sách thì thoát mã 1.
 *
 *   pnpm --filter @san7/e2e lighthouse                       # http://localhost:3000, dữ liệu demo
 *   BASE_URL=https://staging.example.com pnpm --filter @san7/e2e lighthouse
 *
 * Biến: LOGIN_ID/LOGIN_PW (mặc định ĐT demo), TEAM_ID, LCP_BUDGET (ms, mặc định 1500), RUNS (mặc định 3, lấy trung vị).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { chromium } from '@playwright/test';

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const TEAM = process.env.TEAM_ID || 't-domdom';
const BUDGET = Number(process.env.LCP_BUDGET || 1500);
const RUNS = Number(process.env.RUNS || 3);
const OUT = new URL('../perf-report/', import.meta.url).pathname;

const PAGES = [
  { name: 'Đăng nhập', path: '/dang-nhap', auth: false },
  { name: 'Đội', path: `/t/${TEAM}/doi`, auth: true, budget: true },
  { name: 'Lịch', path: `/t/${TEAM}/lich`, auth: true },
  { name: 'Chiến thuật', path: `/t/${TEAM}/chien-thuat`, auth: true },
];

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE },
    body: JSON.stringify({ identifier: process.env.LOGIN_ID || '0901000002', password: process.env.LOGIN_PW || '123456' }),
  });
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith('san7_session='));
  if (!res.ok || !cookie) throw new Error(`Đăng nhập thất bại: ${res.status} ${await res.text()}`);
  return cookie.split(';')[0];
}

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const cookie = await login();
const chrome = await chromeLauncher.launch({
  chromePath: process.env.CHROME_PATH || chromium.executablePath(),
  chromeFlags: ['--headless=new', '--no-sandbox'],
});
mkdirSync(OUT, { recursive: true });
const rows = [];
try {
  for (const p of PAGES) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) {
      const r = await lighthouse(`${BASE}${p.path}`, {
        port: chrome.port,
        output: 'html',
        onlyCategories: ['performance'],
        extraHeaders: p.auth ? { Cookie: cookie } : undefined,
      });
      const a = r.lhr.audits;
      if (r.lhr.finalDisplayedUrl.includes('/dang-nhap') && p.auth) throw new Error(`${p.path} chuyển về trang đăng nhập — cookie không hợp lệ`);
      runs.push({ score: r.lhr.categories.performance.score * 100, lcp: a['largest-contentful-paint'].numericValue, fcp: a['first-contentful-paint'].numericValue, tbt: a['total-blocking-time'].numericValue, cls: a['cumulative-layout-shift'].numericValue, html: r.report });
    }
    const best = runs.find((x) => x.lcp === median(runs.map((y) => y.lcp)));
    writeFileSync(`${OUT}${p.path.split('/').pop()}.html`, best.html);
    rows.push({ page: p.name, path: p.path, score: Math.round(median(runs.map((x) => x.score))), lcp: Math.round(best.lcp), fcp: Math.round(median(runs.map((x) => x.fcp))), tbt: Math.round(median(runs.map((x) => x.tbt))), cls: +median(runs.map((x) => x.cls)).toFixed(3), budget: p.budget ? BUDGET : null });
  }
} finally {
  await chrome.kill();
}

console.table(rows.map(({ budget, ...r }) => ({ ...r, 'LCP ≤': budget ?? '' })));
writeFileSync(`${OUT}results.json`, JSON.stringify(rows, null, 2));
const over = rows.filter((r) => r.budget && r.lcp > r.budget);
if (over.length) {
  console.error(`LCP vượt ngân sách: ${over.map((r) => `${r.page} ${r.lcp} ms > ${r.budget} ms`).join(', ')}`);
  process.exit(1);
}
