import { defineConfig, devices } from '@playwright/test';

// End-to-end flows against the production build in dist/, served by a small
// static server (scripts/serve-dist.ts) that behaves like Cloudflare Pages.
// `bun run test:e2e` builds first; set E2E_SKIP_BUILD=1 to reuse dist/.
const PORT = 4326;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 4,
  reporter: [['list']],
  timeout: 45_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    // Headless Chromium draws WebGL through SwiftShader, so the ambient
    // layer is exercised for real rather than skipped.
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } }, testIgnore: /mobile\.spec\.ts/ },
    { name: 'phone', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: process.env.E2E_SKIP_BUILD
      ? `bun scripts/serve-dist.ts ${PORT}`
      : `bun run build && bun scripts/serve-dist.ts ${PORT}`,
    url: `http://127.0.0.1:${PORT}/`,
    // Reusing a leftover server would test whatever build it happened to be
    // serving. Only allow it when the build was deliberately skipped.
    reuseExistingServer: !!process.env.E2E_SKIP_BUILD,
    timeout: 180_000,
  },
});
