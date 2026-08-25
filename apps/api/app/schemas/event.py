import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    guest_name: str | None = None
    guest_email: EmailStr | None = None


class RegistrationResponse(BaseModel):
    id: uuid.UUID
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminRegistrationRow(BaseModel):
    id: uuid.UUID
    name: str
    detail: str
    member: bool
    status: str
