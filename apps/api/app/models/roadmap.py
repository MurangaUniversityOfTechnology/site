import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
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
    from app.models.arm import Arm
    from app.models.user import User


class Roadmap(Base):
    """
    One semester's plan for one arm (Web Development, AI & Robotics, ...) —
    the goal for that stretch plus an ordered list of milestones (see
    RoadmapMilestone). Unlike Course, authored and shown whole rather than
    unlocked module-by-module, but keeps the same draft/published split as
    Course.published_at — admins fill it in over time before students see it.
    """

    __tablename__ = "roadmaps"
    __table_args__ = (UniqueConstraint("arm_id", "position", name="ux_roadmaps_arm_position"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    arm_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("arms.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    goal_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # No ondelete here on purpose, same reasoning as Course.created_by_id — a
    # published roadmap shouldn't vanish because its author later loses their account.
    created_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    arm: Mapped["Arm"] = relationship()
    created_by: Mapped["User"] = relationship()
