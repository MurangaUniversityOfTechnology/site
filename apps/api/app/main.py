from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import get_settings
from app.core.rate_limit import limiter
from app.routers import (
    admin,
    admin_courses,
    admin_events,
    admin_forms,
    admin_roadmaps,
    admin_roles,
    admin_uploads,
    auth,
    challenges,
    community,
    content,
    courses,
    donations,
    event_manager,
    events,
    forms,
    members,
    membership,
    notifications,
    org_signature,
    profile,
    projects,
    roadmaps,
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
app.include_router(org_signature.router)
app.include_router(admin.router)
app.include_router(admin_courses.router)
app.include_router(admin_events.router)
app.include_router(admin_forms.router)
app.include_router(admin_roadmaps.router)
app.include_router(admin_roles.router)
app.include_router(admin_uploads.router)
# event_manager's "/events/my-managed" and "/events/{slug}/manage/..." must be
# registered before events.router — otherwise events.router's "/events/{slug}"
# catch-all would match "/events/my-managed" first and 404 it as an unknown
# slug, same reasoning as courses.router's "/arms declared ahead of /{slug}".
app.include_router(event_manager.router)
app.include_router(event_manager.invites_router)
app.include_router(events.router)
app.include_router(challenges.router)
app.include_router(members.router)
app.include_router(notifications.router)
app.include_router(content.router)
app.include_router(projects.router)
app.include_router(donations.router)
app.include_router(courses.router)
app.include_router(forms.router)
app.include_router(community.router)
app.include_router(roadmaps.router)


@app.get("/health")
def health():
    return {"status": "ok"}
