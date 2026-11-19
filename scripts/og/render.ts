// Render scripts/og/og.html to public/og-image.png at exactly 1200x630.
//
//   bun scripts/og/render.ts
//
// Scrapers for X, LinkedIn and Slack want a raster image for large cards, so
// the page is drawn in Chromium and saved as a PNG.

import { chromium } from '@playwright/test';
import { join } from 'node:path';

const root = process.cwd();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto(`file://${join(root, 'scripts', 'og', 'og.html')}`);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: join(root, 'public', 'og-image.png'), type: 'png' });
await browser.close();
console.log('wrote public/og-image.png');
