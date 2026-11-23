import re
import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.models.donation import DonationReason


_TAG_RE = re.compile(r"<[^>]*>?")
_CTRL_RE = re.compile(r"[\x00-\x08\x0b-\x1f\x7f]")


def _clean_text(v: str) -> str:
    """Strip HTML tags and control chars so stored text is safe even if it
    later lands in an email, export or non-React view."""
    return _CTRL_RE.sub("", _TAG_RE.sub("", v))


class CreateDonationRequest(BaseModel):
    amount: int = Field(ge=20, le=150_000)
    phone: str = Field(min_length=9, max_length=15)
    reason: DonationReason
    donor_name: str | None = Field(default=None, max_length=80)
    is_anonymous: bool = False
    message: str | None = Field(default=None, max_length=500)

    @field_validator("donor_name", "message")
    @classmethod
    def _blank_to_none(cls, v: str | None) -> str | None:
        v = _clean_text(v).strip() if v else None
        return v or None


class DonationStatusResponse(BaseModel):
    id: uuid.UUID
    status: str
    amount: float
    mpesa_receipt: str | None
    reason: DonationReason
    donor_name: str | None
    message: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DonationWallEntry(BaseModel):
    donor_name: str | None
    reason: DonationReason
    message: str | None
    amount: float
    created_at: datetime
