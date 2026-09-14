# apps/api

The MUT Tech Community backend — FastAPI + PostgreSQL (SQLAlchemy 2.0, Alembic), Python 3.12+.

For local dev setup (Docker vs. native), production database/domain setup, and required
third-party credentials, see the [root README](../../README.md). This file covers the app
itself.

## Running locally

```bash
python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"
cp .env.example .env   # SECRET_KEY: python3 -c "import secrets; print(secrets.token_hex(32))"
.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:app --reload --port 8000
```

Needs a reachable Postgres per `DATABASE_URL` in `.env` — see the root README's Option A/B
for running one locally. Everything runs with just `SECRET_KEY` and `DATABASE_URL` set; every
other credential in `.env.example` gates one optional feature (Google/GitHub OAuth, M-Pesa,
SMTP, Cloudinary uploads) and the rest of the app works fine without it.

Health check: `GET /health`.

## Structure

```
app/
  main.py       FastAPI app: CORS, rate limiting, router registration
  core/         config (Settings), db session, auth deps, security, rate limiting
  models/       SQLAlchemy models, one file per table
  schemas/      Pydantic request/response schemas, mirrors models/ roughly
  routers/      one file per resource — request handling only, delegates to services/
  services/     business logic (auth, payments, email, github sync, ...)
migrations/     Alembic — env.py + versions/
scripts/        one-off/seed scripts (courses, events, projects, roadmaps)
tests/
  unit/         pure-function tests, no DB
  integration/  full API + Postgres testcontainer
```

Routers are thin; put logic in `services/`, not in the router handler.

### Router ordering in `main.py`

A few routers register more specific paths that would otherwise be shadowed by another
router's catch-all `/{slug}` route (FastAPI matches in registration order). `event_manager`
must register before `events` for this reason — see the comment in `main.py`. If you add a
new router with a static path that could collide with an existing `/{slug}`-style route,
register it before that router too.

### Auth

Session-based, not bearer tokens: `POST /auth/sign-in` sets an HTTP-only `session` cookie
(JWT, see `core/security.py`), and `core/deps.py`'s `get_current_user` reads it back via
`Cookie`. `session_version` on the user row is bumped on password change/reset so existing
cookies invalidate immediately rather than waiting out the JWT's own expiry.

Authorization deps, one per role, layered on `get_current_user` — admins always qualify
for everything each of these gates:
- `require_admin` — full admin console access
- `require_staff` — scoped admin access (forms, courses, events)
- `require_chairperson` — whoever holds the "Chairperson" tag; gates the org
  Dean/Patron signature flow

## Database

Migrations are hand-reviewed after autogeneration, not applied blind:

```bash
.venv/bin/alembic revision --autogenerate -m "description"
# review the generated file in migrations/versions/ before applying
.venv/bin/alembic upgrade head
```

`migrations/versions/` is excluded from ruff (`pyproject.toml`) — those files carry Alembic's
own generated style, not this project's.

## Testing & linting

```bash
.venv/bin/pytest --cov=app --cov-report=term-missing
.venv/bin/ruff check .
```

Integration tests spin up a real `postgres:16-alpine` via `testcontainers` (needs Docker
running locally; GitHub Actions runners have it preinstalled) — there's no mocked-DB path.
External HTTP (M-Pesa, GitHub, SMTP) is mocked with `respx`/`monkeypatch` fixtures in
`tests/integration/conftest.py`, not real sandbox calls.

Env vars for tests are set in `tests/conftest.py`'s `pytest_configure`, not a fixture —
several modules read `get_settings()` at import time, so the vars must exist before the
first `app.*` import in the process.

## Seed scripts

`scripts/` holds one-off data seeders (courses, events, projects, roadmaps), run manually
against a local DB, e.g.:

```bash
.venv/bin/python scripts/seed_roadmaps.py
```

Not part of migrations or CI — for populating local/dev data, not schema changes.
