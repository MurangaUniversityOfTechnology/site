# MUT Tech Community

The MUT Tech Community website — see `design/flow.md` and the interactive canvas at
`design/MUT Tech Community.dc.html` for the full product spec and screen designs.

## Stack

- `apps/web` — Next.js 16 (App Router, TypeScript, Tailwind)
- `apps/api` — FastAPI + PostgreSQL (SQLAlchemy, Alembic)
- `infra/` — Docker Compose for local dev and VPS deploy

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

See the credentials checklist in the build plan for the full list (Google OAuth, M-Pesa
Daraja, transactional email provider, GitHub). None are required to run the public/auth
skeleton locally — signup, sign-in, and the placeholder dashboard work with just Postgres.
