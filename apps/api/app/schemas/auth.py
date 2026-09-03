import uuid
from typing import Annotated

from pydantic import BaseModel, BeforeValidator, EmailStr, Field

# Users routinely copy-paste emails out of another app (or their phone
# autocorrects a leading capital), picking up stray leading/trailing
# whitespace along the way. Strip it before EmailStr ever sees it so a pasted
# " Foo@Example.com " signs up/in exactly like "Foo@Example.com" instead of
# bouncing with a validation error or silently mismatching a stored account.
StrippedEmail = Annotated[EmailStr, BeforeValidator(lambda v: v.strip() if isinstance(v, str) else v)]


class SignupRequest(BaseModel):
    email: StrippedEmail
    password: str = Field(min_length=8, max_length=72)


class LoginRequest(BaseModel):
    email: StrippedEmail
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str | None = None
    new_password: str = Field(min_length=8, max_length=72)


class ForgotPasswordRequest(BaseModel):
    email: StrippedEmail


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
