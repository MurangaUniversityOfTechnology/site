import uuid
from datetime import datetime

from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: uuid.UUID
    kind: str
    title: str
    body: str | None
    read: bool
    created_at: datetime

    model_config = {"from_attributes": True}
