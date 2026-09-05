import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

if TYPE_CHECKING:
    from app.models.user import User


class CommunityPostKind(str, enum.Enum):
    question = "question"
    poll = "poll"


class CommunityPost(Base):
    """A quick, low-stakes question or poll meant to drive participation —
    not moderated pre-publish (see app/services/community.py), just
    reactively hidden if it needs to be. Stays open to votes/comments
    indefinitely; only hiding closes it off."""

    __tablename__ = "community_posts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    kind: Mapped[CommunityPostKind] = mapped_column(Enum(CommunityPostKind), nullable=False)
    # No ondelete here on purpose, same precedent as Content.author_id — a
    # post shouldn't vanish because its author later deletes their account.
    author_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    # Author is always tracked above for accountability even when this is
    # true — only the *display* layer hides identity from regular viewers.
    # Staff/admin always see the real author.
    is_anonymous: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Rich link preview — best-effort, fetched server-side from the first
    # URL found in the post at creation time. Any of these may be null if no
    # URL was found or the fetch failed; a missing preview never blocks
    # posting (see app/services/link_preview.py).
    link_url: Mapped[str | None] = mapped_column(String, nullable=True)
    link_title: Mapped[str | None] = mapped_column(String, nullable=True)
    link_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    link_image_url: Mapped[str | None] = mapped_column(String, nullable=True)
    link_site_name: Mapped[str | None] = mapped_column(String, nullable=True)

    # URLs of media the author uploaded through /community/uploads (images
    # and short video clips) — validated at write time to actually be our
    # own Cloudinary URLs, not arbitrary hotlinks (see services/community.py
    # _validate_attachments). A plain list is enough since attachments are
    # only ever displayed, never independently queried/counted.
    attachments: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    edited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    hidden_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    author: Mapped["User"] = relationship()
    options: Mapped[list["CommunityPollOption"]] = relationship(
        order_by="CommunityPollOption.position", cascade="all, delete-orphan"
    )


class CommunityPollOption(Base):
    __tablename__ = "community_poll_options"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("community_posts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    label: Mapped[str] = mapped_column(String, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)


class CommunityVote(Base):
    """Upvote/downvote on a question post. Polls don't use this — picking an
    option (CommunityPollVote) is itself the poll's vote."""

    __tablename__ = "community_votes"
    __table_args__ = (UniqueConstraint("post_id", "user_id", name="ux_community_votes_post_user"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("community_posts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    value: Mapped[int] = mapped_column(SmallInteger, nullable=False)


class CommunityPollVote(Base):
    """One option choice per user per poll — re-voting updates the existing
    row rather than adding another."""

    __tablename__ = "community_poll_votes"
    __table_args__ = (UniqueConstraint("post_id", "user_id", name="ux_community_poll_votes_post_user"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("community_posts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    option_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("community_poll_options.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )


class CommunityComment(Base):
    """Flat — no parent_id/threading in v1."""

    __tablename__ = "community_comments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("community_posts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # No ondelete here either, same reasoning as CommunityPost.author_id.
    author_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    is_anonymous: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    attachments: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    edited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    hidden_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    author: Mapped["User"] = relationship()


class CommunityCommentVote(Base):
    """Upvote/downvote on a comment — same toggle semantics as CommunityVote,
    just against a comment instead of a post."""

    __tablename__ = "community_comment_votes"
    __table_args__ = (UniqueConstraint("comment_id", "user_id", name="ux_community_comment_votes_comment_user"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    comment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("community_comments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    value: Mapped[int] = mapped_column(SmallInteger, nullable=False)
