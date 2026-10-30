import { expect, test } from '@playwright/test';
import { CAPTAIN, hoverStill, hydrated, login } from './helpers';

test.beforeEach(async ({ page }) => login(page, CAPTAIN));

test('11.1 #14 — tooltip mở bằng chuột, bàn phím, chạm; 2 quy định đầu là chữ, còn lại là icon', async ({ page }) => {
  await page.goto('/t/t-domdom/doi');
  await hydrated(page);
  await expect(page.locator('ol.rules li')).toHaveCount(2);
  const icons = page.locator('.rule-more .rule-ic');
  await expect(icons).toHaveCount(4);
  await hoverStill(page, icons.first());
  await expect(page.locator('#tipbox')).toBeVisible();
  await expect(page.locator('#tipbox')).toContainText('Thành viên quỹ');
  await page.mouse.move(0, 0);
  await expect(page.locator('#tipbox')).toBeHidden();
  await icons.nth(1).focus();
  await expect(page.locator('#tipbox')).toContainText('đá lẻ');
});

test('11.1 #3 — popover công thức chỉ hiện khi hover/focus vào ô điểm', async ({ page }) => {
  await page.goto('/t/t-domdom/cau-thu');
  await hydrated(page);
  await expect(page.locator('.pop:not([hidden])')).toHaveCount(0);
  // Đức Cò thuận chân trái, mạnh nhất ở LB → có điều chỉnh chân thuận +0.3
  const chip = page.locator('.pcard', { hasText: 'Đức Cò' }).locator('[data-x="p:p4:LB"]');
  await expect(chip).toContainText('LB');
  await expect(chip).toContainText('7.3');
  await hoverStill(page, chip);
  const pop = page.locator('.pop:not([hidden])');
  await expect(pop).toContainText('LB · Hậu vệ trái');
  await expect(pop).toContainText('Điểm = Σ (chỉ số × trọng số) / 100 ± chân thuận');
  await expect(pop).toContainText('+0.3');
});

test('11.1 #5 — chạm cầu thủ → slot sáng theo ngưỡng; chạm slot → top 3 gợi ý', async ({ page }) => {
  await page.goto('/t/t-domdom/chien-thuat');
  await hydrated(page);
  await page.getByRole('button', { name: 'Bỏ hết' }).click();
  await page.locator('tr.brow', { hasText: 'Hùng Gôn' }).click();
  const gk = page.locator('.slot').first();
  await expect(gk).toHaveClass(/glow-good/);
  await expect(gk).toHaveClass(/glow-best/);
  await expect(page.locator('.slot.glow-bad').first()).toBeVisible();
  await gk.click();
  await expect(gk).toContainText('Hùng Gôn');

  await page.locator('.slot').nth(6).click(); // ST trống
  const sugg = page.locator('.pcard2 .sugg .sg');
  await expect(sugg.first()).toContainText('Quang Còi');
  await expect(sugg.first()).toContainText('Hợp nhất');
  await page.getByRole('button', { name: 'Xếp tự động' }).click();
  await expect(page.locator('.slot.filled')).toHaveCount(7);
});

test('11.1 #6 — Trận tới chỉ lấy người Đi; kế hoạch thay người', async ({ page }) => {
  await page.goto('/t/t-domdom/tran-toi');
  await hydrated(page);
  const going = Number((await page.locator('.attsum span').first().locator('b').textContent()) ?? 0);
  await expect(page.locator('tbody.bench-b tr.brow')).toHaveCount(Math.max(0, going - 7));
  await page.locator('.plansum').click();
  await expect(page.getByText('Thứ tự ưu tiên ra sân')).toBeVisible();
  await expect(page.locator('.ptbl tbody tr')).toHaveCount(going);
});
