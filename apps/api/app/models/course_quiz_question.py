import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    JSON,
    DateTime,
    ForeignKey,
    Integer,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

if TYPE_CHECKING:
    from app.models.course_quiz import CourseQuiz


class CourseQuizQuestion(Base):
    """
    choices is a JSON blob ([{"id","text"}, 2-5 entries]), not a child
    table — same precedent as Event.schedule: small, bounded, always
    read/written as a unit, never queried or filtered individually across
    questions. correct_choice_ids is validated against choices in the admin
    schema layer (every id must match one of choices[].id), not a DB
    constraint. A question is multi-select purely by having more than one
    correct id — there's no separate flag, so grading never forks into two
    code paths (a single-select question is just the len()==1 case of the
    same exact-set-match check).
    """

    __tablename__ = "course_quiz_questions"
    __table_args__ = (UniqueConstraint("quiz_id", "position", name="ux_course_quiz_questions_quiz_position"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quiz_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("course_quizzes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    choices: Mapped[list[dict]] = mapped_column(JSON, default=list, nullable=False)
    correct_choice_ids: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    # Shown after grading — cheap add, real value for retrieval practice.
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    quiz: Mapped["CourseQuiz"] = relationship()
