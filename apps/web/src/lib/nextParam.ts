// Shared helper for "come back here after signing in" links. Every call site
// that sends a signed-out visitor to /sign-in (or Google OAuth) for an
// action — registering for an event, enrolling in a course, joining a
// project — should carry a `next` so auth lands them back where they were
// instead of dumping them on the dashboard.

// Only ever a same-origin relative path: rejects protocol-relative
// ("//evil.com") and backslash ("/\evil.com") tricks a browser or a lax
// redirect would still treat as absolute, since this value ends up in a
// server-issued redirect (the Google OAuth callback) as well as router.push.
export function isSafeNext(value: string | null | undefined): value is string {
  return !!value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\");
}

export function signInHref(next?: string | null): string {
  return isSafeNext(next) ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in";
}

export function signUpHref(next?: string | null): string {
  return isSafeNext(next) ? `/sign-up?next=${encodeURIComponent(next)}` : "/sign-up";
}
