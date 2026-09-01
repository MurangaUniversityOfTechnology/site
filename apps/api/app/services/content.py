from sqlalchemy.orm import Session

from app.models.content import Content, ContentStatus
from app.models.membership import MembershipStatus
from app.models.user import User
from app.services import audit, notification


class ContentError(Exception):
    pass


def submit(db: Session, user: User, title: str, body: str, tags: list[str]) -> Content:
    if not user.is_admin and not user.email_verified:
        raise ContentError("Verify your email before publishing")
    if not user.is_admin and user.membership.status != MembershipStatus.active:
        raise ContentError("Active club membership is required to publish")

    content = Content(author_id=user.id, title=title, body=body, tags=tags, status=ContentStatus.pending_review)
    db.add(content)
    db.commit()
    db.refresh(content)
    return content


def my_content(db: Session, user: User) -> list[Content]:
    return db.query(Content).filter(Content.author_id == user.id).order_by(Content.created_at.desc()).all()


def pending_queue(db: Session) -> list[Content]:
    return (
        db.query(Content)
        .filter(Content.status == ContentStatus.pending_review)
        .order_by(Content.created_at.asc())
        .all()
    )


def published(db: Session, limit: int = 20) -> list[Content]:
    return (
        db.query(Content)
        .filter(Content.status == ContentStatus.published)
        .order_by(Content.created_at.desc())
        .limit(limit)
        .all()
    )


def get_published(db: Session, content_id: str) -> Content | None:
    content = db.get(Content, content_id)
    return content if content and content.status == ContentStatus.published else None


def _decide(db: Session, admin: User, content: Content, to: ContentStatus, notify_title: str, notify_body: str) -> None:
    if content.status != ContentStatus.pending_review:
        raise ContentError(f"Cannot act on content in status '{content.status.value}'")
    content.status = to
    audit.log(db, admin, "content", f"{to.value.capitalize()} article \"{content.title}\" by {content.author.email}")
    notification.notify(db, content.author, "content", notify_title, notify_body)
    db.commit()


def publish(db: Session, admin: User, content: Content) -> None:
    _decide(db, admin, content, ContentStatus.published, "Your article was published", content.title)


def reject(db: Session, admin: User, content: Content) -> None:
    _decide(db, admin, content, ContentStatus.rejected, "Your article was not approved", content.title)


def request_changes(db: Session, admin: User, content: Content) -> None:
    _decide(db, admin, content, ContentStatus.draft, "Changes requested on your article", content.title)
