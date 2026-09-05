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

/**
 * Pathname (with the trailing slash the site uses) to the date of the last
 * commit that changed that page's content.
 */
const PAGE_MODIFIED_DATES: Record<string, string> = {
  "/": "2026-09-04",
  "/404/": "2026-09-03",
  "/about/": "2026-09-04",
  "/contact/": "2026-08-04",
  "/privacy/": "2026-09-04",
  "/quote/": "2026-09-04",
  "/subprocessors/": "2026-09-04",
  "/whats-new/": "2026-09-04",
  "/zen/": "2026-09-04",
};

/**
 * Look up a page's date. Tolerates a missing trailing slash.
 *
 * An unlisted page throws instead of falling back to a default. Both callers
 * run at build time — the SEO component and the sitemap serializer — so a new
 * page with no entry here fails the build by name. A fallback would have been
 * worse than no date at all: the page would ship a wrong-but-plausible
 * dateModified in its schema and the same wrong lastmod in the sitemap, and
 * nothing would look broken enough to notice.
 */
export function pageModifiedDate(pathname: string): string {
  const key = pathname.endsWith("/") ? pathname : `${pathname}/`;
  const date = PAGE_MODIFIED_DATES[key];
  if (date === undefined) {
    const known = Object.keys(PAGE_MODIFIED_DATES).join(", ");
    throw new Error(
      `No modified date for "${key}". Add it to PAGE_MODIFIED_DATES in ` +
        `src/utils/page-dates.ts, set to the date that page's content last ` +
        `actually changed. Pages currently listed: ${known}.`,
    );
  }
  return date;
}
