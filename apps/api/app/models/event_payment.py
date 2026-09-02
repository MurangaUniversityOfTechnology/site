import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.payment import PaymentStatus

if TYPE_CHECKING:
    from app.models.event_registration import EventRegistration


class EventPayment(Base):
    """
    One row per M-Pesa STK push attempt for a paid event's registration fee.
    1:1 with an EventRegistration (guest or member) rather than tied to a
    user directly — registration already carries who's paying, member or
    guest. Status is only ever written by the Daraja callback handler (or
    the reconciliation job), exactly like Payment/Donation.
    """

    __tablename__ = "event_payments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    registration_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("event_registrations.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=False)
    checkout_request_id: Mapped[str | None] = mapped_column(String, unique=True, index=True, nullable=True)
    merchant_request_id: Mapped[str | None] = mapped_column(String, nullable=True)
    mpesa_receipt: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[PaymentStatus] = mapped_column(Enum(PaymentStatus), default=PaymentStatus.initiated, nullable=False)
    raw_callback: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    registration: Mapped["EventRegistration"] = relationship()
