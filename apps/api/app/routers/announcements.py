from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.schemas.announcement import AnnouncementPublic
from app.services import announcement as announcement_service

router = APIRouter(prefix="/announcements", tags=["announcements"])


@router.get("", response_model=list[AnnouncementPublic])
def list_live_announcements(db: Session = Depends(get_db)):
    return announcement_service.list_live_announcements(db)
