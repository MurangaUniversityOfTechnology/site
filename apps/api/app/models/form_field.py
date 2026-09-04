import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    JSON,
    Boolean,
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
    from app.models.form import Form

# Kept as plain strings (validated in schemas/form.py) rather than a
# Postgres enum — this list is expected to grow (a file-upload type is an
# easy later add-on) and a String avoids an ALTER TYPE migration every time.
FIELD_TYPES = (
    "short_text",
    "long_text",
    "single_choice",
    "multi_choice",
    "dropdown",
    "yes_no",
    "rating",
    "date",
    "number",
    "email",
)
CHOICE_FIELD_TYPES = {"single_choice", "multi_choice", "dropdown"}


class FormField(Base):
    """
    choices is a JSON blob ([{"id","text"}, 2-5 entries], only populated for
    CHOICE_FIELD_TYPES) — same precedent as CourseQuizQuestion.choices: small,
    bounded, always read/written as a unit, never queried individually.
    """

    __tablename__ = "form_fields"
    __table_args__ = (UniqueConstraint("form_id", "position", name="ux_form_fields_form_position"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    form_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("forms.id", ondelete="CASCADE"), nullable=False, index=True
    )
    type: Mapped[str] = mapped_column(String, nullable=False)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    help_text: Mapped[str | None] = mapped_column(String, nullable=True)
    required: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    choices: Mapped[list[dict]] = mapped_column(JSON, default=list, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    form: Mapped["Form"] = relationship()
