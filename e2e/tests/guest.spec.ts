import { expect, test } from '@playwright/test';
import { OTHER_CAPTAIN, login } from './helpers';

test('11.1 #13 — khách xem đội khác: 4 tab, không Quỹ/SĐT/nút sửa; API sửa → 403', async ({ page }) => {
  await login(page, OTHER_CAPTAIN);
  await page.goto('/t/t-domdom/doi');
  await expect(page.getByText('ở chế độ chỉ xem')).toBeVisible();
  const tabs = page.locator('nav.tabs a');
  await expect(tabs).toHaveText([/Đội/, /Cầu thủ/, /Lịch đấu/, /Thống kê/, /Khám phá/]);
  await expect(page.getByRole('button', { name: 'Sửa thông tin đội' })).toHaveCount(0);
  const html = await page.content();
  expect(html).not.toMatch(/0901000\d{3}/);

  await page.goto('/t/t-domdom/quy');
  await expect(page).toHaveURL(/\/t\/t-domdom\/doi/);

  await page.goto('/t/t-domdom/cau-thu');
  await expect(page.getByRole('button', { name: '+ Thêm cầu thủ' })).toHaveCount(0);

  const origin = new URL(page.url()).origin;
  for (const [method, url, data] of [
    ['PATCH', '/api/teams/t-domdom', { name: 'Hack' }],
    ['POST', '/api/teams/t-domdom/matches', { date: '2030-01-01', opponent: 'x' }],
    ['PUT', '/api/teams/t-domdom/fund/fees', { monthlyFee: 1, perMatchFee: 1 }],
    ['PATCH', '/api/players/p9', { fullName: 'x' }],
    ['POST', '/api/matches/m4/mvp/open', {}],
    ['PUT', '/api/teams/t-domdom/lineup', { formation: '2-3-1', lineup: [] }],
  ] as const) {
    const r = await page.request.fetch(url, { method, data, headers: { origin } });
    expect(r.status(), `${method} ${url}`).toBe(403);
  }
  const fund = await page.request.get('/api/teams/t-domdom/fund');
  expect(fund.status()).toBe(403);
});
