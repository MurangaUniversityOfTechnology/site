import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ActivateMembershipRequest(BaseModel):
    phone: str = Field(min_length=9, max_length=15)


class PaymentStatusResponse(BaseModel):
    id: uuid.UUID
    status: str
    amount: float
    phone: str
    mpesa_receipt: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class MembershipStatusResponse(BaseModel):
    membership_status: str
    latest_payment: PaymentStatusResponse | None
