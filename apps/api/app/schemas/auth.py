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


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=72)


class MeResponse(BaseModel):
    id: uuid.UUID
    email: str
    email_verified: bool
    is_admin: bool
    membership_status: str
    # True once the member has finished onboarding, or unconditionally for
    # admins — see routers/auth.py's _to_me_response().
    onboarded: bool

    model_config = {"from_attributes": True}
