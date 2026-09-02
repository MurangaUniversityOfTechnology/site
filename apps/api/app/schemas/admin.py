import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.models.profile import ExperienceLevel
from app.schemas.tag import TagRow


class AdminOverview(BaseModel):
    total_members: int
    new_this_week: int
    unmatched_payments: int


class MembershipApplication(BaseModel):
    user_id: uuid.UUID
    name: str
    email: str
    course: str | None
    year_of_study: int | None
    registration_number: str | None
    payment_amount: float | None
    payment_receipt: str | None
    payment_status: str | None
    membership_status: str
    is_admin: bool
    goals: list[str]
    experience_level: ExperienceLevel | None


class PaymentTotal(BaseModel):
    label: str
    amount_kes: float
    count: int


class PaymentRow(BaseModel):
    receipt: str | None
    source: str  # "membership" | "donation" — every M-Pesa STK push, not just membership
    who: str
    amount: float
    status: str
    created_at: datetime


class PaymentsOverview(BaseModel):
    totals: list[PaymentTotal]
    rows: list[PaymentRow]


class DonationRow(BaseModel):
    receipt: str | None
    donor: str
    reason: str
    amount: float
    status: str
    created_at: datetime


class DonationsOverview(BaseModel):
    totals: list[PaymentTotal]
    rows: list[DonationRow]


class AuditEntry(BaseModel):
    at: datetime
    who: str
    what: str
    kind: str


class AdminRow(BaseModel):
    user_id: uuid.UUID
    name: str
    email: str
    is_admin: bool
    tags: list[TagRow] = []


class AddMemberRequest(BaseModel):
    email: str
    display_name: str
    registration_number: str | None = None
    github_handle: str | None = None
    reason: str
    # Admin can set a password directly; leaving it blank falls back to an
    # auto-generated one-time password (the original behavior).
    password: str | None = Field(default=None, min_length=8, max_length=72)
    # "active" grants membership immediately for free (sponsor path, the
    # original behavior). "stk_push" sends a real M-Pesa request to `phone` —
    # the account exists right away, but membership only goes active once
    # they actually pay (same reconciliation path as self-service signup:
    # callback, or the STK Query fallback). "manual_receipt" is for a payment
    # that already happened outside the app (cash, paid to a till/agent
    # directly) — the admin records the M-Pesa receipt they were given and
    # membership activates immediately with a real Payment row attached.
    activation: Literal["active", "stk_push", "manual_receipt"] = "active"
    phone: str | None = None
    mpesa_receipt: str | None = Field(default=None, max_length=40)
    amount_kes: float | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def _phone_required_for_stk_push(self) -> "AddMemberRequest":
        if self.activation == "stk_push" and not self.phone:
            raise ValueError("phone is required when activation is 'stk_push'")
        if self.activation == "manual_receipt":
            if not self.phone:
                raise ValueError("phone is required when activation is 'manual_receipt'")
            if not self.mpesa_receipt or not self.mpesa_receipt.strip():
                raise ValueError("mpesa_receipt is required when activation is 'manual_receipt'")
        return self


class AddMemberResponse(BaseModel):
    user_id: uuid.UUID
    email: str
    temp_password: str | None
    membership_status: str


class ImportMemberRow(BaseModel):
    email: str
    display_name: str
    registration_number: str | None = None


class ImportMembersRequest(BaseModel):
    rows: list[ImportMemberRow] = Field(min_length=1, max_length=500)


class ImportMemberResult(BaseModel):
    email: str
    status: Literal["created", "error"]
    error: str | None = None


class ImportMembersResponse(BaseModel):
    results: list[ImportMemberResult]
