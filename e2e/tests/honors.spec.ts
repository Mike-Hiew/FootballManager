import { expect, test } from '@playwright/test';
import { CAPTAIN, closeResultPopup, hydrated, login, logout } from './helpers';

const P7 = ['0901000007', '123456'] as const; // Phong Gió

test('BRD 13 — ĐT vinh danh → thẻ lật có hiệu ứng; người được vinh danh tự mở thẻ một lần', async ({ page }) => {
  await login(page, CAPTAIN);
  await page.goto('/t/t-domdom/vinh-danh');
  await hydrated(page);
  await closeResultPopup(page);
  await expect(page.locator('.hv-row', { hasText: 'Vua phá lưới' })).toContainText('Quang Còi');
  await page.getByRole('button', { name: '+ Vinh danh cầu thủ' }).click();
  const dlg = page.getByRole('dialog', { name: 'Vinh danh cầu thủ' });
  await dlg.getByLabel('Cầu thủ').selectOption({ label: 'Phong Gió · #7' });
  await dlg.getByRole('button', { name: 'Chiến binh của trận' }).click();
  await dlg.getByLabel(/Lời khen/).fill('Chạy không biết mệt');
  await dlg.getByRole('button', { name: 'Vinh danh', exact: true }).click();
  await expect(page.locator('.toast')).toContainText('Đã vinh danh');

  // ĐT xem ngay thẻ vừa trao: úp → rung → lật
  const reveal = page.getByRole('dialog', { name: /Thẻ Phong Gió: Chiến binh của trận/ });
  await expect(reveal).toBeVisible();
  await expect(reveal.locator('.hc-stage')).toHaveClass(/reveal/, { timeout: 5000 });
  await expect(reveal).toContainText('“Chạy không biết mệt”');
  await expect(reveal.locator('.hc-card')).toHaveAttribute('aria-label', /Phong Gió, \w+, điểm \d+, Hạng (Đom Đóm|Vàng|Bạc)/);
  await reveal.getByRole('button', { name: 'Đóng' }).click();
  await expect(reveal).toHaveCount(0);

  // Người được vinh danh: thẻ tự mở ở tab bất kỳ, một lần
  await logout(page);
  await login(page, P7);
  await page.goto('/t/t-domdom/doi');
  await hydrated(page);
  const mine = page.getByRole('dialog', { name: /Thẻ Phong Gió: Chiến binh của trận/ });
  await expect(mine).toBeVisible();
  await mine.locator('.hc-actions').getByRole('button', { name: 'Đóng' }).click();
  await expect(mine).toHaveCount(0);
  await closeResultPopup(page);
  await page.reload();
  await hydrated(page);
  await page.waitForTimeout(800);
  await expect(page.locator('.hc-overlay')).toHaveCount(0);
  await page.goto('/t/t-domdom/vinh-danh');
  await hydrated(page);
  await closeResultPopup(page);
  await expect(page.locator('.hv-row', { hasText: 'Chiến binh của trận' })).toContainText('Phong Gió');
  await expect(page.locator('.hv-row.new')).toHaveCount(0);
});
