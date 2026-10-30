import { expect, test } from '@playwright/test';
import { CAPTAIN, login, logout } from './helpers';

test('11.1 #2 — link mời → chờ duyệt → ĐT sửa chỉ số rồi duyệt → vào đội; link mới thì link cũ hết hiệu lực', async ({ page }) => {
  const phone = '0908' + String(Date.now()).slice(-6);
  await page.goto('/join/domdom7');
  await expect(page.getByRole('heading', { name: 'Đom Đóm FC' })).toBeVisible();
  await page.fill('#jName', 'Đinh Văn Thử');
  await page.fill('#jPhone', phone);
  await page.fill('#jPw', 'thu-nghiem-123');
  await page.fill('#jNick', 'Thử Lửa');
  await page.selectOption('#jPos1', 'ST');
  await page.fill('#jR1', '7.5');
  await page.getByRole('button', { name: 'Gửi đăng ký vào đội' }).click();
  await page.waitForURL(/\/bat-dau/);
  await expect(page.getByRole('heading', { name: 'Đang chờ duyệt' })).toBeVisible();

  await logout(page);
  await login(page, CAPTAIN);
  await page.goto('/t/t-domdom/duyet');
  const card = page.locator('.apcard', { hasText: 'Đinh Văn Thử' });
  await card.getByRole('button', { name: 'Xem & sửa' }).click();
  await page.getByRole('tab', { name: 'Chỉ số & vị trí' }).click();
  await page.getByLabel(/Dứt điểm:/).fill('9');
  await page.getByRole('button', { name: 'Duyệt vào đội' }).click();
  await expect(page.locator('.toast')).toContainText('Đã duyệt');
  await expect(page.locator('.apcard', { hasText: 'Đinh Văn Thử' })).toHaveCount(0);

  // tạo link mới → link cũ báo hết hiệu lực
  const invite = page.getByLabel('Link mời');
  const oldLink = await invite.inputValue();
  await page.getByRole('button', { name: 'Tạo link mới' }).click();
  await page.getByRole('button', { name: 'Bấm lần nữa để tạo' }).click();
  await expect(invite).not.toHaveValue(oldLink);
  await page.goto(new URL(oldLink).pathname);
  await expect(page.getByText('Link mời không còn hiệu lực, xin link mới từ đội trưởng.')).toBeVisible();

  await logout(page);
  await login(page, [phone, 'thu-nghiem-123']);
  await expect(page).toHaveURL(/\/t\/t-domdom\/doi/);
  await page.locator('#bellBtn').click();
  await expect(page.locator('#npanel')).toContainText('Bạn đã vào đội Đom Đóm FC');
});
