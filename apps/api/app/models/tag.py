import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Tag(Base):
    """A free-form label admins can pin to a member (Dean, Chairperson,
    Guest, ...) — mostly descriptive. One exception: whoever holds a tag
    named "Chairperson" gets access to the org's Dean/Patron signature (see
    app.core.deps.require_chairperson) — everything else is presentational.
    Kept as a real entity (not just a string on Profile) so admins can
    rename/retire one without touching every member who has it."""

    __tablename__ = "tags"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
