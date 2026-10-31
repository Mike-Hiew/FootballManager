import { expect, type Locator, type Page } from '@playwright/test';

export const CAPTAIN = ['0901000002', '123456'] as const;
export const MEMBER = ['0901000009', '123456'] as const;
export const OTHER_CAPTAIN = ['0902000002', '123456'] as const;
export const PENDING = ['0901000099', '123456'] as const;
export const ADMIN = ['0900000000', 'admin123'] as const;

export async function login(page: Page, [id, pw]: readonly [string, string]) {
  await page.goto('/dang-nhap');
  await page.fill('#lId', id);
  await page.fill('#lPw', pw);
  await page.click('button[type=submit]');
  await page.waitForURL(/\/t\/|\/bat-dau/);
}

export async function logout(page: Page) {
  await page.context().clearCookies();
}

export async function noHorizontalScroll(page: Page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(1);
}

/** Chờ trang đội hydrate xong (TeamProvider đặt html[data-hydrated]). */
export async function hydrated(page: Page) {
  await page.locator('html[data-hydrated="1"]').waitFor({ state: 'attached' });
}

/** Tooltip/popover đóng khi cuộn (BRD 10.3) — cuộn tới phần tử trước rồi mới hover. */
export async function hoverStill(page: Page, el: Locator) {
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  await el.hover();
}

/** Đóng popup tỉ số trận vừa kết thúc nếu hiện (test khác có thể vừa nhập tỉ số). */
export async function closeResultPopup(page: Page) {
  const pop = page.locator('.rp-overlay');
  try {
    await pop.waitFor({ state: 'visible', timeout: 2500 });
  } catch {
    return;
  }
  await pop.locator('.rp-acts').getByRole('button', { name: 'Đóng' }).click();
  await pop.waitFor({ state: 'detached' });
}
