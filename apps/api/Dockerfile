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
# --proxy-headers: trusts X-Forwarded-For so request.client.host reflects the
# real internet client rather than Caddy's container IP — needed for
# app/core/deps.py's require_mpesa_ip check. Which peer is trusted comes from
# the FORWARDED_ALLOW_IPS env var (uvicorn reads it natively):
# infra/docker-compose.prod.yml sets it to the shared Caddy's pinned address
# only. Not `*` — on the VPS's shared `edge` network other apps' containers
# can reach this one directly and could otherwise inject a fake
# X-Forwarded-For. Unset (local dev, no proxy in front) it defaults to
# 127.0.0.1, which never matches, so there's nothing to spoof there either.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
