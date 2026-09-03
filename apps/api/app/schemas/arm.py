import uuid

from pydantic import BaseModel, Field


class ArmRow(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    position: int

    model_config = {"from_attributes": True}


class CreateArmRequest(BaseModel):
    name: str = Field(min_length=1, max_length=60)


class RenameArmRequest(BaseModel):
    name: str = Field(min_length=1, max_length=60)


class AssignArmRequest(BaseModel):
    arm_id: uuid.UUID
