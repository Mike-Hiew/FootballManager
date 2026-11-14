import { expect, test } from '@playwright/test';
import { CAPTAIN, closeResultPopup, hydrated, login, openPlayerCard } from './helpers';

test('BRD 7.4 — ĐT đổi quỹ ↔ đá lẻ áp dụng ngay hoặc từ tháng sau', async ({ page }) => {
  await login(page, CAPTAIN);
  await page.goto('/t/t-domdom/cau-thu');
  await hydrated(page);
  await closeResultPopup(page);
  const card = page.locator('.pcard').filter({ has: page.locator('.who b', { hasText: /^Long Nhạc Trưởng/ }) });
  const open = () => openPlayerCard(page, /^Long Nhạc Trưởng/);

  // Chưa đổi thì không hỏi thời điểm áp dụng
  let dlg = await open();
  await expect(dlg.locator('.pay-from')).toHaveCount(0);
  await dlg.locator('#fPay').selectOption('le');
  const when = dlg.getByRole('group', { name: 'Áp dụng đổi sang đá lẻ' });
  await expect(when.getByRole('button', { name: 'Ngay (từ tháng này)' })).toHaveAttribute('aria-pressed', 'true');
  await when.getByRole('button', { name: 'Từ tháng sau' }).click();
  await expect(dlg.locator('.pay-from')).toContainText('Tháng này vẫn đóng quỹ');
  await dlg.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.locator('.toast')).toContainText('Đã lưu hồ sơ');
  await expect(card.locator('.pc-meta')).toContainText('Quỹ');
  await expect(card.locator('.pc-meta')).toContainText('→ Lẻ');

  // Đã hẹn tháng sau → đổi ý áp dụng ngay
  dlg = await open();
  await expect(dlg.getByRole('button', { name: 'Từ tháng sau' })).toHaveAttribute('aria-pressed', 'true');
  await dlg.getByRole('button', { name: 'Ngay (từ tháng này)' }).click();
  await dlg.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.locator('.toast')).toContainText('Đã lưu hồ sơ');
  await expect(card.locator('.chip.le')).toHaveText('Đá lẻ');
  await expect(card.locator('.pc-meta')).not.toContainText('→');

  // Trả lại quỹ ngay (dữ liệu như ban đầu cho test khác)
  dlg = await open();
  await dlg.locator('#fPay').selectOption('quy');
  await dlg.getByRole('button', { name: 'Ngay (từ tháng này)' }).click();
  await dlg.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(card.locator('.chip.quy')).toHaveText('Quỹ');
});

test('BRD 7.2 — ĐT yêu cầu đóng quỹ tháng cụ thể; thêm / sửa / xoá khoản thu chi', async ({ page }) => {
  await login(page, CAPTAIN);
  await page.goto('/t/t-domdom/quy');
  await hydrated(page);
  await closeResultPopup(page);

  // Chọn được các tháng cũ để đòi quỹ
  const sel = page.locator('#reqMonth');
  expect(await sel.locator('option').count()).toBe(15);
  const old = await sel.locator('option').nth(8).getAttribute('value');
  await sel.selectOption(old!);
  await page.getByRole('button', { name: /^Gửi yêu cầu/ }).click();
  await expect(page.locator('.toast')).toContainText(/Đã gửi yêu cầu đóng quỹ T\d+\/\d+ cho \d+ người/);

  const note = `Mua áo bib ${Date.now() % 100000}`;
  const form = page.getByRole('form', { name: 'Ghi khoản thu chi' });
  await form.getByRole('button', { name: 'Chi' }).click();
  await form.locator('#txAmt').fill('240000');
  await form.locator('#txNote').fill(note);
  await form.getByRole('button', { name: 'Ghi sổ' }).click();
  await expect(page.locator('.toast')).toContainText('Đã ghi chi');
  const row = page.locator('.ledger tr', { hasText: note });
  await expect(row.locator('.amt')).toContainText('240');

  await row.getByRole('button', { name: `Sửa khoản ${note}` }).click();
  const edit = page.getByRole('form', { name: 'Sửa khoản thu chi' });
  await expect(edit.locator('#txAmt')).toHaveValue('240000');
  await expect(edit.locator('#txAmt')).toBeFocused();
  await edit.locator('#txAmt').fill('200000');
  await edit.locator('#txNote').fill(`${note} (đã giảm)`);
  await edit.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.locator('.toast')).toContainText('Đã sửa khoản');
  const row2 = page.locator('.ledger tr', { hasText: `${note} (đã giảm)` });
  await expect(row2.locator('.amt')).toContainText('200');
  await expect(page.getByRole('form', { name: 'Ghi khoản thu chi' })).toBeVisible();

  const del = row2.getByRole('button', { name: `Xoá khoản ${note} (đã giảm)` });
  await del.click();
  await expect(del).toHaveText('Xác nhận xoá');
  await del.click();
  await expect(page.locator('.toast')).toContainText('Đã xoá khoản ghi tay');
  await expect(page.locator('.ledger tr', { hasText: note })).toHaveCount(0);
});
