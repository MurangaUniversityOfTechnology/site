import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

if TYPE_CHECKING:
    from app.models.user import User


class Form(Base):
    """
    Same published_at/archived_at dual-nullable-timestamp shape as Course —
    fields get added incrementally after creation, so "not ready yet" is a
    distinct state from "done, retired". See models/course.py.
    """

    __tablename__ = "forms"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # Off = anyone with the link can respond, no account needed. On
    # (default) = the responder must be signed in, and gets the
    # one-and-done guarantee from FormResponse's unique constraint.
    require_login: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Independent of published_at/archived_at — an admin-set deadline after
    # which the form still shows (read-only) but no longer accepts responses.
    closes_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # No ondelete here on purpose, same reasoning as Course.created_by_id —
    # a form shouldn't vanish because the admin who made it loses their
    # account.
    created_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    created_by: Mapped["User"] = relationship()
