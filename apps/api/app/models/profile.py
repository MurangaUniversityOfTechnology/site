import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ARRAY, Boolean, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

if TYPE_CHECKING:
    from app.models.user import User


class ExperienceLevel(str, enum.Enum):
    starting = "starting"
    some_projects = "some_projects"
    independent = "independent"
    advanced = "advanced"


class ProfileVisibility(str, enum.Enum):
    public = "public"
    members = "members"
    private = "private"


class Profile(Base):
    __tablename__ = "profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    first_name: Mapped[str | None] = mapped_column(String, nullable=True)
    last_name: Mapped[str | None] = mapped_column(String, nullable=True)
    display_name: Mapped[str | None] = mapped_column(String, nullable=True)
    # Confirms MUT enrollment for admins during membership review. Never returned
    # from any public-facing endpoint — flow.md §7 is explicit this stays admin-only.
    registration_number: Mapped[str | None] = mapped_column(String, nullable=True)
    # Collected at onboarding so it's on file before a member ever needs to
    # pay — an admin sending an STK push on someone's behalf (see
    # services/membership.py) reads this instead of asking again. Same
    # admin-only visibility as registration_number.
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    course: Mapped[str | None] = mapped_column(String, nullable=True)
    year_of_study: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String, nullable=True)
    github_url: Mapped[str | None] = mapped_column(String, nullable=True)
    linkedin_url: Mapped[str | None] = mapped_column(String, nullable=True)
    portfolio_url: Mapped[str | None] = mapped_column(String, nullable=True)
    interests: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    goals: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    experience_level: Mapped[ExperienceLevel | None] = mapped_column(Enum(ExperienceLevel), nullable=True)
    visibility: Mapped[ProfileVisibility] = mapped_column(Enum(ProfileVisibility), default=ProfileVisibility.public)
    # Set once the member has been through the onboarding wizard (or edited
    # their profile from Settings) — lets auth flows send a first-time signer
    # to /onboarding without re-prompting an existing member on every login.
    # Admins are treated as onboarded regardless (see MeResponse) — this
    # column only matters for everyone else.
    onboarded: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user: Mapped["User"] = relationship(back_populates="profile")
