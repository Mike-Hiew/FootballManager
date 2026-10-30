/**
 * So ảnh chụp app với prototype `docs/prototype/domdom-fc.html` (BRD 11.1 #15) ở 1920/1440/1024/390 px.
 * Hai bên dùng cùng bộ dữ liệu demo (seed port từ prototype), cùng giờ cố định, tắt chuyển động.
 * Ảnh hai bên chụp trong cùng lần chạy nên không cần ảnh mốc (baseline) commit vào repo.
 * Báo cáo: e2e/visual-report/index.html
 */
import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import { diff, record } from './compare';

const PROTO = 'file://' + new URL('../../docs/prototype/domdom-fc.html', import.meta.url).pathname;
const WIDTHS = [1920, 1440, 1024, 390] as const;
// Giờ cố định trong ngày seed (đầu giờ hiện tại) để đồng hồ đếm ngược, "hôm nay" hai bên trùng nhau.
const NOW = new Date(Math.floor(Date.now() / 3600e3) * 3600e3);

type Who = 'captain' | 'admin';
interface View { name: string; proto: string; app: string; who?: Who; budget?: Partial<Record<(typeof WIDTHS)[number], number>>; prep?: (p: Page, side: 'proto' | 'app') => Promise<void> }
// Modal là lớp position: fixed — chụp đúng khung nhìn thay vì full-page.

// Bấm mở modal làm trang cuộn tới thẻ được bấm, mỗi bên một khác — đưa nền về đầu trang để hai bên giống nhau.
async function openModal(p: Page, target: ReturnType<Page['locator']>) {
  await target.click();
  await p.evaluate(() => window.scrollTo(0, 0));
}

const VIEWS: View[] = [
  { name: 'doi', proto: 'doi', app: '/t/t-domdom/doi' },
  { name: 'toi', proto: 'toi', app: '/t/t-domdom/toi' },
  { name: 'chien-thuat', proto: 'chien-thuat', app: '/t/t-domdom/chien-thuat' },
  { name: 'tran-toi', proto: 'tran-toi', app: '/t/t-domdom/tran-toi' },
  // Ô tìm + sắp xếp (BRD 4.6, prototype không có) làm thanh công cụ xuống dòng ở màn hẹp
  { name: 'cau-thu', proto: 'cau-thu', app: '/t/t-domdom/cau-thu', budget: { 1024: 0.15, 390: 0.12 } },
  { name: 'lich', proto: 'lich', app: '/t/t-domdom/lich' },
  { name: 'thong-ke', proto: 'thong-ke', app: '/t/t-domdom/thong-ke' },
  // Công tắc nhắc đóng quỹ ngày 5 (BRD 7.4) xuống dòng trên mobile
  { name: 'quy', proto: 'quy', app: '/t/t-domdom/quy', budget: { 390: 0.08 } },
  // Khối link mời ở tab Duyệt (BRD 8.6, prototype đặt ở tab Cầu thủ) làm trang dài thêm trên mobile
  { name: 'duyet', proto: 'duyet', app: '/t/t-domdom/duyet', budget: { 390: 0.17 } },
  { name: 'kham-pha', proto: 'kham-pha', app: '/kham-pha' },
  { name: 'he-thong', proto: 'he-thong', app: '/he-thong', who: 'admin' },
  {
    name: 'modal-cau-thu', proto: 'cau-thu', app: '/t/t-domdom/cau-thu',
    prep: async (p) => openModal(p, p.locator('.pcard .who b', { hasText: 'Khánh Mười' }).first()),
  },
  {
    name: 'modal-tran', proto: 'lich', app: '/t/t-domdom/lich',
    prep: async (p) => openModal(p, p.locator('.mcard', { hasText: 'Hoàng Mai Stars' }).first()),
  },
];

// Ngân sách mặc định: ≤ 6 % pixel lệch. Các màn hiện tại đều ≤ 6 % trừ ngoại lệ có ghi lý do ở trên.
const BUDGET = Number(process.env.VISUAL_BUDGET ?? 0.06);
const HIDE = `nextjs-portal,[data-nextjs-toast],[data-next-badge-root]{display:none!important}*{caret-color:transparent!important}`;

async function open(browser: Browser, width: number) {
  // bypassCSP: CSP của app chặn thẻ <style> chèn vào để ẩn overlay dev (CSP có test riêng ở tests/csp.spec.ts)
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh', deviceScaleFactor: 1, bypassCSP: true });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(NOW);
  return page;
}

/**
 * Prototype tải Be Vietnam Pro/Jost từ Google Fonts, app dùng bản next/font tải lúc build — hai bản có thể khác
 * nét và độ rộng (trên CI lệch đủ để chữ xuống dòng khác). Cho prototype dùng đúng file font của app.
 */
let fontCss: Promise<string> | undefined;
async function appFonts(request: APIRequestContext, base: string) {
  const html = await (await request.get(`${base}/dang-nhap`)).text();
  const sheets = [...html.matchAll(/href="([^"]+\.css[^"]*)"/g)].map((m) => new URL(m[1], base).href);
  const css = await Promise.all(sheets.map(async (u) => (await request.get(u)).text()));
  const faces = css.join('\n').match(/@font-face\{[^}]*\}/g) ?? [];
  if (!faces.length) throw new Error('Không tìm thấy @font-face trong CSS của app');
  return faces.join('\n').replace(/url\((?:\.\.\/media\/|\/_next\/static\/media\/)/g, 'url(https://fonts.gstatic.com/__app/');
}

async function useAppFonts(page: Page, base: string) {
  fontCss ??= appFonts(page.request, base);
  const css = await fontCss;
  await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ contentType: 'text/css', body: css }));
  await page.route('https://fonts.gstatic.com/__app/**', async (r) => {
    const res = await page.request.get(`${base}/_next/static/media/${new URL(r.request().url()).pathname.split('/').pop()}`);
    await r.fulfill({ status: res.status(), body: await res.body(), headers: { 'content-type': 'font/woff2', 'access-control-allow-origin': '*' } });
  });
}

async function protoLogin(page: Page, who: Who) {
  await page.goto(PROTO);
  await page.locator('.demo button').nth(who === 'admin' ? 0 : 1).click();
  await page.waitForFunction(() => location.hash.length > 1);
}

async function appLogin(page: Page, who: Who) {
  await page.goto('/dang-nhap');
  await page.fill('#lId', who === 'admin' ? '0900000000' : '0901000002');
  await page.fill('#lPw', who === 'admin' ? 'admin123' : '123456');
  await page.click('button[type=submit]');
  await page.waitForURL(/\/t\//);
}

async function shot(page: Page, fullPage = true) {
  await page.addStyleTag({ content: HIDE });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  return page.screenshot({ fullPage, animations: 'disabled', caret: 'hide' });
}

/** Chữ của phần tử ở toạ độ y (theo ảnh chụp) — để đọc log CI. */
async function textAt(page: Page, y: number, full: boolean) {
  return page.evaluate(([y, full]) => {
    if (full) window.scrollTo(0, Math.max(0, y - 100));
    const vy = full ? y - window.scrollY : y;
    const seen = new Set<string>();
    for (const x of [0.15, 0.5, 0.85].map((f) => f * innerWidth)) {
      const el = document.elementFromPoint(x, vy) as HTMLElement | null;
      if (el) seen.add(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${(el.innerText || '').replace(/\s+/g, ' ').slice(0, 60)}" ${getComputedStyle(el).fontFamily.slice(0, 40)}`);
    }
    if (full) window.scrollTo(0, 0);
    return [...seen].join(' | ');
  }, [y, full] as const);
}

for (const width of WIDTHS) {
  test(`prototype vs app @ ${width}px`, async ({ browser, baseURL }) => {
    test.setTimeout(240_000);
    const pages: Partial<Record<Who, { proto: Page; app: Page }>> = {};
    const get = async (who: Who) => {
      if (!pages[who]) {
        const proto = await open(browser, width);
        await useAppFonts(proto, baseURL!);
        const app = await open(browser, width);
        await protoLogin(proto, who);
        await app.goto(baseURL!);
        await appLogin(app, who);
        pages[who] = { proto, app };
      }
      return pages[who]!;
    };
    const failures: string[] = [];
    for (const v of VIEWS) {
      const { proto, app } = await get(v.who ?? 'captain');
      await proto.evaluate((h) => (location.hash = h), v.proto);
      await proto.waitForTimeout(400);
      await app.goto(v.app);
      await app.locator('html[data-hydrated="1"], body').first().waitFor();
      await app.waitForLoadState('networkidle');
      if (v.prep) {
        await v.prep(proto, 'proto');
        await v.prep(app, 'app');
        await proto.waitForTimeout(300);
        await app.waitForTimeout(500);
      }
      const name = `${v.name}-${width}`;
      const r = diff(await shot(proto, !v.prep), await shot(app, !v.prep), name);
      const budget = v.budget?.[width] ?? BUDGET;
      const { bands, crops, ...res } = r;
      record({ view: v.name, width, budget, ...res });
      if (r.ratio > budget) {
        failures.push(`${name}: ${(r.ratio * 100).toFixed(2)}% > ${(budget * 100).toFixed(0)}%`);
        console.log(`[visual] ${name} cao ${r.protoH}/${r.appH}, dải lệch: ${bands.slice(0, 12).map(([a, b]) => `${a}-${b}`).join(' ')}`);
        for (const [y0] of bands.slice(0, 4)) {
          console.log(`  y=${y0} proto: ${await textAt(proto, y0, !v.prep)}`);
          console.log(`  y=${y0} app:   ${await textAt(app, y0, !v.prep)}`);
        }
        if (process.env.VISUAL_LOG_PNG) for (const c of crops) console.log(`[visual-png] ${name} ${c.y} ${c.proto} ${c.app}`);
      }
      if (v.prep) {
        await proto.keyboard.press('Escape');
        await proto.evaluate(() => document.querySelectorAll('.overlay').forEach((o) => ((o as HTMLElement).hidden = true)));
      }
    }
    expect(failures, 'Màn lệch quá ngân sách so với prototype — xem e2e/visual-report/index.html').toEqual([]);
  });
}
