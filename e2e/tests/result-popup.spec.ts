import { expect, test } from '@playwright/test';
import { CAPTAIN, MEMBER, hydrated, login, logout } from './helpers';

// Trận 4 của seed (vs Anh Em Mỹ Đình, thắng 4–1) đã có tỉ số từ trước khi có tính năng nên chưa có mốc kết quả.
// ĐT lưu lại đúng tỉ số + bàn/kiến tạo → mốc kết quả = bây giờ → thành viên thấy popup.
const M4 = { scoreUs: 4, scoreThem: 1, events: [{ playerId: 'p9', goals: 2, assists: 1 }, { playerId: 'p7', goals: 1, assists: 0 }, { playerId: 'p8', goals: 1, assists: 0 }, { playerId: 'p6', goals: 0, assists: 2 }] };

test('BRD 6.8 — popup tỉ số hiện một lần cho thành viên; nhắc khai báo trên tab Đội', async ({ page, baseURL }) => {
  await login(page, CAPTAIN);
  const r = await page.request.put('/api/matches/m4/score', { data: M4, headers: { Origin: baseURL! } });
  expect(r.ok()).toBe(true);
  // Người nhập tỉ số không thấy popup
  await page.goto('/t/t-domdom/doi');
  await hydrated(page);
  await expect(page.locator('.rp-overlay')).toHaveCount(0);

  await logout(page);
  await login(page, MEMBER);
  await page.goto('/t/t-domdom/doi');
  await hydrated(page);
  const pop = page.getByRole('dialog', { name: 'Chiến thắng!' });
  await expect(pop).toBeVisible();
  await expect(page.locator('.rp-overlay')).toHaveClass(/rp-win/);
  await expect(pop.locator('.rp-score')).toHaveAttribute('aria-label', /4 – 1 Anh Em Mỹ Đình/);
  await expect(pop).toContainText('Quang Còi ×2');
  await expect(pop.getByRole('button', { name: 'Khai báo bàn/kiến tạo' })).toBeVisible();
  await pop.locator('.rp-acts').getByRole('button', { name: 'Đóng' }).click();
  await expect(page.locator('.rp-overlay')).toHaveCount(0);

  // Đã xem → tải lại không hiện nữa, kể cả ở tab khác
  await page.goto('/t/t-domdom/lich');
  await hydrated(page);
  await page.waitForTimeout(500);
  await expect(page.locator('.rp-overlay')).toHaveCount(0);

  // Nhắc khai báo trên tab Đội (Quang Còi có Đi trận này) → "Không có" thì tắt hẳn
  await page.goto('/t/t-domdom/doi');
  await hydrated(page);
  const remind = page.locator('.claim-remind', { hasText: 'Anh Em Mỹ Đình' });
  await expect(remind).toContainText('Đội trưởng đang ghi cho bạn 2 bàn, 1 kiến tạo');
  await remind.getByRole('button', { name: 'Không có' }).click();
  await expect(remind).toHaveCount(0);
  await page.reload();
  await hydrated(page);
  await expect(page.locator('.claim-remind', { hasText: 'Anh Em Mỹ Đình' })).toHaveCount(0);
});
