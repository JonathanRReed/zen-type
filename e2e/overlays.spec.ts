import { test, expect } from '@playwright/test';
import { finishOneQuote, markSeen, open } from './helpers';

test.beforeEach(async ({ page }) => {
  await markSeen(page);
});

test('Escape opens the pause menu, Tab stays inside it, Escape closes it', async ({ page }) => {
  await open(page, '/quote/');
  await page.keyboard.press('Escape');
  const dialog = page.getByRole('dialog', { name: 'Paused' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Resume' })).toBeVisible();

  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
    expect(inside).toBe(true);
  }

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel('Type the quote shown here')).toBeFocused();
});

test('Ctrl+H opens the help sheet and Escape closes only the sheet', async ({ page }) => {
  await open(page, '/zen/');
  await page.keyboard.press('Control+h');
  const sheet = page.getByRole('dialog', { name: 'Keyboard Shortcuts' });
  await expect(sheet).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('Progress is empty at first and fills in after a quote', async ({ page }) => {
  await open(page, '/quote/');
  await page.keyboard.press('Control+p');
  const dialog = page.getByRole('dialog', { name: 'Progress' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Nothing here yet');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  await finishOneQuote(page);
  await page.getByRole('button', { name: 'Progress' }).click();
  const filled = page.getByRole('dialog', { name: 'Progress' });
  await expect(filled).toBeVisible();
  await expect(filled).toContainText('Days practiced');
  await expect(filled).toContainText('Recent');
  await expect(filled.locator('.progress-cell.level-4')).toHaveCount(1);
});

test('Notes and drafts open with Ctrl+D and close with Escape', async ({ page }) => {
  await open(page, '/zen/');
  await page.keyboard.press('Control+d');
  await expect(page.getByRole('dialog').first()).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('the first-run hint shows once', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await open(page, '/zen/');
  await expect(page.locator('.first-run-hint')).toBeVisible();
  await page.reload();
  await expect(page.locator('.first-run-hint')).toHaveCount(0);
  await context.close();
});
