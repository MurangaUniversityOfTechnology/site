import uuid
from datetime import datetime, time

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Time, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class EventReminderSettings(Base):
    """How the automatic event reminder emails behave (see
    app/services/event_reminders.py) — edited from /admin/event-reminders.
    Singleton: at most one row exists, created with these defaults on first
    read, so a fresh database behaves exactly like before this was
    configurable."""

    __tablename__ = "event_reminder_settings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    day_before_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Nairobi wall-clock time on the day before the event
    day_before_time: Mapped[time] = mapped_column(Time, nullable=False, default=time(18, 0))
    hour_before_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    hour_before_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    # Off by default: pending means "not confirmed yet", and a reminder can
    # read like a confirmation. Turn on for events where approvals lag.
    include_pending: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    updated_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
