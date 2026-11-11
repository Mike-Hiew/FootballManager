import { expect, test } from '@playwright/test';
import { CAPTAIN, closeResultPopup, hydrated, login } from './helpers';

test('BRD 15 — đá nội bộ: tạo trận, chia tiền (sân + nước), ĐT tự xếp đội / chia ngẫu nhiên cân bằng', async ({ page }) => {
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

  // ĐT tự xếp: 2 người vào A, 1 người vào B, rồi để app chia nốt phần còn lại cho cân
  await dlg.getByRole('tab', { name: 'Chia đội' }).click();
  const A = dlg.getByRole('region', { name: 'Đội A · áo sáng' });
  const B = dlg.getByRole('region', { name: 'Đội B · áo tối' });
  const rest = dlg.getByRole('region', { name: 'Chưa xếp đội' });
  await expect(rest.locator('.arow')).toHaveCount(8);
  await rest.getByRole('button', { name: 'Cho Hùng Gôn vào Đội A' }).click();
  await rest.getByRole('button', { name: 'Cho Đức Cò vào Đội A' }).click();
  await rest.getByRole('button', { name: 'Cho Tuấn Tạ vào Đội B' }).click();
  await expect(A.locator('.sd-p')).toHaveCount(2);
  await expect(B.locator('.sd-p')).toHaveCount(1);
  await expect(rest.locator('.arow')).toHaveCount(5);
  // bấm người trong đội để đổi bên, ✕ để bỏ ra
  await A.getByRole('button', { name: 'Chuyển Đức Cò sang Đội B' }).click();
  await expect(B.locator('.sd-p')).toHaveCount(2);
  await B.getByRole('button', { name: 'Bỏ Đức Cò ra khỏi Đội B' }).click();
  await expect(rest.locator('.arow')).toHaveCount(6);
  await dlg.getByRole('button', { name: /Chia nốt 6 người còn lại/ }).click();
  await expect(page.locator('.toast')).toContainText('giữ người bạn đã xếp');
  await expect(A).toContainText('Hùng Gôn');
  await expect(B).toContainText('Tuấn Tạ');
  await expect(A.locator('.sd-p')).toHaveCount(4);
  await expect(B.locator('.sd-p')).toHaveCount(4);
  await expect(rest).toHaveCount(0);
  await expect(dlg.locator('.sd-bal small')).toContainText(/Đội A \d+% · Đội B \d+%/);

  // Chia ngẫu nhiên cả đội; xếp lại từ đầu
  await dlg.getByRole('button', { name: 'Chia lại ngẫu nhiên' }).click();
  await expect(page.locator('.toast')).toContainText('Đã chia đội cân bằng');
  await expect(A.locator('.sd-p')).toHaveCount(4);
  await expect(B.locator('.sd-p')).toHaveCount(4);
  await dlg.getByRole('button', { name: 'Xếp lại từ đầu' }).click();
  await expect(rest.locator('.arow')).toHaveCount(8);
  await expect(dlg.getByRole('button', { name: 'Chia ngẫu nhiên cân bằng' })).toBeVisible();

  // Kết quả: Đội A / Đội B thay cho tên đội và đối thủ
  await dlg.getByRole('tab', { name: 'Kết quả' }).click();
  await expect(dlg.locator('.scorebox')).toContainText('Đội A (áo sáng)');
  await expect(dlg.locator('.scorebox')).toContainText('Đội B (áo tối)');

  // dọn dữ liệu cho test khác
  await dlg.getByRole('button', { name: 'Xoá trận' }).click();
  await dlg.getByRole('button', { name: 'Bấm lần nữa để xoá' }).click();
  await expect(page.locator('.toast')).toContainText('Đã xoá trận');
});
