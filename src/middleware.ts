import { defineMiddleware } from 'astro/middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  const p = context.url.pathname;

  // Serve Quote Mode content at root without redirect (no visible navigation)
  if (p === '/' || p === '/index' || p === '/index.html') {
    return context.rewrite('/quote');
  }

  return next();
});
