/// <reference types="vitest" />
import { defineConfig, createLogger } from 'vite';
import react from '@vitejs/plugin-react';

// Same dual-Vite situation as astro.config.mjs: @vitejs/plugin-react resolves
// the top-level Vite 7 copy and emits legacy `esbuild` keys, while the runner
// is Rolldown-based Vite 8. The keys are auto-converted by the compat layer,
// so these two warnings are noise — filter exactly them.
const viteLogger = createLogger();
const SILENCED = [
  '`esbuild` option was specified by "vite:react-babel" plugin',
  '`optimizeDeps.esbuildOptions` option was specified by "vite:react-babel" plugin',
  'have set `optimizeDeps.esbuildOptions` but this option is now deprecated',
];
const baseWarn = viteLogger.warn.bind(viteLogger);
const baseWarnOnce = viteLogger.warnOnce.bind(viteLogger);
viteLogger.warn = (msg, opts) => {
  if (typeof msg === 'string' && SILENCED.some((k) => msg.includes(k))) return;
  baseWarn(msg, opts);
};
viteLogger.warnOnce = (msg, opts) => {
  if (typeof msg === 'string' && SILENCED.some((k) => msg.includes(k))) return;
  baseWarnOnce(msg, opts);
};

export default defineConfig({
  customLogger: viteLogger,
  plugins: [
    react(),
    // Delete (don't just silence) the legacy keys the react plugin adds:
    // vitest already configures the modern `oxc` equivalents, so leaving both
    // set trips Vite's "both esbuild and oxc" warning. The per-plugin messages
    // this can't reach are handled by customLogger above.
    {
      name: 'zen-vite-test-compat',
      enforce: 'post',
      config(config) {
        if (config.optimizeDeps) {
          delete (config.optimizeDeps as Record<string, unknown>).esbuildOptions;
        }
        delete (config as Record<string, unknown>).esbuild;
      }
    }
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    css: true,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
