import { test } from '@playwright/test';
import { CAPTAIN, login, noHorizontalScroll } from './helpers';

test('11.1 #15 — 390 px: không cuộn ngang ở các tab chính', async ({ page }) => {
  await login(page, CAPTAIN);
  for (const v of ['doi', 'cau-thu', 'chien-thuat', 'lich', 'thong-ke', 'vinh-danh', 'chuyen-nhuong', 'quy', 'duyet', 'toi']) {
    await page.goto(`/t/t-domdom/${v}`);
    await page.waitForLoadState('networkidle');
    await noHorizontalScroll(page);
  }
});
