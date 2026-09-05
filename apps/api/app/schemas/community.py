import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class LinkPreviewOut(BaseModel):
    url: str
    title: str | None
    description: str | None
    image_url: str | None
    site_name: str | None


class CreatePostRequest(BaseModel):
    kind: str  # "question" | "poll"
    title: str = Field(min_length=1, max_length=200)
    body: str | None = Field(default=None, max_length=4000)
    is_anonymous: bool = False
    options: list[str] = Field(default_factory=list, max_length=6)
    attachments: list[str] = Field(default_factory=list, max_length=4)


class VoteRequest(BaseModel):
    value: int  # +1 or -1


class PollVoteRequest(BaseModel):
    option_id: uuid.UUID


class CreateCommentRequest(BaseModel):
    body: str = Field(min_length=1, max_length=2000)
    is_anonymous: bool = False
    attachments: list[str] = Field(default_factory=list, max_length=2)


class HideRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=300)


class PollOptionOut(BaseModel):
    id: uuid.UUID
    label: str
    position: int
    vote_count: int


class CommunityPostRow(BaseModel):
    id: uuid.UUID
    kind: str
    title: str
    excerpt: str | None
    author_display: str
    is_anonymous: bool
    created_at: datetime
    is_hidden: bool
    comment_count: int
    score: int | None  # question posts only
    my_vote: int | None  # question posts only — the caller's own vote, if any
    options: list[PollOptionOut] | None  # poll posts only
    my_option_id: uuid.UUID | None  # poll posts only
    link: LinkPreviewOut | None
    attachments: list[str]


class CommunityCommentRow(BaseModel):
    id: uuid.UUID
    author_display: str
    is_anonymous: bool
    body: str
    attachments: list[str]
    created_at: datetime
    is_hidden: bool
    score: int
    my_vote: int | None


class CommunityPostDetail(CommunityPostRow):
    body: str | None
    comments: list[CommunityCommentRow]
