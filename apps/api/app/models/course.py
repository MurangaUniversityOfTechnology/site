import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

if TYPE_CHECKING:
    from app.models.user import User


class Course(Base):
    """
    Free for active members, paid (M-Pesa) for everyone else — see
    services/course.py's enroll() and CoursePayment. Authored incrementally
    across many child-table edits (modules, lessons, quizzes) before it's fit
    to show a student, hence published_at as a distinct state from
    archived_at: a course can be "not ready yet" independently of "done, now
    retired", unlike Event which is authored whole in one form submit.
    """

    __tablename__ = "courses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    # No ondelete here on purpose, same reasoning as Content.author_id — a
    # published course shouldn't vanish because the admin who wrote it later
    # loses their account. Blocks the delete until handled explicitly.
    created_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    short_description: Mapped[str] = mapped_column(String, nullable=False, default="")
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # External URL only — no image upload infra anywhere in this codebase.
    cover_image_url: Mapped[str | None] = mapped_column(String, nullable=True)
    # Charged to non-members/lapsed members only — active members and admins
    # always get free instant access, see services/course.py's enroll().
    price_kes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Sibling to Event.archived_at — tucks a retired course out of the public
    # catalog and the admin's active list without deleting it.
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    created_by: Mapped["User"] = relationship()
