#!/usr/bin/env bash
# Run on the server by .github/workflows/deploy.yml over SSH.
# Assumes the repo is already cloned at this path with 'origin' set up
# and apps/api/.env / apps/web/.env.local already in place. Postgres runs
# outside Docker here — apps/api/.env's DATABASE_URL must point at it
# (see README's "Production database" section). infra/.env is only used
# by the local-dev override (docker-compose.local.yml), not here.
set -euo pipefail
cd "$(dirname "$0")/.."

git fetch origin main
git reset --hard origin/main

# Next.js bakes NEXT_PUBLIC_* vars in at build time, and the web Dockerfile
# can't read apps/web/.env.local directly (excluded from the build context
# by .dockerignore on purpose) — so pull it out here and pass it as a build
# arg instead. See infra/docker-compose.yml's web.build.args.
export NEXT_PUBLIC_API_URL
NEXT_PUBLIC_API_URL=$(grep -E '^NEXT_PUBLIC_API_URL=' apps/web/.env.local | tail -1 | cut -d= -f2-)
if [ -z "$NEXT_PUBLIC_API_URL" ]; then
  echo "NEXT_PUBLIC_API_URL not set in apps/web/.env.local — refusing to build with it empty" >&2
  exit 1
fi

COMPOSE="docker compose -p mut-tech -f infra/docker-compose.yml -f infra/docker-compose.prod.yml"

$COMPOSE build
$COMPOSE run --rm api alembic upgrade head
$COMPOSE up -d
docker image prune -f
