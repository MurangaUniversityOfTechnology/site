import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class TagRow(BaseModel):
    id: uuid.UUID
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class CreateTagRequest(BaseModel):
    name: str = Field(min_length=1, max_length=40)


class RenameTagRequest(BaseModel):
    name: str = Field(min_length=1, max_length=40)


class AssignTagRequest(BaseModel):
    tag_id: uuid.UUID
