import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class PaymentStatus(str, enum.Enum):
    initiated = "initiated"
    pending = "pending"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"
    unknown = "unknown"


class Payment(Base):
    """
    One row per M-Pesa STK push attempt. Status is only ever written by the
    Daraja callback handler (or the reconciliation job) — never by the
    frontend or an admin manually marking a payment as paid.
    """

    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=False)
    checkout_request_id: Mapped[str | None] = mapped_column(String, unique=True, index=True, nullable=True)
    merchant_request_id: Mapped[str | None] = mapped_column(String, nullable=True)
    mpesa_receipt: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[PaymentStatus] = mapped_column(Enum(PaymentStatus), default=PaymentStatus.initiated, nullable=False)
    raw_callback: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship()
