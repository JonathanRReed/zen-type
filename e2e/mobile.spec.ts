import { test, expect } from '@playwright/test';
import { readQuote, markSeen, open } from './helpers';

test.beforeEach(async ({ page }) => {
  await markSeen(page);
});

test('a tap on the quote opens typing, and the layout fits the phone', async ({ page }) => {
  await open(page, '/quote/');
  await expect(page.locator('.quote-tap-hint')).toBeVisible();
  await page.locator('.quote-stage .quote-card').tap();
  await expect(page.getByLabel('Type the quote shown here')).toBeFocused();
  await expect(page.locator('.quote-tap-hint')).toHaveCount(0);

  const text = await readQuote(page);
  await page.keyboard.type(text.slice(0, 8), { delay: 10 });
  await expect(page.locator('.quote-char.correct')).toHaveCount(8);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  const header = await page.locator('header').boundingBox();
  expect(header!.height).toBeLessThan(90);

  const bar = await page.getByRole('region', { name: 'Quote session statistics' }).boundingBox();
  const viewport = page.viewportSize()!;
  expect(bar!.y + bar!.height).toBeLessThanOrEqual(viewport.height);
  expect(bar!.y).toBeGreaterThan(viewport.height * 0.5);
});

test('composed input from an on-screen keyboard is handled', async ({ page }) => {
  await open(page, '/quote/');
  await page.locator('.quote-stage .quote-card').tap();
  const text = await readQuote(page);
  // Gboard-style: no key value on keydown, the text arrives on the input.
  await page.evaluate((chunk) => {
    const input = document.querySelector<HTMLInputElement>('input.quote-input')!;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Unidentified', keyCode: 229, bubbles: true }));
    input.value = chunk;
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: chunk }));
  }, text.slice(0, 5));
  await expect(page.locator('.quote-char.correct')).toHaveCount(5);
});

test('zen mode fits and the input sits above the fold', async ({ page }) => {
  await open(page, '/zen/');
  const input = page.getByLabel('Free-flow typing input');
  const box = await input.boundingBox();
  const viewport = page.viewportSize()!;
  expect(box!.y + box!.height).toBeLessThan(viewport.height);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
