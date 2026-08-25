import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

if TYPE_CHECKING:
    from app.models.event import Event
    from app.models.user import User


class RegistrationStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    waitlisted = "waitlisted"
    attended = "attended"
    cancelled = "cancelled"


class EventRegistration(Base):
    __tablename__ = "event_registrations"
    # Postgres treats NULL user_id values as distinct, so this only blocks
    # a signed-in member from registering twice — guests are unaffected.
    __table_args__ = (UniqueConstraint("event_id", "user_id", name="ux_event_registrations_event_user"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("events.id"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    guest_name: Mapped[str | None] = mapped_column(String, nullable=True)
    guest_email: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[RegistrationStatus] = mapped_column(Enum(RegistrationStatus), default=RegistrationStatus.pending)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    event: Mapped["Event"] = relationship()
    user: Mapped["User"] = relationship()
