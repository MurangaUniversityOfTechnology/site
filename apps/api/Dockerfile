FROM python:3.12-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /venv
ENV PATH="/venv/bin:$PATH"

COPY pyproject.toml ./
COPY app ./app
RUN pip install --no-cache-dir .

FROM python:3.12-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends libpq5 \
    && rm -rf /var/lib/apt/lists/* \
    && addgroup --system --gid 1001 api && adduser --system --uid 1001 --gid 1001 api

COPY --from=builder /venv /venv
COPY --chown=api:api app ./app
COPY --chown=api:api migrations ./migrations
COPY --chown=api:api alembic.ini ./

ENV PATH="/venv/bin:$PATH"
USER api

EXPOSE 8000
# --proxy-headers --forwarded-allow-ips='*': trusts X-Forwarded-For so
# request.client.host reflects the real internet client rather than Caddy's
# container IP — needed for app/core/deps.py's require_mpesa_ip check.
# Safe to trust any peer here specifically because this container is never
# reachable except through Caddy (no host port is published in production,
# see docker-compose.prod.yml / README) — nothing else can connect directly
# and inject a fake X-Forwarded-For. In local dev (docker-compose.local.yml
# publishes 8000 straight to the host, no proxy in front), there's simply no
# X-Forwarded-For header to trust, so this is a no-op there.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=*"]
