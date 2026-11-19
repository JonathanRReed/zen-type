import { test, expect } from '@playwright/test';
import { readQuote, expectProgress, markSeen, open } from './helpers';

test.beforeEach(async ({ page }) => {
  await markSeen(page);
});

test('a tap on the quote opens typing, and the layout fits the phone', async ({ page }) => {
  await open(page, '/quote/');
  await expect(page.locator('.quote-tap-hint')).toBeVisible();
  await page.locator('astro-island .passage-text').tap();
  await expect(page.getByLabel('Type the quote shown here')).toBeFocused();
  await expect(page.locator('.quote-tap-hint')).toHaveCount(0);

  const text = await readQuote(page);
  await page.keyboard.type(text.slice(0, 8), { delay: 10 });
  await expectProgress(page, 8);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  // One row on a phone: the mark, the two modes, and four glyphs.
  const header = await page.locator('header.masthead').boundingBox();
  expect(header!.height).toBeLessThan(80);
  for (const name of ['New quote', /sound effects/, /toggle theme/, 'Open menu']) {
    await expect(page.locator('header.masthead').getByRole('button', { name })).toBeInViewport();
  }

  const bar = await page.getByRole('region', { name: 'Quote session statistics' }).boundingBox();
  const viewport = page.viewportSize()!;
  expect(bar!.y + bar!.height).toBeLessThanOrEqual(viewport.height);
  expect(bar!.y).toBeGreaterThan(viewport.height * 0.5);
});

test('composed input from an on-screen keyboard is handled', async ({ page }) => {
  await open(page, '/quote/');
  await page.locator('astro-island .passage-text').tap();
  const text = await readQuote(page);
  // Gboard-style: no key value on keydown, the text arrives on the input.
  await page.evaluate((chunk) => {
    const input = document.querySelector<HTMLInputElement>('input.quote-input')!;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Unidentified', keyCode: 229, bubbles: true }));
    input.value = chunk;
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: chunk }));
  }, text.slice(0, 5));
  await expectProgress(page, 5);
});

test('header controls keep a 40px target, in order, on one row at 400px', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 915 });
  await open(page, '/quote/');
  const header = page.locator('header.masthead');
  // Custom text lives in the menu at this width; everything else stays out.
  await expect(header.getByRole('button', { name: 'Custom text', exact: true })).toBeHidden();
  const controls = [
    header.getByRole('link', { name: 'Quote', exact: true }),
    header.getByRole('link', { name: 'Zen', exact: true }),
    header.getByRole('button', { name: 'New quote', exact: true }),
    header.getByRole('button', { name: 'Enable sound effects', exact: true }),
    header.getByRole('button', { name: 'Void theme, toggle theme', exact: true }),
    header.getByRole('button', { name: 'Open menu', exact: true }),
  ];
  let previousRight = 0;
  for (const control of controls) {
    await expect(control).toBeVisible();
    const box = (await control.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(40);
    expect(box.height).toBeGreaterThanOrEqual(40);
    expect(box.x).toBeGreaterThanOrEqual(previousRight);
    expect(box.x + box.width).toBeLessThanOrEqual(400);
    previousRight = box.x + box.width;
  }
  expect((await header.boundingBox())!.height).toBeLessThan(80);
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

test('the result fits a phone without anything on top of it', async ({ page }) => {
  await open(page, '/quote/');
  await page.locator('astro-island .passage-text').tap();
  const text = await readQuote(page);
  await page.keyboard.type(text, { delay: 4 });
  const next = page.getByRole('button', { name: /Next quote/ });
  await expect(next).toBeVisible();
  await next.scrollIntoViewIfNeeded();
  // If the stats line or footer sat over the button, this click would land on them.
  await next.click();
  await expect(page.locator('.result')).toHaveCount(0);
});
