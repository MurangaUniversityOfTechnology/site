import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

if TYPE_CHECKING:
    from app.models.course import Course
    from app.models.user import User


class CourseAccessType(str, enum.Enum):
    free_member = "free_member"
    paid = "paid"


class CourseEnrollment(Base):
    """
    Created for EVERY enrollment, including free active members — mirrors
    EventRegistration always existing even for free/open events. One anchor
    row for progress, payment, quiz attempts, and capstone state, and a real
    "my courses" list for the dashboard. `access` is an immutable record of
    how the student got in (for admin reporting) — re-checked live against
    current membership status on every content read, not trusted as an
    ongoing grant (see services/course.py's has_course_access()).
    """

    __tablename__ = "course_enrollments"
    __table_args__ = (UniqueConstraint("course_id", "user_id", name="ux_course_enrollments_course_user"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    access: Mapped[CourseAccessType] = mapped_column(Enum(CourseAccessType), nullable=False)
    enrolled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    course: Mapped["Course"] = relationship()
    user: Mapped["User"] = relationship()
