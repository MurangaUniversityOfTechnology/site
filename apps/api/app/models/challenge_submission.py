import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class ChallengeSubmission(Base):
    """
    Challenges aren't admin-gated like membership/events — flow.md has members
    review each other's builds, not an approval queue — so this is just a
    record, no status/state machine. challenge_slug joins to the frontend
    seed data (lib/data.ts) the same way Event.slug does.
    """

    __tablename__ = "challenge_submissions"
    __table_args__ = (UniqueConstraint("challenge_slug", "user_id", name="ux_challenge_submissions_slug_user"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    challenge_slug: Mapped[str] = mapped_column(String, nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    github_url: Mapped[str] = mapped_column(String, nullable=False)
    demo_url: Mapped[str | None] = mapped_column(String, nullable=True)
    learned: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship()
