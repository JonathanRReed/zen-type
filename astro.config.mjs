// @ts-check
import { defineConfig } from 'astro/config';
import image from '@astrojs/image';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  integrations: [
    react({
      babel: {
        plugins: ['babel-plugin-react-compiler']
      }
    }),
    tailwind({
      applyBaseStyles: false,
    }),
    image({
      serviceEntrypoint: '@astrojs/image/sharp'
    })
  ],
  vite: {
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'astro-vendor': ['astro'],
            'utils-vendor': ['../src/utils/storage', '../src/utils/quotes', '../src/utils/webvitals'],
          }
        }
      }
    }
  }
});
