import uuid
from datetime import datetime

from sqlalchemy import ARRAY, JSON, DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Project(Base):
    """
    Repo metadata and a whole-project cache of "good first issue"-labelled
    issues, refreshed by github_service.sync_project(). cached_issues is a
    denormalized JSON blob rather than a child table — it's replaced wholesale
    on every sync, never queried or filtered individually, so a relational
    table would just add a join for no benefit. synced_at intentionally stays
    stale on a failed sync (rate limit, GitHub outage) rather than clearing —
    that's what lets the UI show "last synced 41 minutes ago" instead of erroring.
    """

    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    repo_owner: Mapped[str] = mapped_column(String, nullable=False)
    repo_name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    language: Mapped[str | None] = mapped_column(String, nullable=True)
    topics: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    stars: Mapped[int] = mapped_column(Integer, default=0)
    open_issues_count: Mapped[int] = mapped_column(Integer, default=0)
    cached_issues: Mapped[list[dict]] = mapped_column(JSON, default=list)
    synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    @property
    def github_url(self) -> str:
        return f"https://github.com/{self.repo_owner}/{self.repo_name}"
