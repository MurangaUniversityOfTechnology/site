# MUT Tech Community

The MUT Tech Community website — see `design/flow.md` and the interactive canvas at
`design/MUT Tech Community.dc.html` for the full product spec and screen designs.

## Stack

- `apps/web` — Next.js 16 (App Router, TypeScript, Tailwind)
- `apps/api` — FastAPI + PostgreSQL (SQLAlchemy, Alembic)
- `infra/` — Docker Compose for local dev and VPS deploy

`infra/docker-compose.yml` (the file used in production) runs only `web` and `api` — it does
not run Postgres. `infra/docker-compose.local.yml` is a local-dev-only override that adds a
containerized Postgres and points `api` at it; it is never used on the server. See
"Production database" below for the VPS setup.

Local dev with the compose Postgres should override the default credentials — create
`infra/.env` (gitignored) with `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`. Without
it, the container falls back to `mut`/`mut`/`mut`, which is fine for local dev only.

## Local development

### Option A — Docker Compose (closest to production)

```bash
cd apps/api && cp .env.example .env   # fill in secrets, see below
cd ../web && cp .env.local.example .env.local
cd ../../infra
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```

- Web: http://localhost:3000
- API: http://localhost:8000

### Option B — native (faster iteration)

```bash
# Postgres only, via Docker
cd infra && docker compose -f docker-compose.yml -f docker-compose.local.yml up -d db

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

## Production database

The VPS runs its own system-level Postgres (outside Docker) rather than a second,
containerized instance — `infra/docker-compose.yml` deliberately has no `db` service.
One-time setup on the server:

```bash
sudo -u postgres psql -c "CREATE ROLE mut_tech WITH LOGIN PASSWORD '<generate a strong password>';"
sudo -u postgres psql -c "CREATE DATABASE mut_tech OWNER mut_tech;"
```

Then in `apps/api/.env` on the server, point `DATABASE_URL` at the host via
`host.docker.internal` (which `docker-compose.yml` maps to the host gateway), not `localhost`
— `localhost` inside the `api` container is the container itself:

```
DATABASE_URL=postgresql+psycopg://mut_tech:<password>@host.docker.internal:5432/mut_tech
```

Postgres also needs to accept that connection. `docker-compose.yml` pins the Docker
network to `172.28.0.0/24` (gateway `172.28.0.1`) specifically so this doesn't depend on a
host firewall being configured correctly — on a box with no `ufw`/`iptables`/`nftables`
in front of it, `listen_addresses = '*'` would put Postgres directly on the public
internet. Instead, bind only to loopback and that one gateway IP:

In `postgresql.conf`:
```
listen_addresses = 'localhost,172.28.0.1'
```

In `pg_hba.conf`, scoped to that same pinned subnet and this database/role only:
```
host    mut_tech    mut_tech    172.28.0.0/24    scram-sha-256
```

Then `sudo systemctl restart postgresql`. If the server does get a proper host firewall
installed later (recommended for SSH hardening etc. regardless), keep these scoped rules
as defense in depth rather than loosening them to `*`/`0.0.0.0/0`.

## Production domains & TLS

`infra/docker-compose.prod.yml` (applied on top of the base file in `infra/deploy.sh`) adds
a `caddy` service as the sole public entry point — `web` and `api` no longer publish ports
directly. Caddy reverse-proxies by domain and auto-provisions/renews Let's Encrypt certs,
per `infra/Caddyfile`:

- `mutlabs.tech` → `web:3000`
- `www.mutlabs.tech` → redirects to `mutlabs.tech`
- `api.mutlabs.tech` → `api:8000`

Requires, before the first deploy:
- DNS `A` records for `mutlabs.tech`, `www.mutlabs.tech`, and `api.mutlabs.tech` all pointing
  at the server's public IP (Caddy's ACME challenge needs these resolving publicly to issue
  certs — it'll retry/log errors otherwise, not crash the deploy).
- `ufw allow 80/tcp` and `ufw allow 443/tcp`; the earlier `3000`/`8000` rules can be removed
  (`sudo ufw delete allow 3000/tcp`, `sudo ufw delete allow 8000/tcp`) since nothing publishes
  those ports to the host in production anymore.
- `apps/api/.env`: `WEB_ORIGIN=https://mutlabs.tech`, `API_BASE_URL=https://api.mutlabs.tech`
  (CORS only allows one canonical web origin, hence the `www` redirect above rather than
  allowing both).
- `apps/web/.env.local`: `NEXT_PUBLIC_API_URL=https://api.mutlabs.tech`

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
