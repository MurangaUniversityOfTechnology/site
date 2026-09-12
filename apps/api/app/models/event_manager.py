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


class EventManagerStatus(str, enum.Enum):
    invited = "invited"
    active = "active"
    revoked = "revoked"


class EventManager(Base):
    """
    Grants one user event-scoped admin powers (approve/reject/waitlist/
    attend registrations, add walk-ins, invite further managers) for a
    single event, without the site-wide reach of is_staff. Invited by
    email — the row exists (status=invited, no user_id yet) before the
    invitee necessarily has an account; accepting the emailed link is what
    attaches user_id and flips status to active. One row per (event, email)
    so re-inviting after a revoke reuses the row instead of piling up
    duplicates.
    """

    __tablename__ = "event_managers"
    __table_args__ = (UniqueConstraint("event_id", "invited_email", name="ux_event_managers_event_email"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    invited_email: Mapped[str] = mapped_column(String, nullable=False)
    invited_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status: Mapped[EventManagerStatus] = mapped_column(
        Enum(EventManagerStatus), default=EventManagerStatus.invited, nullable=False
    )
    # Opaque bearer token for the accept-invite link — only meaningful while
    # status is 'invited'; left in place afterward as an audit trail rather
    # than nulled out, same spirit as OrgSignature keeping old state around.
    token: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    event: Mapped["Event"] = relationship()
    user: Mapped["User"] = relationship(foreign_keys=[user_id])
    invited_by: Mapped["User"] = relationship(foreign_keys=[invited_by_id])
