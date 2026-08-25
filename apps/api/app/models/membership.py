import enum
import uuid
from datetime import date

from sqlalchemy import Date, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class MembershipStatus(str, enum.Enum):
    none = "none"
    payment_pending = "payment_pending"
    payment_received = "payment_received"
    approval_pending = "approval_pending"
    active = "active"
    rejected = "rejected"
    expired = "expired"
    suspended = "suspended"


class Membership(Base):
    """
    Tracks authorization state separately from payment state (payments.py).
    Never set directly by client input — only via service-layer transition
    functions in app/services/membership.py, per flow.md §41.
    """

    __tablename__ = "memberships"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    status: Mapped[MembershipStatus] = mapped_column(Enum(MembershipStatus), default=MembershipStatus.none, nullable=False)
    period_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    period_end: Mapped[date | None] = mapped_column(Date, nullable=True)

    user: Mapped["User"] = relationship(back_populates="membership")
