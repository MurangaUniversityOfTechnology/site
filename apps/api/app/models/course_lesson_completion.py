import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

if TYPE_CHECKING:
    from app.models.course_enrollment import CourseEnrollment
    from app.models.course_lesson import CourseLesson


class CourseLessonCompletion(Base):
    """Marks a lesson read — no per-lesson sequencing, only the module-level
    quiz-gates-the-next-module rule applies, so this is a flat completion
    fact, not a state machine."""

    __tablename__ = "course_lesson_completions"
    __table_args__ = (
        UniqueConstraint("enrollment_id", "lesson_id", name="ux_course_lesson_completions_enrollment_lesson"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    enrollment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("course_enrollments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    lesson_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("course_lessons.id", ondelete="CASCADE"), nullable=False, index=True
    )
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    enrollment: Mapped["CourseEnrollment"] = relationship()
    lesson: Mapped["CourseLesson"] = relationship()
