import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { markSeen, open } from './helpers';

test.beforeEach(async ({ page }) => {
  await markSeen(page);
});

const PAGES = ['/', '/quote/', '/zen/', '/about/', '/whats-new/', '/privacy/', '/contact/'];

for (const path of PAGES) {
  test(`${path} has no serious accessibility violations`, async ({ page }) => {
    await page.goto(path);
    await page.waitForTimeout(600);
    const results = await new AxeBuilder({ page })
      .disableRules(['color-contrast'])
      .analyze();
    const serious = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
    expect(serious, JSON.stringify(serious.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), null, 2)).toEqual([]);
  });
}

test('every page has one h1, a canonical, and a description', async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(path);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`${path === '/' ? '/$' : path.replace(/\//g, '\\/')}`));
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description?.length ?? 0).toBeGreaterThan(40);
  }
});

test('the 404 page is real and noindexed', async ({ page }) => {
  const response = await page.goto('/this-does-not-exist/');
  expect(response?.status()).toBe(404);
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});

test('the What\'s new page links back into the app', async ({ page }) => {
  await page.goto('/whats-new/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Zen Typer 1.0');
  await expect(page.getByRole('link', { name: 'Quote mode' })).toHaveAttribute('href', '/quote/');
  await expect(page.getByRole('link', { name: 'Zen mode' })).toHaveAttribute('href', '/zen/');
});

test('the home page paints a quote before hydration', async ({ page }) => {
  await page.route('**/*.js', route => route.abort());
  await page.goto('/');
  await expect(page.locator('.quote-boot')).toBeVisible();
  await expect(page.locator('.quote-boot-text')).not.toBeEmpty();
});

test('Tab switches mode from the typing surface', async ({ page }) => {
  await open(page, '/quote/');
  await page.keyboard.press('Tab');
  await page.waitForURL('**/zen/');
  await expect(page.locator('[data-typing-surface="zen"]')).toBeFocused({ timeout: 10_000 });
  await page.keyboard.press('Tab');
  await page.waitForURL('**/quote/');
});

test('the homepage retains site metadata without unrated software-rich-result claims', async ({ page }) => {
  await page.goto('/');
  const nodes = await page.locator('script[type="application/ld+json"]').evaluateAll(scripts =>
    scripts.flatMap(script => {
      const data = JSON.parse(script.textContent || '');
      return Array.isArray(data) ? data : data['@graph'] || [data];
    }),
  );
  const serialized = JSON.stringify(nodes);
  expect(serialized).not.toMatch(/"(?:SoftwareApplication|WebApplication|MobileApplication)"/);
  expect(serialized).not.toMatch(/"(?:aggregateRating|review|ratingValue|ratingCount|reviewCount)"\s*:/);

  const origin = 'https://zentype.jonathanrreed.com/';
  expect(nodes.find(node => node['@type'] === 'WebSite')).toMatchObject({
    '@id': `${origin}#website`,
    name: 'Zen Typer',
    url: origin,
  });
  expect(nodes.find(node => node['@type'] === 'WebPage')).toMatchObject({
    '@id': `${origin}#webpage`,
    url: origin,
    isPartOf: { '@id': `${origin}#website` },
  });
  expect(nodes.find(node => node['@type'] === 'Person')).toMatchObject({
    '@id': `${origin}#creator`,
    name: 'Jonathan R. Reed',
  });
  expect(nodes.find(node => node['@type'] === 'BreadcrumbList')).toBeDefined();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', origin);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', origin);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', `${origin}og-image.png`);
});
