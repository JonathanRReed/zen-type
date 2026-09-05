// Serve dist/ the way Cloudflare Pages does, in the foreground, for the
// browser tests. `astro preview` daemonizes on Astro 7, which Playwright's
// webServer cannot wait on.
//
//   bun scripts/serve-dist.ts 4326

import { join, extname } from 'node:path';
import { existsSync, statSync } from 'node:fs';

const port = Number(process.argv[2] ?? 4326);
const root = join(process.cwd(), 'dist');

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

const respond = (path: string, status = 200): Response => {
  const type = TYPES[extname(path)] ?? 'application/octet-stream';
  return new Response(Bun.file(path), { status, headers: { 'content-type': type, 'cache-control': 'no-store' } });
};

Bun.serve({
  port,
  hostname: '127.0.0.1',
  fetch(req) {
    const url = new URL(req.url);
    let pathname = decodeURIComponent(url.pathname);
    // The site uses trailing slashes; a bare directory path redirects like Pages does.
    const asDir = join(root, pathname);
    if (!pathname.endsWith('/') && existsSync(asDir) && statSync(asDir).isDirectory()) {
      return Response.redirect(`${url.origin}${pathname}/${url.search}`, 301);
    }
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = join(root, pathname);
    if (file.startsWith(root) && existsSync(file) && statSync(file).isFile()) {
      return respond(file);
    }
    const notFound = join(root, '404.html');
    return existsSync(notFound) ? respond(notFound, 404) : new Response('Not found', { status: 404 });
  },
});

console.log(`serving ${root} at http://127.0.0.1:${port}/`);
