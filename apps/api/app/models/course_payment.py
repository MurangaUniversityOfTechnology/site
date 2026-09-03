import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.payment import PaymentStatus

if TYPE_CHECKING:
    from app.models.course_enrollment import CourseEnrollment


class CoursePayment(Base):
    """
    One row per M-Pesa STK push attempt for a paid course's fee. 1:1 with a
    CourseEnrollment, same shape as EventPayment's 1:1 with an
    EventRegistration. Status is only ever written by the Daraja callback
    handler (or the reconciliation job) — never by the frontend or an admin.
    """

    __tablename__ = "course_payments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    enrollment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("course_enrollments.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=False)
    checkout_request_id: Mapped[str | None] = mapped_column(String, unique=True, index=True, nullable=True)
    merchant_request_id: Mapped[str | None] = mapped_column(String, nullable=True)
    mpesa_receipt: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[PaymentStatus] = mapped_column(Enum(PaymentStatus), default=PaymentStatus.initiated, nullable=False)
    raw_callback: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    enrollment: Mapped["CourseEnrollment"] = relationship()
