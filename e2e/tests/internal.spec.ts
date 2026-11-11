import { expect, test } from '@playwright/test';
import { CAPTAIN, closeResultPopup, hydrated, login } from './helpers';

test('BRD 15 — đá nội bộ: tạo trận, chia tiền (sân + nước), chia ngẫu nhiên 2 đội cân bằng', async ({ page }) => {
  await login(page, CAPTAIN);
  await page.goto('/t/t-domdom/lich');
  await hydrated(page);
  await closeResultPopup(page);
  await page.getByRole('button', { name: '+ Tạo trận' }).click();
  let dlg = page.getByRole('dialog', { name: 'Tạo trận' });
  await dlg.getByLabel('Loại trận').selectOption('Nội bộ');
  await expect(dlg.getByLabel('Tên trận')).toHaveValue('Nội bộ');
  await expect(dlg.getByLabel('Giá đá lẻ trận này (đ)')).toHaveCount(0);
  await dlg.getByLabel('Ngày').fill('2099-12-31');
  await dlg.getByLabel('Tiền sân (đ)').fill('600000');
  await dlg.getByLabel(/Mở vote tham gia/).uncheck();
  await dlg.getByRole('button', { name: 'Tạo trận và điểm danh' }).click();
  await expect(page.locator('.toast')).toContainText('Đã tạo trận');

  dlg = page.getByRole('dialog', { name: 'Đá nội bộ · 31/12' });
  await expect(dlg.getByRole('tab', { name: 'Chia đội' })).toBeVisible();
  // ĐT điểm danh 8 người Đi
  const groups = dlg.getByRole('group', { name: /^Điểm danh / });
  for (let i = 0; i < 8; i++) {
    await groups.nth(i).getByRole('button', { name: 'Đi' }).click();
    await expect(groups.nth(i).getByRole('button', { name: 'Đi' })).toHaveAttribute('aria-pressed', 'true');
  }

  // Chia tiền: tiền sân 600k + nước 200k → 100k/người, áp cho cả người đóng quỹ
  const split = dlg.getByRole('region', { name: 'Chia tiền đá nội bộ' });
  await split.getByRole('button', { name: '+ Nước' }).click();
  await split.getByLabel('Số tiền Nước').fill('200000');
  await expect(split.locator('.sp-sum')).toContainText(/Tổng chi 800\.000\s?đ/);
  await expect(split.locator('.sp-sum')).toContainText(/mặc định 100\.000\s?đ/);
  await split.getByRole('button', { name: 'Lưu chia tiền' }).click();
  await expect(page.locator('.toast')).toContainText('Đã lưu chia tiền');
  await expect(dlg.locator('.arow').first()).toContainText(/Phần chia · 100\.000\s?đ/);

  // Chia đội ngẫu nhiên cân bằng: 4 – 4, bấm một người để chuyển đội
  await dlg.getByRole('tab', { name: 'Chia đội' }).click();
  await dlg.getByRole('button', { name: 'Chia ngẫu nhiên cân bằng' }).click();
  await expect(page.locator('.toast')).toContainText('Đã chia đội cân bằng');
  const A = dlg.getByRole('region', { name: 'Đội A · áo sáng' });
  const B = dlg.getByRole('region', { name: 'Đội B · áo tối' });
  await expect(A.locator('.sd-p')).toHaveCount(4);
  await expect(B.locator('.sd-p')).toHaveCount(4);
  await expect(dlg.locator('.sd-bal small')).toContainText(/Đội A \d+% · Đội B \d+%/);
  await A.locator('.sd-p').first().click();
  await expect(A.locator('.sd-p')).toHaveCount(3);
  await expect(B.locator('.sd-p')).toHaveCount(5);
  await expect(dlg.getByRole('button', { name: 'Chia lại ngẫu nhiên' })).toBeVisible();

  // Kết quả: Đội A / Đội B thay cho tên đội và đối thủ
  await dlg.getByRole('tab', { name: 'Kết quả' }).click();
  await expect(dlg.locator('.scorebox')).toContainText('Đội A (áo sáng)');
  await expect(dlg.locator('.scorebox')).toContainText('Đội B (áo tối)');

  // dọn dữ liệu cho test khác
  await dlg.getByRole('button', { name: 'Xoá trận' }).click();
  await dlg.getByRole('button', { name: 'Bấm lần nữa để xoá' }).click();
  await expect(page.locator('.toast')).toContainText('Đã xoá trận');
});
