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

COMPOSE="docker compose -p mut-tech -f infra/docker-compose.yml -f infra/docker-compose.prod.yml"

$COMPOSE build
$COMPOSE run --rm api alembic upgrade head
$COMPOSE up -d
docker image prune -f
