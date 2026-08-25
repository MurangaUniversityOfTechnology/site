# MUT Tech Community

The MUT Tech Community website — see `design/flow.md` and the interactive canvas at
`design/MUT Tech Community.dc.html` for the full product spec and screen designs.

## Stack

- `apps/web` — Next.js 16 (App Router, TypeScript, Tailwind)
- `apps/api` — FastAPI + PostgreSQL (SQLAlchemy, Alembic)
- `infra/` — Docker Compose for local dev and VPS deploy

Production deploys should override the default Postgres credentials — create `infra/.env`
(gitignored) with `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` before running
`docker compose up`. Without it, `docker-compose.yml` falls back to `mut`/`mut`/`mut`, which
is fine for local dev but must not be used on a real deploy.

## Local development

### Option A — Docker Compose (closest to production)

```bash
cd apps/api && cp .env.example .env   # fill in secrets, see below
cd ../web && cp .env.local.example .env.local
cd ../../infra
docker compose up -d --build
```

- Web: http://localhost:3000
- API: http://localhost:8000

### Option B — native (faster iteration)

```bash
# Postgres only, via Docker
cd infra && docker compose up -d db

# API
cd apps/api
python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"
cp .env.example .env   # SECRET_KEY: python3 -c "import secrets; print(secrets.token_hex(32))"
.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:app --reload --port 8000

# Web (separate terminal)
cd apps/web
cp .env.local.example .env.local
npm install
npm run dev
```

## Required credentials

None of these are required to run the public/auth skeleton locally — signup, sign-in,
and the dashboard all work with just Postgres and a `SECRET_KEY`. Each feature below is
gated on its own credentials being present; everything else keeps working without them.

**Google OAuth** (env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`)
— "Continue with Google" on sign-up/sign-in. Create an OAuth Client under
[Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials.
Redirect URI must exactly match `GOOGLE_REDIRECT_URI` (`.../auth/google/callback`).

**M-Pesa Daraja** (env: `MPESA_ENV`, `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`,
`MPESA_SHORTCODE`, `MPESA_PASSKEY`, `MPESA_CALLBACK_BASE_URL`) — membership payment via
STK push. Get sandbox credentials from the [Daraja portal](https://developer.safaricom.co.ke/).
`MPESA_CALLBACK_BASE_URL` must be a publicly reachable HTTPS URL — Safaricom's sandbox
can't reach `localhost`, so local testing needs a tunnel (ngrok or similar) pointed at
your API port.

**SMTP (Gmail)** (env: `SMTP_USERNAME`, `SMTP_PASSWORD`) — transactional email. Use a
Gmail [App Password](https://myaccount.google.com/apppasswords), not the account
password — Gmail rejects plain SMTP auth with the real one.

**GitHub** (env: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_REDIRECT_URI`,
`GITHUB_SYNC_TOKEN`, `GITHUB_ORG`) — two separate credentials, both under
`github.com/settings/developers` (OAuth App) and `github.com/settings/personal-access-tokens`
(fine-grained PAT):
- OAuth App for the member-facing "Connect GitHub" account-linking flow — Client ID/Secret,
  redirect URI must exactly match `GITHUB_REDIRECT_URI` (`.../auth/github/callback`).
- A fine-grained PAT for `GITHUB_SYNC_TOKEN`, used for two things: syncing project repo
  metadata/issues, and auto-inviting newly-active members to the GitHub org. **Resource
  owner must be the org itself, not your personal account** — otherwise the "Organization
  permissions" section never appears in GitHub's token creation UI and the org-invite
  feature silently can't work. Needs Repository permissions → `Issues: Read-only` (scoped
  to the tracked repos) and Organization permissions → `Members: Read and write`.
