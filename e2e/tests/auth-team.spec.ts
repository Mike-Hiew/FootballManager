import { expect, test } from '@playwright/test';

test.describe('11.1 #1 — Đăng ký đội trưởng 2 bước', () => {
  test('tạo đội; tên "dom dom fc" bị chặn vì trùng "Đom Đóm FC"', async ({ page }) => {
    const phone = '09' + String(Date.now()).slice(-8);
    await page.goto('/dang-ky');
    await page.fill('#rName', 'Trần Văn Mới');
    await page.fill('#rPhone', phone);
    await page.fill('#rEmail', `moi${phone}@example.com`);
    await page.fill('#rPw', 'sao-bang-2026');
    await page.fill('#rPw2', 'sao-bang-2026');
    await page.click('button[type=submit]');
    await page.waitForURL(/\/tao-doi/);

    await page.fill('#cName', 'dom dom fc');
    await expect(page.locator('#cNameHint')).toHaveText('Tên đội đã có, hãy chọn tên khác');
    await expect(page.getByRole('button', { name: 'Tạo đội' })).toBeDisabled();

    await page.fill('#cName', `Sao Băng ${phone.slice(-4)}`);
    await expect(page.locator('#cNameHint')).toHaveText('Tên đội dùng được');
    await page.getByRole('button', { name: 'Tạo đội' }).click();
    await page.waitForURL(/\/t\/.+\/doi\?moi=1/);
    await expect(page.locator('.hero h2')).toHaveText(`Sao Băng ${phone.slice(-4)}`);
    await expect(page.locator('.me-chip .role')).toHaveText('Đội trưởng');
  });

  test('sai mật khẩu báo lỗi tiếng Việt', async ({ page }) => {
    await page.goto('/dang-nhap');
    await page.fill('#lId', '0901000003');
    await page.fill('#lPw', 'sai-mat-khau');
    await page.click('button[type=submit]');
    await expect(page.locator('.err')).toContainText('Sai số điện thoại/email hoặc mật khẩu');
  });
});
