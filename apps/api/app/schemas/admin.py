import uuid
from datetime import datetime

from pydantic import BaseModel


class AdminOverview(BaseModel):
    total_members: int
    pending_approval: int
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


class PaymentTotal(BaseModel):
    label: str
    amount_kes: float
    count: int


class PaymentRow(BaseModel):
    receipt: str | None
    member: str
    amount: float
    status: str


class PaymentsOverview(BaseModel):
    totals: list[PaymentTotal]
    rows: list[PaymentRow]


class AuditEntry(BaseModel):
    at: datetime
    who: str
    what: str
    kind: str
