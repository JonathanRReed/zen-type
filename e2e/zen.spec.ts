import { test, expect } from '@playwright/test';
import { localJSON, markSeen, open } from './helpers';

test.beforeEach(async ({ page }) => {
  await markSeen(page);
});

test('words commit on space, the stats bar counts them, and hiding the tab records the session', async ({ page }) => {
  await open(page, '/zen/');
  const input = page.getByLabel('Free-flow typing input');
  await expect(input).toBeFocused();
  await page.keyboard.type('still water runs ', { delay: 20 });
  await expect(input).toHaveValue('');

  const bar = page.getByRole('region', { name: 'Zen session statistics' });
  await expect(bar).toContainText('3', { timeout: 4000 });

  // Leave the tab: the session should land in history without a menu trip.
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const history = await localJSON<Array<{ mode: string; words: number }>>(page, 'zt.history');
  expect(history).toHaveLength(1);
  expect(history![0]).toMatchObject({ mode: 'zen', words: 3 });
});

test('the typed words are saved as a draft', async ({ page }) => {
  await open(page, '/zen/');
  await page.keyboard.type('a quiet line ', { delay: 20 });
  await page.waitForTimeout(1500);
  const body = await page.evaluate(async () => {
    const req = indexedDB.open('ZenTypeDrafts');
    const db = await new Promise<IDBDatabase>((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
    const tx = db.transaction('drafts', 'readonly');
    const all = await new Promise<Array<{ body: string }>>((resolve, reject) => {
      const r = tx.objectStore('drafts').getAll();
      r.onsuccess = () => resolve(r.result as Array<{ body: string }>);
      r.onerror = () => reject(r.error);
    });
    return all.map(d => d.body);
  });
  expect(body.some(b => b.startsWith('a quiet line'))).toBe(true);
});

test('reset session from the pause menu records and reloads', async ({ page }) => {
  await open(page, '/zen/');
  await page.keyboard.type('one two ', { delay: 20 });
  await page.keyboard.press('Escape');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Reset Session' }).click();
  await page.waitForLoadState('load');
  await expect.poll(async () => (await localJSON<unknown[]>(page, 'zt.history'))?.length ?? 0).toBe(1);
});

test('timed flow shows a countdown and can be turned off from settings', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zt.settings', JSON.stringify({ timedFlowMinutes: 3 }));
  });
  await open(page, '/zen/');
  await expect(page.locator('[data-flow-countdown]')).toBeVisible();
  await expect(page.locator('[data-flow-countdown]')).toContainText(/[0-9]:[0-5][0-9]/);
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('zt.settings') || '{}');
    localStorage.setItem('zt.settings', JSON.stringify({ ...raw, timedFlowMinutes: 0 }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'zt.settings' }));
  });
  await expect(page.locator('[data-flow-countdown]')).toHaveCount(0);
});
