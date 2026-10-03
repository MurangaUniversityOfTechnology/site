#!/usr/bin/env bash
# Run on the server by .github/workflows/deploy.yml over SSH.
# Assumes the repo is already cloned at this path with 'origin' set up
# and apps/api/.env / apps/web/.env.local already in place. Postgres runs
# outside Docker here — apps/api/.env's DATABASE_URL must point at it
# (see README's "Production database" section). infra/.env is only used
# by the local-dev override (docker-compose.local.yml), not here.
set -euo pipefail
SELF=$(realpath "$0")
cd "$(dirname "$SELF")/.."

# Bash reads a script as it runs, so after the reset below it would carry on
# executing this file's *old* contents — a change to the deploy steps would
# only take effect one deploy late. Re-exec the freshly checked-out copy.
if [ "${DEPLOY_UPDATED:-}" != 1 ]; then
  git fetch origin main
  git reset --hard origin/main
  DEPLOY_UPDATED=1 exec bash "$SELF" "$@"
fi

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

# The shared `edge` network the VPS's Caddy (github.com/Byte-Barn/vps-infra)
# routes through. Kept identical to that repo's scripts/ensure-network.sh so
# whichever deploys first on a fresh server creates it.
docker network inspect edge >/dev/null 2>&1 ||
  docker network create --driver bridge --subnet 172.30.0.0/24 --gateway 172.30.0.1 edge

COMPOSE="docker compose -p mut-tech -f infra/docker-compose.yml -f infra/docker-compose.prod.yml"

# --no-cache: Compose's build cache doesn't reliably invalidate on a changed
# --build-arg value (seen firsthand — it reused a layer built before
# NEXT_PUBLIC_API_URL was wired up, silently baking in an empty value).
# Deploys aren't frequent enough for the slower rebuild to matter.
$COMPOSE build --no-cache
$COMPOSE run --rm api alembic upgrade head
$COMPOSE up -d
docker image prune -f
