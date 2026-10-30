import { expect, test, type Page } from '@playwright/test';
import { ADMIN, CAPTAIN, hydrated, login } from './helpers';

/** Ghi lại mọi vi phạm CSP trên trang (script/style/ảnh bị chặn). */
async function watchCsp(page: Page) {
  const violations: string[] = [];
  await page.exposeFunction('__cspViolation', (v: string) => violations.push(v));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) =>
      (window as unknown as { __cspViolation: (v: string) => void }).__cspViolation(`${e.violatedDirective} ${e.blockedURI} @ ${location.pathname} ${e.sourceFile}:${e.lineNumber}:${e.columnNumber} ${e.sample}`),
    );
  });
  page.on('console', (m) => { if (m.type() === 'error' && /Content Security Policy/i.test(m.text())) violations.push(m.text()); });
  return violations;
}

test('CSP có nonce, mọi màn chạy được và không vi phạm', async ({ page }) => {
  const violations = await watchCsp(page);
  const res = await page.goto('/dang-nhap');
  const csp = res!.headers()['content-security-policy'];
  expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
  expect(csp).toContain("frame-ancestors 'none'");
  // Nonce đổi theo từng request
  const again = (await page.request.get('/dang-nhap')).headers()['content-security-policy'];
  expect(again).not.toBe(csp);

  await login(page, CAPTAIN);
  for (const tab of ['doi', 'toi', 'chien-thuat', 'tran-toi', 'cau-thu', 'lich', 'thong-ke', 'quy', 'duyet']) {
    await page.goto(`/t/t-domdom/${tab}`);
    await hydrated(page);
  }
  // Tương tác client vẫn chạy: mở modal cầu thủ
  await page.goto('/t/t-domdom/cau-thu');
  await hydrated(page);
  await page.locator('.pcard .who b').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.goto('/kham-pha');
  await page.waitForLoadState('networkidle');

  await page.context().clearCookies();
  await login(page, ADMIN);
  await page.goto('/he-thong');
  await page.waitForLoadState('networkidle');

  expect(violations).toEqual([]);
});
