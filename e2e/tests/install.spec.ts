import { expect, test } from '@playwright/test';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ZALO = `${IPHONE.replace(' Safari/604.1', '')} Zalo iOS/24.10.1 ZaloTheme/light ZaloLanguage/vn`;
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36';
const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

test('iPhone Safari: hướng dẫn Thêm vào MH chính; "Để sau" thì không hiện lại trong lần mở này', async ({ browser }) => {
  const ctx = await browser.newContext({ ...phone, userAgent: IPHONE });
  const page = await ctx.newPage();
  await page.goto('/dang-nhap');
  const sheet = page.getByRole('dialog', { name: /lên màn hình chính/ });
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText('Chia sẻ');
  await expect(sheet).toContainText('Thêm vào MH chính');
  await expect(sheet).toContainText('thanh dưới cùng của Safari');
  await sheet.getByRole('button', { name: 'Để sau' }).last().click();
  await expect(sheet).toHaveCount(0);
  await page.reload();
  await page.waitForTimeout(2000);
  await expect(page.locator('.install-sheet')).toHaveCount(0);
  await ctx.close();
});

test('Mở trong Zalo: hướng dẫn mở bằng Safari, sao chép được link', async ({ browser }) => {
  const ctx = await browser.newContext({ ...phone, userAgent: ZALO, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  await page.goto('/dang-nhap');
  const sheet = page.getByRole('dialog', { name: /lên màn hình chính/ });
  await expect(sheet).toContainText('Mở bằng Safari');
  await sheet.getByRole('button', { name: 'Sao chép link' }).click();
  await expect(sheet.getByRole('button', { name: 'Đã sao chép link' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('/dang-nhap');
  await ctx.close();
});

test('Android: sự kiện cài của Chrome → nút "Cài app" mở hộp cài đặt', async ({ browser }) => {
  const ctx = await browser.newContext({ ...phone, userAgent: ANDROID });
  const page = await ctx.newPage();
  await page.goto('/dang-nhap');
  await page.waitForFunction(() => document.documentElement.dataset.hydrated === '1' || document.readyState === 'complete');
  await page.evaluate(() => {
    const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
    e.prompt = async () => {
      (window as unknown as { __prompted: boolean }).__prompted = true;
    };
    e.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(e);
  });
  const sheet = page.getByRole('dialog', { name: /lên màn hình chính/ });
  await sheet.getByRole('button', { name: 'Cài app' }).click();
  await expect(sheet).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __prompted?: boolean }).__prompted)).toBe(true);
  await ctx.close();
});
