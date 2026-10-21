import uuid
from datetime import datetime
from urllib.parse import urlparse

from pydantic import BaseModel, Field, field_validator, model_validator


def _clean(value: str | None) -> str | None:
    value = value.strip() if value else None
    return value or None


def _check_cta_url(value: str | None) -> str | None:
    """Site-relative paths ("/membership") or http(s) links only — keeps
    javascript: and friends out of an href a visitor will click."""
    value = _clean(value)
    if value is None:
        return None
    if value.startswith("/") and not value.startswith("//"):
        return value
    parsed = urlparse(value)
    if parsed.scheme in ("http", "https") and parsed.netloc:
        return value
    raise ValueError("Link must start with / or https://")


class AnnouncementPublic(BaseModel):
    id: uuid.UUID
    title: str
    body: str | None
    cta_label: str | None
    cta_url: str | None

    model_config = {"from_attributes": True}


class AdminAnnouncementRow(AnnouncementPublic):
    is_active: bool
    starts_at: datetime | None
    ends_at: datetime | None
    # live | scheduled | ended | off — what a visitor would see right now
    state: str
    created_at: datetime


class AnnouncementWriteRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    body: str | None = Field(default=None, max_length=400)
    cta_label: str | None = Field(default=None, max_length=40)
    cta_url: str | None = Field(default=None, max_length=500)
    is_active: bool = True
    starts_at: datetime | None = None
    ends_at: datetime | None = None

    @field_validator("body", "cta_label")
    @classmethod
    def _trim(cls, v: str | None) -> str | None:
        return _clean(v)

    @field_validator("cta_url")
    @classmethod
    def _url(cls, v: str | None) -> str | None:
        return _check_cta_url(v)

    @model_validator(mode="after")
    def _consistent(self):
        if bool(self.cta_label) != bool(self.cta_url):
            raise ValueError("Give the button both a label and a link, or neither")
        if self.starts_at and self.ends_at and self.ends_at <= self.starts_at:
            raise ValueError("End must be after start")
        return self


class AnnouncementUpdateRequest(AnnouncementWriteRequest):
    """Full replace — the admin form always sends every field."""
