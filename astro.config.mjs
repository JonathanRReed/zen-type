// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import { pageModifiedDate } from './src/utils/page-dates';

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
