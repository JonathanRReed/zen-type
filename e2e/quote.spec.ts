import { test, expect } from '@playwright/test';
import { readQuote, typeQuote, finishOneQuote, expectProgress, localJSON, markSeen, open } from './helpers';

test.beforeEach(async ({ page }) => {
  await markSeen(page);
});

test('typing a quote to the end records a session and shows the result', async ({ page }) => {
  await open(page, '/quote/');
  const text = await readQuote(page);
  expect(text.length).toBeGreaterThan(10);

  await typeQuote(page, text);

  const card = page.locator('.result');
  await expect(card).toBeVisible();
  await expect(card.getByText('Accuracy')).toBeVisible();
  await expect(card.getByRole('button', { name: 'Type again' })).toBeVisible();

  // The stats line counts the finished quote once, not twice.
  const words = page.locator('.stats-bar .tally > div', { hasText: 'Words' }).locator('dd');
  await expect(words).toHaveText(String(Math.floor(text.length / 5)));

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
  await expect(page.locator('.passage-text .q-miss')).toHaveCount(1);
  await expectProgress(page, at + 1, 1);
  await page.keyboard.type(text.slice(at + 1, at + 3));
  await page.keyboard.press('Backspace');
  await expect(page.locator('.passage-text .q-miss')).toHaveCount(0);
  await expectProgress(page, at, 0);
  await typeQuote(page, text.slice(at));
  await expect(page.locator('.result')).toBeVisible();
  await expect(page.locator('.result')).toContainText('1 wrong key.');
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
  // Assert the application's focus contract; do not focus it here and mask a race.
  await expect(page.getByRole('textbox', { name: 'Type the quote shown here' })).toBeFocused();
  await typeQuote(page, text.slice(0, 2));
  await expectProgress(page, 2);
  // Separate lost input / clock-start failures from a missing pace marker.
  const stats = page.getByRole('region', { name: 'Quote session statistics' });
  await expect(stats.getByText(/^\d+:\d{2}$/)).not.toHaveText('0:00', { timeout: 4000 });
  await expect(page.locator('.passage-text .q-pace')).toHaveCount(1, { timeout: 4000 });
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
  await page.getByRole('button', { name: 'Custom text' }).click();
  const dialog = page.getByRole('dialog', { name: 'Type your own text' });
  await expect(dialog).toBeVisible();
  // Pasted text arrives with line breaks and typographic characters; what
  // lands on the page has to be typeable on a plain keyboard.
  await dialog.getByLabel('Text to practice').fill('Plain \u201Cwords\u201D\nto practice \u2014 on.');
  await dialog.getByRole('button', { name: 'Start typing' }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => readQuote(page)).toBe('Plain "words" to practice - on.');
  await expect(page.getByLabel('Type the quote shown here')).toBeFocused();
  await finishOneQuote(page);
  await expect(page.locator('astro-island .passage-credit')).toContainText('Your own text');
});

test('the sound hint appears once, after the first finished quote', async ({ page }) => {
  await open(page, '/quote/');
  await finishOneQuote(page);
  await expect(page.getByText('Sound is available')).toBeVisible();
  await page.getByRole('button', { name: 'Type again' }).click();
  await finishOneQuote(page);
  await expect(page.getByText('Sound is available')).toHaveCount(0);
});

test('Enter brings the next quote once one is finished, and does nothing before', async ({ page }) => {
  await open(page, '/quote/');
  const first = await readQuote(page);
  await page.keyboard.press('Enter');
  expect(await readQuote(page)).toBe(first);
  await finishOneQuote(page);
  await page.keyboard.press('Enter');
  await expect(page.locator('.result')).toHaveCount(0);
  await expect.poll(() => readQuote(page)).not.toBe(first);
  await expectProgress(page, 0, 0);
});

test('a wrong key does not reflow the passage, and the caret follows the cursor', async ({ page }) => {
  // Reduced motion makes the caret move without a transition, so its position
  // can be read straight away. Software WebGL draws too few frames a second
  // for a timed glide to be worth waiting on.
  await page.addInitScript(() => {
    localStorage.setItem('zt.settings', JSON.stringify({ reducedMotion: true }));
  });
  await open(page, '/quote/');
  const text = await readQuote(page);
  const passage = page.locator('astro-island .passage-text');
  const before = await passage.boundingBox();
  await typeQuote(page, text.slice(0, 3));
  await page.keyboard.type(text[3] === '~' ? '^' : '~');
  await expectProgress(page, 4, 1);
  const after = await passage.boundingBox();
  expect(after!.width).toBeCloseTo(before!.width, 0);
  expect(after!.height).toBeCloseTo(before!.height, 0);

  // The caret sits on the character about to be typed.
  const gap = await page.evaluate(() => {
    const caret = document.querySelector('.passage-caret')!.getBoundingClientRect();
    const now = document.querySelector('.passage-text .q-now')!.getBoundingClientRect();
    return Math.abs(caret.left - now.left);
  });
  expect(gap).toBeLessThan(6);
});

test('the source of the quote is shown under it', async ({ page }) => {
  await open(page, '/quote/');
  const credit = page.locator('astro-island .passage-credit');
  await expect(credit).toBeVisible();
  expect((await credit.textContent() ?? '').trim().length).toBeGreaterThan(3);
});
