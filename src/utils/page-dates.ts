/**
 * When each page's content last actually changed, written down by hand.
 *
 * These have to be literals. Cloudflare Pages builds from a shallow clone, so
 * reading git at build time gives you nothing, and `new Date()` gives you the
 * build clock, which means an unchanged page gets a fresh date every deploy.
 * Both of those turn "modified" into noise. A committed literal survives a
 * rebuild byte for byte, which is the whole point.
 *
 * Schema `dateModified` and the sitemap's `lastmod` both read from here, so the
 * two signals can't drift apart.
 *
 * When you change what a page says, change its date in the same commit.
 */

/** Fallback for a page that isn't listed here yet. Still a literal. */
export const DEFAULT_MODIFIED_DATE = "2026-08-06";

/**
 * Pathname (with the trailing slash the site uses) to the date of the last
 * commit that changed that page's content.
 */
export const PAGE_MODIFIED_DATES: Record<string, string> = {
  "/": "2026-08-06",
  "/about/": "2026-08-04",
  "/contact/": "2026-08-04",
  "/privacy/": "2026-08-04",
  "/quote/": "2026-08-05",
  "/subprocessors/": "2026-06-19",
  "/zen/": "2026-08-05",
};

/** Look up a page's date. Tolerates a missing trailing slash. */
export function pageModifiedDate(pathname: string): string {
  const key = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return PAGE_MODIFIED_DATES[key] ?? DEFAULT_MODIFIED_DATE;
}
