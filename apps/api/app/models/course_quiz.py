import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

if TYPE_CHECKING:
    from app.models.course import Course
    from app.models.course_module import CourseModule


class QuizKind(str, enum.Enum):
    module_quiz = "module_quiz"
    final_exam = "final_exam"


class CourseQuiz(Base):
    """
    One table for both module quizzes and the final exam — authoring,
    grading, and attempt-storage code is identical for both, only the FK
    target and copy differ. module_id is set only for kind=module_quiz;
    course_id is set for both (final_exam has no module_id) so both kinds
    can be looked up by course without a join through modules.
    """

    __tablename__ = "course_quizzes"
    __table_args__ = (
        # "Exactly one final exam per course" needs a *partial* unique index
        # rather than a plain unique(course_id) — many module quizzes
        # legitimately share the same course_id.
        Index(
            "ux_course_quizzes_one_final_exam",
            "course_id",
            unique=True,
            postgresql_where=text("kind = 'final_exam'"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    kind: Mapped[QuizKind] = mapped_column(Enum(QuizKind), nullable=False)
    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    module_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("course_modules.id", ondelete="CASCADE"), unique=True, nullable=True
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    # final_exam-only warning copy shown before the student starts —
    # e.g. "30-50 questions, no going back once you start".
    intro_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    pass_threshold_pct: Mapped[int] = mapped_column(Integer, default=80, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    course: Mapped["Course"] = relationship()
    module: Mapped["CourseModule | None"] = relationship()
