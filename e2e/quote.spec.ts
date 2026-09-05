import { test, expect } from '@playwright/test';
import { readQuote, typeQuote, finishOneQuote, localJSON, markSeen, open } from './helpers';

test.beforeEach(async ({ page }) => {
  await markSeen(page);
});

test('typing a quote to the end records a session and shows the card', async ({ page }) => {
  await open(page, '/quote/');
  const text = await readQuote(page);
  expect(text.length).toBeGreaterThan(10);

  await typeQuote(page, text);

  const card = page.locator('.completion-pulse');
  await expect(card).toBeVisible();
  await expect(card.getByText('Accuracy')).toBeVisible();
  await expect(card.getByRole('button', { name: 'Type again' })).toBeVisible();

  const history = await localJSON<Array<{ mode: string; wpm?: number; accuracy?: number; quoteId?: string }>>(page, 'zt.history');
  expect(history).toHaveLength(1);
  expect(history![0]!.mode).toBe('quote');
  expect(history![0]!.accuracy).toBe(100);
  expect(history![0]!.quoteId).toBeTruthy();

  const stats = await localJSON<{ sessionsCompleted: number; bestWpm: number }>(page, 'zt.stats');
  expect(stats?.sessionsCompleted).toBe(1);
  expect(stats?.bestWpm).toBeGreaterThan(0);
});

test('a wrong key is marked, backspace rewinds to it, and the sitting tallies the mistake', async ({ page }) => {
  await open(page, '/quote/');
  const text = await readQuote(page);
  // Miss on a letter, not a space: a letter typed where a space belongs is
  // counted as an "extra", which is a different bucket.
  const at = text.search(/[a-z]/i) === 0 ? text.slice(1).search(/[a-z]/i) + 1 : text.search(/[a-z]/i);
  await typeQuote(page, text.slice(0, at));
  await page.keyboard.type(text[at] === 'z' ? 'q' : 'z');
  await expect(page.locator('.quote-char.error')).toHaveCount(1);
  await page.keyboard.type(text.slice(at + 1, at + 3));
  await page.keyboard.press('Backspace');
  await expect(page.locator('.quote-char.error')).toHaveCount(0);
  await expect(page.locator('.quote-char.correct')).toHaveCount(at);
  await typeQuote(page, text.slice(at));
  await expect(page.locator('.completion-pulse')).toBeVisible();
  await expect(page.locator('.completion-pulse')).toContainText('Wrong key: 1');
});

test('new quote loads a different quote and the target pace marker shows when set', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zt.settings', JSON.stringify({ targetWpm: 40 }));
  });
  await open(page, '/quote/');
  const first = await readQuote(page);
  await page.getByRole('button', { name: 'New quote' }).click();
  await expect.poll(() => readQuote(page)).not.toBe(first);
  const text = await readQuote(page);
  await typeQuote(page, text.slice(0, 2));
  await expect(page.locator('.quote-char.ghost-pacer')).toHaveCount(1, { timeout: 4000 });
});

test('the live stats bar updates while typing', async ({ page }) => {
  await open(page, '/quote/');
  const text = await readQuote(page);
  await typeQuote(page, text.slice(0, 12));
  const bar = page.getByRole('region', { name: 'Quote session statistics' });
  await expect(bar).toContainText('100%');
  await expect(bar).toContainText('Words');
});

test('custom text replaces the quote', async ({ page }) => {
  await open(page, '/quote/');
  page.once('dialog', dialog => dialog.accept('Plain words to practise on.'));
  await page.getByRole('button', { name: 'Practice custom text' }).click();
  await expect.poll(() => readQuote(page)).toBe('Plain words to practise on.');
  await finishOneQuote(page);
});

test('the sound hint appears once, after the first finished quote', async ({ page }) => {
  await open(page, '/quote/');
  await finishOneQuote(page);
  await expect(page.getByText('Sound is available')).toBeVisible();
  await page.getByRole('button', { name: 'Type again' }).click();
  await finishOneQuote(page);
  await expect(page.getByText('Sound is available')).toHaveCount(0);
});
