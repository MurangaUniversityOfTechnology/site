# apps/web

The MUT Tech Community frontend — Next.js 16 (App Router), TypeScript, Tailwind CSS v4.

For local dev setup (Docker vs. native), production domains, and required credentials, see
the [root README](../../README.md). This file covers the app itself.

## Running locally

```bash
cp .env.local.example .env.local
npm install
npm run dev
```

Open http://localhost:3000.

`NEXT_PUBLIC_API_URL` is normally left unset — `src/lib/api.ts` auto-detects the API host from
whatever hostname served the page (`localhost`, or a LAN IP when testing from a phone on the
same network), on port 8000. Set it explicitly only when the API lives on a different domain,
as it does in production (see root README's "Production domains & TLS").

## Structure

```
src/
  app/          route tree (App Router) — see below
  components/   shared React components, one file per component
  lib/          API client, hooks, and other non-UI helpers
```

### Routes (`src/app`)

Routes are flat, not grouped under route groups like `(public)`/`(admin)` — the split between
public/browsable pages and admin-only pages is enforced by each page checking `useMe()`/
`require_admin` server-side via the API, not by folder structure. Broadly:

- Public/member pages: `courses`, `events`, `projects`, `community`, `roadmaps`, `learn`,
  `members` (directory + per-member profile at `members/[id]`), `challenges`, `forms`, plus
  auth (`sign-in`, `sign-up`, `forgot-password`, `reset-password`, `verify-email`),
  membership (`membership/*`), and account (`dashboard`, `settings`, `notifications`).
- `admin/*` — staff/admin console: content moderation, courses, events, forms, roadmaps,
  members, roles, payments, donations, GitHub sync, audit log. Gated by `require_staff` /
  `require_admin` on the API side per-resource, not uniformly.
- `donate/*`, `membership/*` — M-Pesa STK push payment flows (pending/success/failed states
  as separate routes, since Daraja callbacks land asynchronously).

Nav is a deliberate split (see root project notes): a top bar carries public/browsable pages,
and a sidebar is used only inside `admin/*` — not an oversight, don't try to unify them.

### Key files in `src/lib`

- `api.ts` — the fetch wrapper (`apiFetch`/`apiUpload`) all client components use to talk to
  the API. Always sends `credentials: "include"` (session cookie). `ApiError` carries the
  HTTP status so callers can branch on 401/403/404 etc.
- `serverFetch.ts` — `fetchPublic()`, a plain unauthenticated GET for `generateMetadata` /
  `opengraph-image` files, which run server-side with no session cookie. Only use it on
  routes that are already public. Returns `null` on any non-2xx instead of throwing, so
  crawler preview fetches degrade to generic metadata rather than erroring.
- `useMe.tsx` — the current-user hook; wraps the `/profile/me` fetch and exposes
  `is_admin`/`is_staff`/tags for client-side gating (the API is still the source of truth —
  this only controls what renders, not what's authorized).
- `data.ts`, `eventFormat.ts`, `aiCoursePrompt.ts`, `nextParam.ts`, `og.tsx` — page-specific
  data shaping/formatting helpers.

## Testing & linting

```bash
npm run lint    # eslint
npm run test    # vitest run (jsdom + Testing Library)
npm run test:watch
```

Component tests live next to the component they test (e.g. `MobileNav.test.tsx`,
`JoinProjectPanel.test.tsx`), not in a separate `__tests__` tree.

## Build

```bash
npm run build
npm run start
```

`Dockerfile` builds the same way for the Docker Compose path — see the root README.
