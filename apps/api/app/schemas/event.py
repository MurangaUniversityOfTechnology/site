import uuid
from datetime import datetime, time
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, HttpUrl

from app.models.event import EventAudience


class RegisterRequest(BaseModel):
    guest_name: str | None = None
    guest_email: EmailStr | None = None
    # Required only when the event has a fee — see event.EventError raised
    # by services/event.py's register() otherwise.
    phone: str | None = None


class EventPaymentStatusResponse(BaseModel):
    id: uuid.UUID
    status: str
    amount: float
    mpesa_receipt: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class RegistrationResponse(BaseModel):
    id: uuid.UUID
    status: str
    created_at: datetime
    payment: EventPaymentStatusResponse | None = None

    model_config = {"from_attributes": True}


class AdminRegistrationRow(BaseModel):
    id: uuid.UUID
    name: str
    detail: str
    member: bool
    status: str
    payment_status: str | None = None


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


# ── reminder emails ──────────────────────────────────────────────────


class ReminderSettingsRow(BaseModel):
    day_before_enabled: bool
    day_before_time: time
    hour_before_enabled: bool
    hour_before_minutes: int
    include_pending: bool
    summary: str
    updated_at: datetime


class ReminderSettingsUpdate(BaseModel):
    day_before_enabled: bool | None = None
    day_before_time: time | None = None
    hour_before_enabled: bool | None = None
    hour_before_minutes: int | None = None
    include_pending: bool | None = None


class EventEmailRequest(BaseModel):
    audience: Literal["confirmed", "attended", "pending", "waitlisted", "everyone"]
    kind: Literal["reminder", "custom"]
    subject: str | None = Field(default=None, max_length=150)
    message: str | None = Field(default=None, max_length=5000)
    # Custom emails only: swaps the usual ticket/event button for this one,
    # e.g. a feedback form or slides after the event.
    link_url: HttpUrl | None = None
    link_label: str | None = Field(default=None, max_length=40)


class EventEmailResponse(BaseModel):
    queued: int
