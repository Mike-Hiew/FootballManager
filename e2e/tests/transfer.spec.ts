import { expect, test } from '@playwright/test';
import { CAPTAIN, OTHER_CAPTAIN, closeResultPopup, hydrated, login, logout } from './helpers';

const P8 = ['0901000008', '123456'] as const; // Minh Lùn — chưa định giá
const Q5 = ['0902000005', '123456'] as const; // Huy Mập (Phố Huế) — đang rao

test('BRD 12.1 — thành viên tự định giá (M/B), ĐT nhắc người chưa định giá', async ({ page }) => {
  await login(page, CAPTAIN);
  await page.goto('/t/t-domdom/chuyen-nhuong');
  await hydrated(page);
  await closeResultPopup(page);
  await expect(page.locator('.tm-total')).toContainText(/^Tổng giá trị đội hình[\d.]+đ$/);
  const row = page.locator('.tm-row', { hasText: 'Minh Lùn' });
  await expect(row).toContainText('1.000.000');
  await expect(row).toContainText('Mặc định');
  await row.getByRole('button', { name: 'Nhắc' }).click();
  await expect(page.locator('.toast')).toContainText('Đã nhắc Minh Lùn định giá');

  // Thành viên vào app: popup "Đội trưởng nhắc bạn" → bấm tới đúng tab Chuyển nhượng; đóng rồi không hiện lại
  await logout(page);
  await login(page, P8);
  await page.goto('/t/t-domdom/doi');
  await hydrated(page);
  await closeResultPopup(page, { reminders: false });
  const remind = page.getByRole('dialog', { name: 'Đội trưởng nhắc bạn' });
  await expect(remind).toBeVisible();
  await expect(remind).toContainText('Tuấn Tạ');
  await remind.getByRole('button', { name: /^Định giá: .*đặt giá trị chuyển nhượng/ }).click();
  await expect(page).toHaveURL(/\/t\/t-domdom\/chuyen-nhuong/);
  await expect(page.locator('.rm-overlay')).toHaveCount(0);
  await hydrated(page);
  await closeResultPopup(page);
  const me = page.locator('.tm-me');
  await expect(me).toContainText('1.000.000 đ');
  await expect(me).toContainText('Mặc định');
  const input = me.getByLabel('Đặt giá trị chuyển nhượng của bạn');
  await input.fill('0.5M');
  await expect(me.locator('.tm-vin-out')).toContainText('bước 0,1M');
  await input.fill('1.2B');
  await expect(me.locator('.tm-vin-out')).toHaveText('= 1.200.000.000 đ');
  await me.getByRole('button', { name: 'Đặt giá' }).click();
  await expect(page.locator('.toast')).toContainText('Đã đặt giá trị 1.200.000.000 đ');
  await expect(me.locator('.tm-me-val')).toContainText('1.200.000.000 đ');
  await expect(page.locator('.tm-row', { hasText: 'Minh Lùn' })).toContainText('1.200.000.000');
});

test('BRD 12.2 — ĐT đội khác đề nghị → ĐT đội bán trả giá → đồng ý → cầu thủ đồng ý → bảng tin', async ({ page }) => {
  // ĐT Đom Đóm mua Huy Mập từ thị trường
  await login(page, CAPTAIN);
  await page.goto('/t/t-domdom/chuyen-nhuong');
  await hydrated(page);
  await closeResultPopup(page);
  await page.getByRole('tab', { name: /^Thị trường/ }).click();
  await expect(page.locator('.tm-row', { hasText: 'Việt Kều' })).toContainText('Đội của bạn');
  await expect(page.locator('.tm-row', { hasText: 'Hiếu Còi' })).toContainText('650.000.000');
  await page.getByLabel('Tìm cầu thủ / đội').fill('Huy');
  const card = page.locator('.tm-row', { hasText: 'Huy Mập' });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Đề nghị mua Huy Mập' }).click();
  const dlg = page.getByRole('dialog', { name: 'Đề nghị mua · Huy Mập' });
  await dlg.getByLabel(/Giá đề nghị/).fill('180M');
  await expect(dlg.locator('.tm-diff')).toContainText('Thấp hơn giá trị');
  await dlg.getByLabel(/Lời nhắn/).fill('Cần tiền vệ');
  await dlg.getByRole('button', { name: 'Gửi đề nghị' }).click();
  await expect(page.locator('.toast')).toContainText('Đã gửi đề nghị 180.000.000 đ cho Phố Huế United');

  // ĐT Phố Huế trả giá
  await logout(page);
  await login(page, OTHER_CAPTAIN);
  await page.goto('/t/t-phohue/chuyen-nhuong');
  await hydrated(page);
  await expect(page.locator('.tm-alert')).toContainText('1 đề nghị cần bạn trả lời');
  const offer = page.locator('.tm-offer', { hasText: 'Huy Mập' });
  await expect(offer).toContainText('Đom Đóm FC');
  await expect(offer).toContainText('“Cần tiền vệ”');
  await offer.getByRole('button', { name: 'Trả giá' }).click();
  const cdlg = page.getByRole('dialog', { name: 'Trả giá · Huy Mập' });
  await cdlg.getByLabel('Giá bạn muốn bán').fill('250M');
  await cdlg.getByRole('button', { name: 'Gửi giá' }).click();
  await expect(page.locator('.toast')).toContainText('Đã trả giá 250.000.000 đ');
  await expect(offer.locator('.tm-status')).toHaveText('Đội bán trả giá');

  // ĐT Đom Đóm đồng ý giá
  await logout(page);
  await login(page, CAPTAIN);
  await page.goto('/t/t-domdom/chuyen-nhuong');
  await hydrated(page);
  await closeResultPopup(page);
  const mine = page.locator('.tm-offer', { hasText: 'Huy Mập' });
  await mine.getByRole('button', { name: 'Đồng ý giá 250.000.000 đ' }).click();
  await expect(mine.locator('.tm-status')).toHaveText('Chờ cầu thủ đồng ý');

  // Cầu thủ đồng ý → chuyển đội
  await logout(page);
  await login(page, Q5);
  await page.goto('/t/t-phohue/chuyen-nhuong');
  await hydrated(page);
  const mineP = page.locator('.tm-offer', { hasText: 'Huy Mập' });
  await mineP.getByRole('button', { name: 'Đồng ý chuyển đội' }).click();
  await expect(page.locator('.toast')).toContainText('Đã đồng ý chuyển đội');

  await page.goto('/t/t-domdom/chuyen-nhuong');
  await hydrated(page);
  await closeResultPopup(page);
  await page.getByRole('tab', { name: 'Bảng tin' }).click();
  const news = page.locator('.tm-news-item').first();
  await expect(news).toContainText('HERE WE GO');
  await expect(news).toContainText('Huy Mập');
  await expect(news).toContainText('250.000.000 đ');
  await page.getByRole('tab', { name: 'Đội hình' }).click();
  await expect(page.locator('.tm-row', { hasText: 'Huy Mập' })).toContainText('250.000.000');
});
