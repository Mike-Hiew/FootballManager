import { expect, test } from '@playwright/test';
import { CAPTAIN, closeResultPopup, hydrated, login, logout } from './helpers';

// Seed: Quang Còi có bản tự cập nhật chỉ số đang chờ (FIN, ATP = 9.5).
const P7 = ['0901000007', '123456'] as const;

test('BRD 4.7 — đồng đội chấm chỉ số, đội trưởng thấy số phiếu và chốt theo trung bình', async ({ page }) => {
  await login(page, P7);
  await page.goto('/t/t-domdom/doi');
  await hydrated(page);
  await closeResultPopup(page);
  const remind = page.locator('.stat-remind', { hasText: 'Quang Còi' });
  await expect(remind).toContainText('vừa cập nhật chỉ số');
  await remind.getByRole('button', { name: 'Chấm chỉ số' }).click();

  const dlg = page.getByRole('dialog', { name: /Chấm chỉ số · Quang Còi/ });
  await expect(dlg).toBeVisible();
  // Chưa chỉnh: chỉ "Xác nhận" bấm được; chỉnh Dứt điểm xuống 2 nấc thì đổi sang "Gửi chỉ số tôi chấm"
  await expect(dlg.getByRole('button', { name: 'Gửi chỉ số tôi chấm' })).toBeDisabled();
  const fin = dlg.getByRole('slider', { name: /^Dứt điểm/ });
  await expect(fin).toHaveValue('9.5');
  await fin.focus();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(fin).toHaveValue('8.5');
  await expect(dlg.getByRole('button', { name: 'Xác nhận như bản khai' })).toBeDisabled();
  await dlg.getByRole('button', { name: 'Gửi chỉ số tôi chấm' }).click();
  await expect(dlg).toHaveCount(0);
  await expect(page.locator('.toast')).toContainText('Đã gửi chỉ số bạn chấm');
  await expect(page.locator('.stat-remind', { hasText: 'Quang Còi' })).toHaveCount(0);

  await logout(page);
  await login(page, CAPTAIN);
  await page.goto('/t/t-domdom/duyet');
  await hydrated(page);
  // thẻ chấm chỉ số của chính Quang Còi (thẻ khác có thể liệt kê Quang Còi trong danh sách chưa chấm)
  const card = page.locator('.apcard').filter({ has: page.locator('.t b', { hasText: /^Quang Còi$/ }) }).filter({ hasText: 'đồng đội đã chấm' });
  await expect(card).toContainText(/1\/\d+ đồng đội đã chấm/);
  await expect(card).toContainText('✓ Phong Gió');
  // Dứt điểm: (9.5 tự khai + 8.5 đồng đội) / 2 = 9 = chỉ số hiện tại → không đổi; ATP cả hai 9.5 → đổi
  await expect(card.locator('.diff')).toContainText('ATP 9.0 → 9.5');
  await expect(card.locator('.diff')).not.toContainText('FIN');
  await card.getByRole('button', { name: 'Chốt theo trung bình' }).click();
  await expect(page.locator('.toast')).toContainText('Đã chốt chỉ số theo trung bình');
  await expect(card).toHaveCount(0);

  // ĐT nhờ cả đội chấm lại một người từ hồ sơ cầu thủ
  await page.goto('/t/t-domdom/cau-thu');
  await hydrated(page);
  await page.locator('.pcard .who b', { hasText: 'Khánh Mười' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Yêu cầu cả đội chấm' }).click();
  await expect(page.locator('.toast')).toContainText(/Đã nhờ \d+ người chấm chỉ số Khánh Mười/);

  // ĐT trưng cầu chỉ số nhiều người một lúc
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Trưng cầu chỉ số' }).click();
  const poll = page.getByRole('dialog', { name: 'Trưng cầu chỉ số' });
  await poll.getByLabel('Chọn tất cả').uncheck();
  await poll.locator('.poll-row', { hasText: 'Đức Cò' }).locator('input').check();
  await poll.locator('.poll-row', { hasText: 'Sơn Thép' }).locator('input').check();
  await expect(poll).toContainText('Đã chọn 2/');
  await poll.getByRole('button', { name: 'Gửi cả đội chấm' }).click();
  await expect(page.locator('.toast')).toContainText(/Đã mở 2 đợt chấm, báo \d+ người/);
});
