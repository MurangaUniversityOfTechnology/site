import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class SubmitBuildRequest(BaseModel):
    github_url: str = Field(min_length=1)
    demo_url: str | None = None
    learned: str | None = Field(default=None, max_length=2000)


class SubmissionResponse(BaseModel):
    id: uuid.UUID
    challenge_slug: str
    github_url: str
    demo_url: str | None
    created_at: datetime
    total_shipped: int

    model_config = {"from_attributes": True}


class RecentSubmission(BaseModel):
    name: str
    when: datetime
