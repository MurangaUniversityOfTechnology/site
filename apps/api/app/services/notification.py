from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.models.user import User


def notify(db: Session, user: User, kind: str, title: str, body: str | None = None) -> None:
    db.add(Notification(user_id=user.id, kind=kind, title=title, body=body))


def list_for(db: Session, user: User, limit: int = 50) -> list[Notification]:
    return (
        db.query(Notification)
        .filter(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .all()
    )


def unread_count(db: Session, user: User) -> int:
    return db.query(Notification).filter(Notification.user_id == user.id, Notification.read.is_(False)).count()


def mark_read(db: Session, user: User, notification_id: str) -> None:
    n = db.get(Notification, notification_id)
    if n and n.user_id == user.id:
        n.read = True
        db.commit()


def mark_all_read(db: Session, user: User) -> None:
    db.query(Notification).filter(Notification.user_id == user.id, Notification.read.is_(False)).update({"read": True})
    db.commit()
