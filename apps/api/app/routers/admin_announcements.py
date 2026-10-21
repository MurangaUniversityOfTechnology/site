import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import require_staff
from app.models.announcement import Announcement
from app.models.user import User
from app.schemas.announcement import (
    AdminAnnouncementRow,
    AnnouncementUpdateRequest,
    AnnouncementWriteRequest,
)
from app.services import announcement as announcement_service

router = APIRouter(prefix="/admin/announcements", tags=["admin-announcements"], dependencies=[Depends(require_staff)])


def _row(announcement: Announcement) -> AdminAnnouncementRow:
    return AdminAnnouncementRow(
        id=announcement.id,
        title=announcement.title,
        body=announcement.body,
        cta_label=announcement.cta_label,
        cta_url=announcement.cta_url,
        is_active=announcement.is_active,
        starts_at=announcement.starts_at,
        ends_at=announcement.ends_at,
        state=announcement_service.state_of(announcement),
        created_at=announcement.created_at,
    )


def _get_or_404(db: Session, announcement_id: uuid.UUID) -> Announcement:
    try:
        return announcement_service.get_announcement(db, announcement_id)
    except announcement_service.AnnouncementError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


@router.get("", response_model=list[AdminAnnouncementRow])
def list_announcements(db: Session = Depends(get_db)):
    return [_row(a) for a in announcement_service.list_admin_announcements(db)]


@router.post("", response_model=AdminAnnouncementRow, status_code=status.HTTP_201_CREATED)
def create_announcement(
    payload: AnnouncementWriteRequest, db: Session = Depends(get_db), admin: User = Depends(require_staff)
):
    return _row(announcement_service.create_announcement(db, admin, payload.model_dump()))


@router.put("/{announcement_id}", response_model=AdminAnnouncementRow)
def update_announcement(
    announcement_id: uuid.UUID,
    payload: AnnouncementUpdateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_staff),
):
    announcement = _get_or_404(db, announcement_id)
    return _row(announcement_service.update_announcement(db, admin, announcement, payload.model_dump()))


@router.delete("/{announcement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_announcement(announcement_id: uuid.UUID, db: Session = Depends(get_db), admin: User = Depends(require_staff)):
    announcement_service.delete_announcement(db, admin, _get_or_404(db, announcement_id))
