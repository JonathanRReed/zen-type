import { defineMiddleware } from 'astro/middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  const p = context.url.pathname;

  // Make Quote Mode the default without creating an index page
  if (p === '/' || p === '/index' || p === '/index.html') {
    return context.redirect('/quote', 307);
  }

  return next();
});
