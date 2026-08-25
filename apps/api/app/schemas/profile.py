from pydantic import BaseModel, Field

from app.models.profile import ExperienceLevel, ProfileVisibility


class OnboardingRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    display_name: str = Field(min_length=1, max_length=100)
    registration_number: str | None = None
    course: str | None = None
    year_of_study: int | None = Field(default=None, ge=1, le=8)
    interests: list[str] = Field(default_factory=list)
    experience_level: ExperienceLevel | None = None
    goals: list[str] = Field(default_factory=list)
    bio: str | None = Field(default=None, max_length=2000)
    github_url: str | None = None
    linkedin_url: str | None = None
    visibility: ProfileVisibility = ProfileVisibility.public


class ProfileResponse(BaseModel):
    """Self-view only (GET/PATCH /profile/me) — includes registration_number.
    The public member directory/profile endpoints use schemas/member.py instead."""

    first_name: str | None
    last_name: str | None
    display_name: str | None
    registration_number: str | None
    course: str | None
    year_of_study: int | None
    interests: list[str]
    experience_level: ExperienceLevel | None
    goals: list[str]
    bio: str | None
    photo_url: str | None
    github_url: str | None
    linkedin_url: str | None
    visibility: ProfileVisibility

    model_config = {"from_attributes": True}
