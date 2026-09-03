import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

if TYPE_CHECKING:
    from app.models.course_enrollment import CourseEnrollment
    from app.models.user import User


class CapstoneReviewStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class CourseCapstoneSubmission(Base):
    """Current-state row per enrollment, not append-only like quiz
    attempts — a resubmission overwrites github_url/what_built and resets
    review_status to pending rather than adding a new row. There's no
    rejection-reason field (CapstoneReviewRequest is just {approve: bool}),
    so there's nothing per-attempt worth keeping history for, and one row
    per student is exactly the shape the admin review queue wants."""

    __tablename__ = "course_capstone_submissions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    enrollment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("course_enrollments.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    github_url: Mapped[str] = mapped_column(Text, nullable=False)
    what_built: Mapped[str] = mapped_column(Text, nullable=False)
    review_status: Mapped[CapstoneReviewStatus] = mapped_column(
        Enum(CapstoneReviewStatus), default=CapstoneReviewStatus.pending, nullable=False
    )
    reviewed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    enrollment: Mapped["CourseEnrollment"] = relationship()
    reviewed_by: Mapped["User | None"] = relationship()
