import enum
import uuid
from datetime import datetime

from sqlalchemy import ARRAY, JSON, DateTime, Enum, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class EventAudience(str, enum.Enum):
    open_to_all = "open_to_all"
    members_only = "members_only"


class Event(Base):
    """
    Metadata needed to enforce registration rules (capacity, audience, fee),
    plus the display copy (description, schedule, speaker, etc.) shown on the
    public event page — created and edited entirely through the admin event
    editor, no frontend seed data involved.
    """

    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    capacity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    audience: Mapped[EventAudience] = mapped_column(Enum(EventAudience), default=EventAudience.open_to_all)
    fee_kes: Mapped[int] = mapped_column(Integer, default=0)

    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    venue: Mapped[str] = mapped_column(String, nullable=False, default="")
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    what_youll_build: Mapped[str | None] = mapped_column(Text, nullable=True)
    schedule: Mapped[list[dict]] = mapped_column(JSON, default=list)
    speaker_name: Mapped[str | None] = mapped_column(String, nullable=True)
    speaker_meta: Mapped[str | None] = mapped_column(String, nullable=True)
    requirements: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    who_should_attend: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
