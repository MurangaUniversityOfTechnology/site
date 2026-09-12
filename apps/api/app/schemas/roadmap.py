import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.arm import ArmRow

# ── public ───────────────────────────────────────────────────────────────


class MilestonePublic(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    status: str
    position: int

    model_config = {"from_attributes": True}


class RoadmapSummary(BaseModel):
    id: uuid.UUID
    title: str
    goal_summary: str | None
    position: int
    arm: ArmRow
    milestones: list[MilestonePublic]


# ── admin ────────────────────────────────────────────────────────────────


class RoadmapWriteRequest(BaseModel):
    arm_id: uuid.UUID
    title: str = Field(min_length=1, max_length=120)
    goal_summary: str | None = None


class RoadmapUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    goal_summary: str | None = None


class AdminRoadmapRow(BaseModel):
    id: uuid.UUID
    title: str
    goal_summary: str | None
    position: int
    published_at: datetime | None
    arm: ArmRow
    milestone_count: int
    created_by: str


class MilestoneWriteRequest(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str | None = None


class MilestoneUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = None


class MilestoneStatusRequest(BaseModel):
    status: Literal["planned", "in_progress", "done"]


class AdminMilestoneRow(BaseModel):
    id: uuid.UUID
    roadmap_id: uuid.UUID
    title: str
    description: str | None
    status: str
    position: int


class ReorderRequest(BaseModel):
    direction: Literal["up", "down"]
