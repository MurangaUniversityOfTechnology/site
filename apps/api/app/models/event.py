import enum
import uuid

from sqlalchemy import Enum, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class EventAudience(str, enum.Enum):
    open_to_all = "open_to_all"
    members_only = "members_only"


class Event(Base):
    """
    Metadata needed to enforce registration rules (capacity, audience, fee).
    Display copy (description, schedule, speaker, etc.) stays in the frontend
    seed data (lib/data.ts) until Phase 9 adds a real admin event editor —
    slug is the join key between the two.
    """

    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    capacity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    audience: Mapped[EventAudience] = mapped_column(Enum(EventAudience), default=EventAudience.open_to_all)
    fee_kes: Mapped[int] = mapped_column(Integer, default=0)
