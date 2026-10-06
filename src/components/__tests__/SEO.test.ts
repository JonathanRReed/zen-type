import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { resolve } from 'node:path';

// Source-contract checks complement the rendered JSON-LD browser regression.
const home = readFileSync(resolve(process.cwd(), 'src/pages/index.astro'), 'utf8');
const seo = readFileSync(resolve(process.cwd(), 'src/components/SEO.astro'), 'utf8');

test('the homepage does not opt an unrated app into software rich results', () => {
  assert.doesNotMatch(home, /["']@type["']\s*:\s*["'](?:SoftwareApplication|WebApplication|MobileApplication)["']/);
  assert.doesNotMatch(home + seo, /\b(?:aggregateRating|ratingValue|ratingCount|reviewCount)\s*:/);
});

test('the homepage retains shared website, page, creator, and breadcrumb metadata', () => {
  assert.match(home, /<SEO[\s\S]*?canonical=\{homeUrl\}/);
  for (const type of ['Person', 'WebSite', 'WebPage', 'BreadcrumbList']) {
    assert.ok(seo.includes(`"@type": "${type}"`), `${type} metadata must remain`);
  }
  assert.match(seo, /set:html=\{JSON\.stringify\(structuredData\)\}/);
  assert.match(seo, /<link rel="canonical" href=\{currentUrl\}/);
  assert.match(seo, /property="og:url" content=\{currentUrl\}/);
  assert.match(seo, /name="twitter:card" content=\{twitterCard\}/);
});
