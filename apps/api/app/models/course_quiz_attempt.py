import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

if TYPE_CHECKING:
    from app.models.course_enrollment import CourseEnrollment
    from app.models.course_quiz import CourseQuiz


class CourseQuizAttempt(Base):
    """
    One row per submission — append-only history, never overwritten, so
    retries don't erase what happened before. `passed` is frozen at grading
    time rather than recomputed later, so an admin changing a final exam's
    pass_threshold_pct afterwards can't retroactively flip old results.
    `answers` is a JSON blob (GradedAnswer shape per entry) — same
    precedent as CourseQuizQuestion.choices: bounded, always read/written
    as a unit, never queried per-answer across attempts.
    """

    __tablename__ = "course_quiz_attempts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    enrollment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("course_enrollments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    quiz_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("course_quizzes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    score_pct: Mapped[float] = mapped_column(Float, nullable=False)
    passed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    answers: Mapped[list[dict]] = mapped_column(JSON, default=list, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    enrollment: Mapped["CourseEnrollment"] = relationship()
    quiz: Mapped["CourseQuiz"] = relationship()
