from datetime import datetime

from pydantic import BaseModel


class SignatureStatus(BaseModel):
    has_signature: bool
    updated_at: datetime | None = None


class SignatureImage(BaseModel):
    image_base64: str
    updated_at: datetime


class SaveSignatureRequest(BaseModel):
    # A PNG data URL ("data:image/png;base64,....") or bare base64 straight
    # off the browser's signature canvas.
    image_base64: str
