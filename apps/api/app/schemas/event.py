import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr

from app.models.event import EventAudience


class RegisterRequest(BaseModel):
    guest_name: str | None = None
    guest_email: EmailStr | None = None


class RegistrationResponse(BaseModel):
    id: uuid.UUID
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminRegistrationRow(BaseModel):
    id: uuid.UUID
    name: str
    detail: str
    member: bool
    status: str


class ScheduleItem(BaseModel):
    time: str
    what: str


class EventSummary(BaseModel):
    slug: str
    title: str
    starts_at: datetime
    venue: str
    description: str
    audience: EventAudience
    fee_kes: int
    capacity: int | None
    seats_left: int | None

    model_config = {"from_attributes": True}


class EventDetail(EventSummary):
    what_youll_build: str | None
    schedule: list[ScheduleItem]
    speaker_name: str | None
    speaker_meta: str | None
    requirements: list[str]
    who_should_attend: str | None


class AdminEventRow(EventDetail):
    id: uuid.UUID
    registration_count: int
    archived_at: datetime | None


class EventWriteRequest(BaseModel):
    slug: str
    title: str
    starts_at: datetime
    venue: str
    description: str
    audience: EventAudience = EventAudience.open_to_all
    fee_kes: int = 0
    capacity: int | None = None
    what_youll_build: str | None = None
    schedule: list[ScheduleItem] = []
    speaker_name: str | None = None
    speaker_meta: str | None = None
    requirements: list[str] = []
    who_should_attend: str | None = None


class EventUpdateRequest(BaseModel):
    slug: str | None = None
    title: str | None = None
    starts_at: datetime | None = None
    venue: str | None = None
    description: str | None = None
    audience: EventAudience | None = None
    fee_kes: int | None = None
    capacity: int | None = None
    what_youll_build: str | None = None
    schedule: list[ScheduleItem] | None = None
    speaker_name: str | None = None
    speaker_meta: str | None = None
    requirements: list[str] | None = None
    who_should_attend: str | None = None
