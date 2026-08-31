import uuid

from pydantic import BaseModel, EmailStr, Field


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str | None = None
    new_password: str = Field(min_length=8, max_length=72)


class MeResponse(BaseModel):
    id: uuid.UUID
    email: str
    email_verified: bool
    is_admin: bool
    membership_status: str

    model_config = {"from_attributes": True}
