import enum
import uuid
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, Enum, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class GithubOrgInviteStatus(str, enum.Enum):
    none = "none"
    invited = "invited"
    accepted = "accepted"
    expired = "expired"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    google_sub: Mapped[str | None] = mapped_column(String, unique=True, index=True, nullable=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # OAuth-verified GitHub identity — distinct from profile.github_url, which is
    # a free-text link the member types in during onboarding and isn't verified.
    github_id: Mapped[int | None] = mapped_column(BigInteger, unique=True, index=True, nullable=True)
    github_login: Mapped[str | None] = mapped_column(String, nullable=True)
    github_org_invite_status: Mapped[GithubOrgInviteStatus] = mapped_column(
        Enum(GithubOrgInviteStatus), default=GithubOrgInviteStatus.none, nullable=False
    )
    github_org_invited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    profile: Mapped["Profile"] = relationship(back_populates="user", uselist=False)
    membership: Mapped["Membership"] = relationship(back_populates="user", uselist=False)
