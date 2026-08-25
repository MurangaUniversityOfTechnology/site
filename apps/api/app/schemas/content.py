import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class SubmitContentRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=20000)
    tags: list[str] = Field(default_factory=list)


class ContentResponse(BaseModel):
    id: uuid.UUID
    title: str
    body: str
    tags: list[str]
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ContentSummary(BaseModel):
    id: uuid.UUID
    title: str
    excerpt: str
    author: str
    created_at: datetime


class AdminContentRow(BaseModel):
    id: uuid.UUID
    title: str
    body: str
    author: str
    when: datetime
