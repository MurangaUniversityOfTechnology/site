from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routers import admin, auth, challenges, events, members, membership, notifications, profile

settings = get_settings()

app = FastAPI(title="MUT Tech Community API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.web_origin],
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


@app.get("/health")
def health():
    return {"status": "ok"}
