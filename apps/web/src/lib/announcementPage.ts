/** The in-site path an announcement button leads to, or null for an outside
 * link. A full address on this same site (https://mutlabs.tech/forms/x) counts
 * as in-site, so it opens in the same tab and hides itself on its own page
 * just like a relative /forms/x does. */
export function sitePath(ctaUrl: string | null, origin: string | null): string | null {
  if (!ctaUrl) return null;
  if (ctaUrl.startsWith("/")) return ctaUrl;
  if (origin && ctaUrl.startsWith(`${origin}/`)) return ctaUrl.slice(origin.length);
  return null;
}

/** True when the visitor is already on the page the button leads to, so the
 * card or pill there would just point at where they already are. */
export function isOnAnnouncementTarget(pathname: string | null, ctaUrl: string | null, origin: string | null): boolean {
  const target = sitePath(ctaUrl, origin);
  if (!pathname || !target) return false;
  const trim = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p);
  return trim(pathname) === trim(target.split(/[?#]/)[0]);
}
