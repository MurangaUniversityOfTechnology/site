from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import get_settings
from app.core.rate_limit import limiter
from app.routers import (
    admin,
    auth,
    challenges,
    content,
    events,
    members,
    membership,
    notifications,
    profile,
    projects,
)

settings = get_settings()

app = FastAPI(title="MUT Tech Community API")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

cors_origins = [settings.web_origin]
if settings.lan_web_origin:
    cors_origins.append(settings.lan_web_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(membership.router)
app.include_router(profile.router)
app.include_router(admin.router)
app.include_router(events.router)
app.include_router(challenges.router)
app.include_router(members.router)
app.include_router(notifications.router)
app.include_router(content.router)
app.include_router(projects.router)


@app.get("/health")
def health():
    return {"status": "ok"}
