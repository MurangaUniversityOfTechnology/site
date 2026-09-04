import { API_URL } from "@/lib/api";

/**
 * Plain unauthenticated GET for generateMetadata / opengraph-image files —
 * those run server-side with no session cookie, but every route that uses
 * this is already a public page, so that's never a problem. Returns null on
 * any non-2xx (unknown slug, unpublished, etc.) so callers can fall back to
 * generic metadata instead of throwing during a crawler's preview fetch.
 */
/** Plain-text preview of a longer body — for content types (articles) that
 * don't have their own short description field. */
export function excerptOf(body: string, maxLength = 160): string {
  const flat = body.replace(/\s+/g, " ").trim();
  if (flat.length <= maxLength) return flat;
  return `${flat.slice(0, maxLength).trimEnd()}…`;
}

export async function fetchPublic<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
