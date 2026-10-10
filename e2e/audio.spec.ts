import { test, expect, type Page } from '@playwright/test';
import { markSeen, open } from './helpers';

async function observeAudio(page: Page) {
  await page.addInitScript(() => {
    const state = window as unknown as { audioContexts: AudioContext[] };
    state.audioContexts = [];
    window.AudioContext = new Proxy(window.AudioContext, {
      construct(target, args) {
        const context = Reflect.construct(target, args) as AudioContext;
        state.audioContexts.push(context);
        return context;
      },
    });
  });
}
const contexts = (page: Page) => page.evaluate(() =>
  (window as unknown as { audioContexts: AudioContext[] }).audioContexts.map(context => context.state));

test.beforeEach(async ({ page }) => {
  await markSeen(page);
  await observeAudio(page);
});

for (const mode of ['normal', 'reduced motion', 'performance mode']) {
  test(`muted typing creates no audio context in ${mode}`, async ({ page }) => {
    if (mode === 'reduced motion') await page.emulateMedia({ reducedMotion: 'reduce' });
    if (mode === 'performance mode') await page.addInitScript(() => {
      localStorage.setItem('zt.settings', JSON.stringify({ performanceMode: true }));
    });
    await open(page, '/zen/');
    await page.keyboard.type('Quiet practice builds a steady rhythm.');
    await expect(page.getByLabel('Free-flow typing input')).toHaveValue('rhythm.');
    expect(await contexts(page)).toEqual([]);
  });
}

test('sound enable gestures, repeated toggles, navigation and saved enabled settings unlock real audio', async ({ page }) => {
  await open(page, '/zen/');
  await page.getByRole('button', { name: 'Enable sound effects', exact: true }).click();
  await expect.poll(() => contexts(page)).toEqual(['running']);
  await page.getByRole('button', { name: 'Mute sound effects', exact: true }).click();
  await page.keyboard.press('Control+m');
  await expect(page.getByRole('button', { name: 'Mute sound effects', exact: true })).toBeVisible();
  await expect.poll(() => contexts(page)).toEqual(['running']);

  await page.getByRole('link', { name: 'Quote', exact: true }).click();
  await expect(page.locator('html[data-app-ready="1"]')).toHaveCount(1);
  await page.keyboard.type('a');
  await expect.poll(() => contexts(page)).toEqual(['running']);

  await page.reload();
  await expect(page.locator('html[data-app-ready="1"]')).toHaveCount(1);
  expect(await contexts(page)).toEqual([]);
  await page.keyboard.type('a');
  await expect.poll(() => contexts(page)).toEqual(['running']);
});
