import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

if TYPE_CHECKING:
    from app.models.course import Course


class CourseModule(Base):
    __tablename__ = "course_modules"
    # Server-assigned on create (max(existing)+1) — see services/course.py.
    # Stable ordering across edits needs a real column; unlike Event.schedule
    # this is separate rows, not a JSON list ordered by its own position.
    __table_args__ = (UniqueConstraint("course_id", "position", name="ux_course_modules_course_position"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    course: Mapped["Course"] = relationship()
