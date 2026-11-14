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

/**
 * Đóng popup tỉ số trận vừa kết thúc nếu hiện (test khác có thể vừa nhập tỉ số), rồi popup
 * "Đội trưởng nhắc bạn" nếu có (test khác có thể vừa bấm nhắc). `reminders: false` để giữ popup nhắc.
 */
export async function closeResultPopup(page: Page, opts: { reminders?: boolean } = {}) {
  const pop = page.locator('.rp-overlay');
  let shown = true;
  try {
    await pop.waitFor({ state: 'visible', timeout: 2500 });
  } catch {
    shown = false;
  }
  if (shown) {
    await pop.locator('.rp-acts').getByRole('button', { name: 'Đóng' }).click();
    await pop.waitFor({ state: 'detached' });
  }
  if (opts.reminders !== false) await closeReminders(page);
}

/** Đóng popup "Đội trưởng nhắc bạn" nếu hiện. */
export async function closeReminders(page: Page) {
  const pop = page.locator('.rm-overlay');
  try {
    await pop.waitFor({ state: 'visible', timeout: 2500 });
  } catch {
    return;
  }
  await pop.getByRole('button', { name: 'Để sau' }).click();
  await pop.waitFor({ state: 'detached' });
}

/** Đóng thẻ vinh danh tự mở (chỉ số mới / được vinh danh) nếu đang hiện. */
export async function closeHonorPopup(page: Page) {
  const pop = page.locator('.hc-overlay');
  try {
    await pop.waitFor({ state: 'visible', timeout: 2500 });
  } catch {
    return;
  }
  await pop.locator('.hc-actions').getByRole('button', { name: 'Đóng' }).click();
  await pop.waitFor({ state: 'detached' });
}

/** Thẻ cầu thủ (giao diện v2) bấm để lật; mặt sau có nút "Mở hồ sơ". Lật nếu chưa lật rồi mở hồ sơ. */
export async function openPlayerCard(page: Page, name: string | RegExp) {
  const card = page.locator('.pcard').filter({ has: page.locator('.who b', { hasText: name }) }).first();
  if ((await card.getAttribute('aria-pressed')) !== 'true') await card.locator('.who b').click();
  await expect(card).toHaveAttribute('aria-pressed', 'true');
  await card.getByRole('button', { name: /^Mở hồ sơ/ }).click();
  return page.getByRole('dialog').first();
}
