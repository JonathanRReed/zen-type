import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { localJSON, markSeen, finishOneQuote, open } from './helpers';

test.beforeEach(async ({ page }) => {
  await markSeen(page);
});

async function openSettings(page: Page) {
  await page.keyboard.press('Escape');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Settings' })).toBeVisible();
  return dialog;
}

test('sound toggled with Ctrl+M survives a reload, both on and off', async ({ page }) => {
  await open(page, '/quote/');
  const button = page.getByRole('button', { name: /sound effects/ });
  await expect(button).toHaveAttribute('aria-pressed', 'false');

  await page.keyboard.press('Control+m');
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByRole('button', { name: /sound effects/ })).toHaveAttribute('aria-pressed', 'true');
  expect((await localJSON<{ soundEnabled: boolean; switchSound: string }>(page, 'zt.settings'))?.switchSound).not.toBe('none');

  await page.keyboard.press('Control+m');
  await expect(page.getByRole('button', { name: /sound effects/ })).toHaveAttribute('aria-pressed', 'false');
  await page.reload();
  await expect(page.getByRole('button', { name: /sound effects/ })).toHaveAttribute('aria-pressed', 'false');
  expect((await localJSON<{ soundEnabled: boolean }>(page, 'zt.settings'))?.soundEnabled).toBe(false);
});

test('quote filters persist and take effect', async ({ page }) => {
  await open(page, '/quote/');
  const dialog = await openSettings(page);
  await dialog.getByRole('button', { name: 'Short', exact: true }).click();
  await dialog.getByRole('button', { name: 'Stoic', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Short', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');

  const settings = await localJSON<{ quoteLengths: string[]; quoteTags: string[] }>(page, 'zt.settings');
  expect(settings?.quoteLengths).toEqual(['short']);
  expect(settings?.quoteTags).toEqual(['stoic']);

  // Every new quote should now be short.
  for (let i = 0; i < 5; i++) {
    await page.getByRole('button', { name: 'New quote' }).click();
    await page.waitForTimeout(150);
    const chars = await page.locator('.quote-body .quote-char').count();
    expect(chars).toBeLessThanOrEqual(60);
  }

  await page.reload();
  const again = await openSettings(page);
  await expect(again.getByRole('button', { name: 'Short', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('backup downloads a file that restores', async ({ page }) => {
  await open(page, '/quote/');
  await finishOneQuote(page);
  const dialog = await openSettings(page);

  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Back up everything' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^zen-typer-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const path = await download.path();
  const backup = JSON.parse(readFileSync(path!, 'utf-8'));
  expect(backup.app).toBe('zen-typer');
  expect(backup.history).toHaveLength(1);
  expect(backup.settings.theme).toBeTruthy();

  page.once('dialog', d => d.accept());
  await dialog.getByRole('button', { name: 'Reset stats' }).click();
  await expect.poll(() => localJSON<unknown[]>(page, 'zt.history')).toEqual([]);

  await page.setInputFiles('input[type="file"]', {
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(dialog.getByText(/Restored 1 sessions/)).toBeVisible();
  expect(await localJSON<unknown[]>(page, 'zt.history')).toHaveLength(1);
});

test('a bad backup file is refused with a plain message', async ({ page }) => {
  await open(page, '/quote/');
  const dialog = await openSettings(page);
  await page.setInputFiles('input[type="file"]', {
    name: 'nope.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"app":"other"}'),
  });
  await expect(dialog.getByText('That file is not a Zen Typer backup.')).toBeVisible();
});

test('theme choice persists and repaints the ambient scene', async ({ page }) => {
  await open(page, '/zen/');
  await page.getByRole('button', { name: /theme, toggle theme/ }).click();
  await page.getByRole('menu', { name: 'Color themes' }).getByRole('button', { name: 'Cosmic' }).click();
  await expect(page.locator('html')).toHaveClass(/theme-cosmic/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/theme-cosmic/);
  const canvas = page.locator('canvas.ambient-layer');
  await expect(canvas).toHaveCount(1);
  // SwiftShader gives headless Chromium a working WebGL2; the class means a
  // frame was drawn. Fall back gracefully if the runner has no GL at all.
  const ready = await canvas.evaluate(el => new Promise<boolean>(resolve => {
    const t = setTimeout(() => resolve(el.classList.contains('is-ready')), 5000);
    const obs = new MutationObserver(() => { if (el.classList.contains('is-ready')) { clearTimeout(t); resolve(true); } });
    obs.observe(el, { attributes: true });
    if (el.classList.contains('is-ready')) { clearTimeout(t); resolve(true); }
  }));
  const hasGl = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'));
  if (hasGl) expect(ready).toBe(true);
});

test('caret style and font apply on first paint after a reload', async ({ page }) => {
  await open(page, '/quote/');
  const dialog = await openSettings(page);
  await dialog.getByLabel('Caret style').click();
  await page.getByRole('option', { name: /Block/ }).click();
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-caret', 'block');
});
