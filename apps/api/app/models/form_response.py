import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

if TYPE_CHECKING:
    from app.models.form import Form
    from app.models.user import User


class FormResponse(Base):
    """
    answers is a JSON blob ([{"field_id","value"}]) frozen at submit time —
    same "don't recompute if the parent changes later" precedent as
    CourseQuizAttempt.answers. Deliberately no review-status: a response is
    just recorded, never reviewed, unlike CourseCapstoneSubmission.
    """

    __tablename__ = "form_responses"
    # Postgres treats NULL user_id values as distinct, so this only blocks a
    # signed-in member from responding twice — anonymous responses (allowed
    # when Form.require_login is False) are unaffected. Same precedent as
    # EventRegistration.
    __table_args__ = (UniqueConstraint("form_id", "user_id", name="ux_form_responses_form_user"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    form_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("forms.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    answers: Mapped[list[dict]] = mapped_column(JSON, default=list, nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    form: Mapped["Form"] = relationship()
    user: Mapped["User"] = relationship()
