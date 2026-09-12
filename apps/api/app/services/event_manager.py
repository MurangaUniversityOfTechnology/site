import logging
import secrets
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.event import Event
from app.models.event_manager import EventManager, EventManagerStatus
from app.models.user import User
from app.services import audit
from app.services import email as email_service
from app.services.email_templates import render_email

logger = logging.getLogger(__name__)
settings = get_settings()


class EventManagerError(Exception):
    pass


def is_active_manager(db: Session, event: Event, user: User) -> bool:
    return (
        db.query(EventManager)
        .filter(
            EventManager.event_id == event.id,
            EventManager.user_id == user.id,
            EventManager.status == EventManagerStatus.active,
        )
        .first()
        is not None
    )


def can_manage(db: Session, event: Event, user: User) -> bool:
    return user.is_admin or user.is_staff or is_active_manager(db, event, user)


def list_for_event(db: Session, event: Event) -> list[EventManager]:
    return (
        db.query(EventManager).filter(EventManager.event_id == event.id).order_by(EventManager.created_at.asc()).all()
    )


def get_by_id(db: Session, manager_id) -> EventManager:
    manager = db.get(EventManager, manager_id)
    if not manager:
        raise EventManagerError("Unknown event manager")
    return manager


def get_by_token(db: Session, token: str) -> EventManager:
    manager = db.query(EventManager).filter(EventManager.token == token).first()
    if not manager:
        raise EventManagerError("Unknown or expired invite")
    return manager


def _send_invite_email(manager: EventManager) -> None:
    inviter_name = manager.invited_by.profile.display_name if manager.invited_by.profile and manager.invited_by.profile.display_name else manager.invited_by.email
    accept_url = f"{settings.web_origin}/event-invites/{manager.token}"
    html = render_email(
        eyebrow="event manager invite",
        heading="You've been invited to help run an event.",
        body_html=(
            f"<strong>{inviter_name}</strong> invited you to manage <strong>{manager.event.title}</strong> — "
            "you'll be able to approve/reject registrations, add walk-in attendees, and scan tickets at the door, "
            "just for this one event."
        ),
        cta_label="Accept invite",
        cta_url=accept_url,
    )
    try:
        email_service.send_email(
            to=manager.invited_email,
            subject=f"You're invited to manage {manager.event.title}",
            html=html,
        )
    except Exception:
        logger.warning("Failed to send event manager invite email to %s", manager.invited_email, exc_info=True)


def invite_manager(db: Session, admin: User, event: Event, email: str) -> EventManager:
    email = email.strip().lower()
    manager = db.query(EventManager).filter(EventManager.event_id == event.id, EventManager.invited_email == email).first()
    if manager and manager.status == EventManagerStatus.active:
        raise EventManagerError(f"{email} already manages this event")

    token = secrets.token_urlsafe(32)
    if manager:
        manager.status = EventManagerStatus.invited
        manager.token = token
        manager.invited_by_id = admin.id
        manager.user_id = None
        manager.accepted_at = None
    else:
        manager = EventManager(event_id=event.id, invited_email=email, invited_by_id=admin.id, token=token)
        db.add(manager)

    audit.log(db, admin, "event", f"Invited {email} to manage '{event.title}'")
    db.commit()
    db.refresh(manager)
    _send_invite_email(manager)
    return manager


def revoke_manager(db: Session, admin: User, manager: EventManager) -> None:
    manager.status = EventManagerStatus.revoked
    audit.log(db, admin, "event", f"Revoked {manager.invited_email}'s manager access to '{manager.event.title}'")
    db.commit()


def accept_invite(db: Session, user: User, token: str) -> EventManager:
    manager = get_by_token(db, token)
    if manager.status != EventManagerStatus.invited:
        raise EventManagerError("This invite has already been used or was revoked")
    if manager.invited_email != user.email.strip().lower():
        raise EventManagerError(f"This invite was sent to {manager.invited_email} — sign in with that email")

    manager.user_id = user.id
    manager.status = EventManagerStatus.active
    manager.accepted_at = datetime.now(UTC)
    audit.log(db, user, "event", f"Accepted manager invite for '{manager.event.title}'")
    db.commit()
    db.refresh(manager)
    return manager
