// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import { pageModifiedDate } from './src/utils/page-dates';
import { createLogger } from 'vite';

// @astrojs/react passes our babel-plugin-react-compiler choice through to
// vite:react-babel, which still sets the legacy `esbuild` /
// `optimizeDeps.esbuildOptions` keys internally. On the Rolldown-based Vite
// that only emits two known-harmless deprecation warnings (behavior is
// unchanged), so filter exactly those two messages instead of mutating the
// resolved config on every start (which also forced a dep re-optimize loop).
const viteLogger = createLogger();
const SILENCED_VITE_WARNINGS = [
  '`esbuild` option was specified by "vite:react-babel" plugin',
  '`optimizeDeps.esbuildOptions` option was specified by "vite:react-babel" plugin',
  'have set `optimizeDeps.esbuildOptions` but this option is now deprecated',
];
const originalViteWarn = viteLogger.warn.bind(viteLogger);
const originalViteWarnOnce = viteLogger.warnOnce.bind(viteLogger);
const silenceKnownBabelWarnings = (msg) => {
  if (typeof msg === 'string' && SILENCED_VITE_WARNINGS.some((known) => msg.includes(known))) {
    return;
  }
  originalViteWarn(msg);
};
viteLogger.warn = silenceKnownBabelWarnings;
viteLogger.warnOnce = silenceKnownBabelWarnings;

export default defineConfig({
  site: 'https://zentype.jonathanrreed.com',
  trailingSlash: 'always',
  build: {
    // 'auto' inlines only stylesheets under Vite's assetsInlineLimit. The big
    // Tailwind bundle stays a cacheable file; the tiny ones stop costing a
    // render-blocking round trip.
    inlineStylesheets: 'auto',
  },
  integrations: [
    react({
      babel: {
        plugins: ['babel-plugin-react-compiler']
      }
    }),
    tailwind({
      applyBaseStyles: false,
    }),
    sitemap({
      // Same committed dates the JSON-LD uses, so lastmod and dateModified
      // always say the same thing for a given URL.
      serialize(item) {
        return {
          ...item,
          lastmod: pageModifiedDate(new URL(item.url).pathname),
        };
      },
    })
  ],
  vite: {
    customLogger: viteLogger,
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              return 'react-vendor';
            }
            if (id.includes('node_modules/astro')) {
              return 'astro-vendor';
            }
            if (id.includes('/src/utils/')) {
              return 'utils-vendor';
            }
          }
        }
      }
    }
  }
});
