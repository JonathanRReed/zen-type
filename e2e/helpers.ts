import { expect, type Page } from '@playwright/test';

/**
 * Load an app page and wait until the islands have hydrated and the typing
 * surface holds focus. Keys pressed before that would land in a page that is
 * not listening yet, which is not what a person does.
 */
export async function open(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.locator('html[data-app-ready="1"]')).toHaveCount(1, { timeout: 15_000 });
  await expect(page.locator('[data-typing-surface]')).toBeFocused({ timeout: 10_000 });
}

/** The quote on screen, as plain text. */
export async function readQuote(page: Page): Promise<string> {
  await expect(page.locator('.quote-body .quote-char').first()).toBeVisible();
  const chars = await page.locator('.quote-body .quote-char').allTextContents();
  return chars.join('').replace(/\u00a0/g, ' ');
}

/** Type the whole quote through the keyboard, like a person would. */
export async function typeQuote(page: Page, text: string, delay = 4): Promise<void> {
  await page.keyboard.type(text, { delay });
}

export async function finishOneQuote(page: Page): Promise<string> {
  const text = await readQuote(page);
  await typeQuote(page, text);
  await expect(page.locator('.completion-pulse')).toBeVisible();
  return text;
}

export async function localJSON<T>(page: Page, key: string): Promise<T | null> {
  return page.evaluate((k) => {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as unknown) : null;
  }, key) as Promise<T | null>;
}

/** Skip the first-run hint so it never sits over the thing under test. */
export async function markSeen(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      const hints = JSON.parse(localStorage.getItem('zt.hints') || '{}');
      localStorage.setItem('zt.hints', JSON.stringify({ ...hints, firstRun: true }));
    } catch { /* ignore */ }
  });
}
