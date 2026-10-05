import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Source-contract checks complement the rendered JSON-LD browser regression.
const home = readFileSync(new URL('../../pages/index.astro', import.meta.url), 'utf8');
const seo = readFileSync(new URL('../SEO.astro', import.meta.url), 'utf8');

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
