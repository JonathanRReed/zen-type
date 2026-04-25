// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://zentype.jonathanrreed.com',
  trailingSlash: 'always',
  integrations: [
    react({
      babel: {
        plugins: ['babel-plugin-react-compiler']
      }
    }),
    tailwind({
      applyBaseStyles: false,
    }),
    sitemap()
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
