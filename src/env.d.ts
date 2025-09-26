/// <reference types="astro/client" />

import type { CssVariable } from 'astro:assets';

declare module 'virtual:astro:assets/fonts/internal' {
  interface FontPreloadData {
    url: string;
    type: string;
  }

  interface FontConsumable {
    css: string;
    preloadData: FontPreloadData[];
  }

  export const internalConsumableMap: Map<CssVariable, FontConsumable>;
}
