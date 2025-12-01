import { defineMiddleware } from 'astro/middleware';

export const onRequest = defineMiddleware(async (_context, next) => {
  // Pass through all requests - each page handles its own routing
  return next();
});
