import uuid

from pydantic import BaseModel

from app.models.profile import ExperienceLevel


class MemberSummary(BaseModel):
    """Directory row — never includes bio/links/registration_number."""

    user_id: uuid.UUID
    display_name: str
    interests: list[str]
    experience_level: ExperienceLevel | None


class MemberProfile(BaseModel):
    """Full public profile — registration_number and email are never included."""

    user_id: uuid.UUID
    display_name: str
    bio: str | None
    interests: list[str]
    experience_level: ExperienceLevel | None
    goals: list[str]
    github_url: str | None
    linkedin_url: str | None
    photo_url: str | None
