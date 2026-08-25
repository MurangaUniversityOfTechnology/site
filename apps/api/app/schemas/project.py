import uuid
from datetime import datetime

from pydantic import BaseModel


class IssueSummary(BaseModel):
    id: int
    title: str
    url: str
    labels: list[str]
    created_at: str


class ProjectSummary(BaseModel):
    slug: str
    name: str
    description: str | None
    language: str | None
    topics: list[str]
    stars: int
    open_issues_count: int


class ProjectDetail(ProjectSummary):
    github_url: str
    synced_at: datetime | None
    issues: list[IssueSummary]
    members: list[str]
    member_count: int
    is_member: bool
    my_request_status: str | None


class JoinProjectRequest(BaseModel):
    contribution_areas: list[str]
    message: str | None = None


class JoinRequestResponse(BaseModel):
    id: uuid.UUID
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminJoinRequestRow(BaseModel):
    id: uuid.UUID
    project_slug: str
    project_name: str
    user_email: str
    user_name: str
    contribution_areas: list[str]
    message: str | None
    created_at: datetime
