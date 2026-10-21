from datetime import UTC, datetime

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.announcement import Announcement
from app.models.user import User
from app.services import audit


class AnnouncementError(Exception):
    pass


def list_live_announcements(db: Session, now: datetime | None = None) -> list[Announcement]:
    now = now or datetime.now(UTC)
    return (
        db.query(Announcement)
        .filter(
            Announcement.is_active.is_(True),
            or_(Announcement.starts_at.is_(None), Announcement.starts_at <= now),
            or_(Announcement.ends_at.is_(None), Announcement.ends_at > now),
        )
        .order_by(Announcement.created_at.desc())
        .all()
    )


def list_admin_announcements(db: Session) -> list[Announcement]:
    return db.query(Announcement).order_by(Announcement.created_at.desc()).all()


def get_announcement(db: Session, announcement_id) -> Announcement:
    announcement = db.get(Announcement, announcement_id)
    if not announcement:
        raise AnnouncementError("Unknown announcement")
    return announcement


def state_of(announcement: Announcement, now: datetime | None = None) -> str:
    now = now or datetime.now(UTC)
    if not announcement.is_active:
        return "off"
    if announcement.starts_at and announcement.starts_at > now:
        return "scheduled"
    if announcement.ends_at and announcement.ends_at <= now:
        return "ended"
    return "live"


def create_announcement(db: Session, admin: User, fields: dict) -> Announcement:
    announcement = Announcement(**fields, created_by_id=admin.id)
    db.add(announcement)
    audit.log(db, admin, "announcement", f"Created announcement '{announcement.title}'")
    db.commit()
    db.refresh(announcement)
    return announcement


def update_announcement(db: Session, admin: User, announcement: Announcement, fields: dict) -> Announcement:
    for key, value in fields.items():
        setattr(announcement, key, value)
    audit.log(db, admin, "announcement", f"Updated announcement '{announcement.title}'")
    db.commit()
    db.refresh(announcement)
    return announcement


def delete_announcement(db: Session, admin: User, announcement: Announcement) -> None:
    audit.log(db, admin, "announcement", f"Deleted announcement '{announcement.title}'")
    db.delete(announcement)
    db.commit()
