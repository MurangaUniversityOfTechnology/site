import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Arm(Base):
    """
    A learning track a course can belong to (Web Development, AI &
    Robotics, ...) — many-to-many via CourseArm. Unlike Tag (alphabetical),
    order is deliberate: admins pick where a new arm sits (e.g. "Others"
    stays last), so position is a real column rather than sorting by name.
    """

    __tablename__ = "arms"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
