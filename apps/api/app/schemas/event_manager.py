import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class InviteManagerRequest(BaseModel):
    email: EmailStr


class EventManagerRow(BaseModel):
    id: uuid.UUID
    invited_email: str
    status: str
    invited_by: str
    created_at: datetime
    accepted_at: datetime | None


class InvitePreviewResponse(BaseModel):
    event_title: str
    event_slug: str
    invited_email: str
    invited_by: str
    status: str


class AcceptInviteResponse(BaseModel):
    event_slug: str


class WalkInRegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    email: EmailStr
    payment: str = "free"  # "free" | "stk_push" | "manual_receipt"
    phone: str | None = None
    mpesa_receipt: str | None = None
    amount_kes: float | None = None
