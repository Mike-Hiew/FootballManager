import { expect, test } from '@playwright/test';
import { CAPTAIN, MEMBER, hydrated, login, logout } from './helpers';

test('11.1 #8 — thành viên chưa vote thấy viền nhấp nháy + "✓ Tôi đi"; bấm xong số Đi tăng ngay', async ({ page }) => {
  await login(page, MEMBER);
  await page.goto('/t/t-domdom/doi');
  await hydrated(page);
  const box = page.locator('.nxb');
  await expect(box).toHaveClass(/need/);
  const count = box.locator('.nx-att .big b');
  const before = Number(await count.textContent());
  await box.getByRole('button', { name: '✓ Tôi đi' }).click();
  await expect(count).toHaveText(String(before + 1));
  await expect(box).not.toHaveClass(/need/);
  await expect(page.locator('.toast')).toContainText('Đã điểm danh: bạn ĐI');
});

test('11.1 #7 — ĐT sửa hộ hiện "đội trưởng chỉnh"; thành viên không sửa được dòng người khác', async ({ page }) => {
  await login(page, CAPTAIN);
  await page.goto('/t/t-domdom/lich');
  await hydrated(page);
  await page.locator('.mcard', { hasText: 'Hoàng Mai Stars' }).click();
  const row = page.locator('.arow', { hasText: 'Bảo Béo' });
  await row.getByRole('button', { name: 'Đi' }).click();
  await expect(row).toContainText('đội trưởng chỉnh');

  await logout(page);
  await login(page, MEMBER);
  await page.goto('/t/t-domdom/lich');
  await hydrated(page);
  await page.locator('.mcard', { hasText: 'Hoàng Mai Stars' }).click();
  await expect(page.locator('.arow', { hasText: 'Bảo Béo' }).getByRole('button', { name: 'Đi' })).toBeDisabled();
  const res = await page.request.put('/api/matches/m5/attendance/p1', { data: { status: 'nghi' }, headers: { origin: new URL(page.url()).origin } });
  expect(res.status()).toBe(403);
});

test('11.1 #9 — khai báo chỉ cho người Đi sau ngày đá; ĐT duyệt', async ({ page }) => {
  await login(page, ['0901000011', '123456']); // Minh Lùn, đi trận m4
  await page.goto('/t/t-domdom/lich');
  await hydrated(page);
  await page.locator('.mcard', { hasText: 'Anh Em Mỹ Đình' }).click();
  await expect(page.getByRole('heading', { name: 'Khai báo của tôi' })).toBeVisible();
  await logout(page);
  await login(page, ['0901000010', '123456']); // Sơn Thép, nghỉ trận m4
  await page.goto('/t/t-domdom/lich');
  await hydrated(page);
  await page.locator('.mcard', { hasText: 'Anh Em Mỹ Đình' }).click();
  await expect(page.getByRole('heading', { name: 'Khai báo của tôi' })).toHaveCount(0);
});
