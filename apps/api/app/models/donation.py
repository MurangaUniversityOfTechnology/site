import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.payment import PaymentStatus

if TYPE_CHECKING:
    from app.models.user import User


class DonationReason(str, enum.Enum):
    alumni = "alumni"
    general = "general"
    sponsorship = "sponsorship"
    scholarship = "scholarship"
    other = "other"


class Donation(Base):
    """
    One row per M-Pesa STK push attempt for a donation. Deliberately not a
    Payment row — donations don't require an account (user_id is nullable),
    so they can't share Payment's NOT NULL user_id FK. Status is only ever
    written by the Daraja callback handler (or the reconciliation job),
    exactly like Payment.
    """

    __tablename__ = "donations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Set only when the donor happened to be signed in — never required.
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True
    )
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=False)
    reason: Mapped[DonationReason] = mapped_column(Enum(DonationReason), nullable=False)
    donor_name: Mapped[str | None] = mapped_column(String, nullable=True)
    # True hides donor_name from the public wall (services/donation.py still
    # keeps the name on the row itself, for the club's own records).
    is_anonymous: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    checkout_request_id: Mapped[str | None] = mapped_column(String, unique=True, index=True, nullable=True)
    merchant_request_id: Mapped[str | None] = mapped_column(String, nullable=True)
    mpesa_receipt: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[PaymentStatus] = mapped_column(Enum(PaymentStatus), default=PaymentStatus.initiated, nullable=False)
    raw_callback: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User | None"] = relationship()
