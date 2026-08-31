import io
import logging
import uuid
from datetime import datetime, timedelta, timezone

import qrcode
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.event import Event, EventAudience
from app.models.event_registration import EventRegistration, RegistrationStatus
from app.models.membership import MembershipStatus
from app.models.user import User
from app.services import audit, notification
from app.services import email as email_service
from app.services.email_templates import render_email

settings = get_settings()
logger = logging.getLogger(__name__)

# Must match TICKET_QR_PREFIX in apps/web/src/app/events/[slug]/pass/page.tsx
# — the admin check-in scanner rejects anything without this prefix.
TICKET_QR_PREFIX = "mut-ticket:"

# The club runs on Africa/Nairobi time (UTC+3, no DST) — same fixed-offset
# convention as CLUB_UTC_OFFSET in apps/web/src/lib/eventFormat.ts, so a
# stored event time displays as the wall-clock time it was actually set to.
NAIROBI = timezone(timedelta(hours=3))


def _format_event_datetime(starts_at: datetime) -> str:
    local = starts_at.astimezone(NAIROBI)
    return local.strftime("%A, %-d %B · %-I:%M %p")


def _ticket_qr_png(registration_id: uuid.UUID) -> bytes:
    img = qrcode.make(f"{TICKET_QR_PREFIX}{registration_id}")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


class EventError(Exception):
    pass


def get_event(db: Session, slug: str) -> Event:
    event = db.query(Event).filter(Event.slug == slug).first()
    if not event:
        raise EventError(f"Unknown event '{slug}'")
    return event


def list_events(db: Session, archived: bool = False) -> list[Event]:
    query = db.query(Event).filter(Event.archived_at.isnot(None) if archived else Event.archived_at.is_(None))
    order = Event.starts_at.desc() if archived else Event.starts_at.asc()
    return query.order_by(order).all()


def _open_slots(db: Session, event: Event) -> int | None:
    if event.capacity is None:
        return None
    taken = (
        db.query(EventRegistration)
        .filter(
            EventRegistration.event_id == event.id,
            EventRegistration.status.in_([RegistrationStatus.pending, RegistrationStatus.approved, RegistrationStatus.attended]),
        )
        .count()
    )
    return event.capacity - taken


# Alias used by the public/admin read paths — same computation, clearer name
# than the registration-flow's internal "_open_slots".
seats_left = _open_slots


def create_event(db: Session, admin: User, fields: dict) -> Event:
    if db.query(Event).filter(Event.slug == fields["slug"]).first():
        raise EventError(f"An event with slug '{fields['slug']}' already exists")
    event = Event(**fields)
    db.add(event)
    audit.log(db, admin, "event", f"Created event {event.title}")
    db.commit()
    db.refresh(event)
    return event


def update_event(db: Session, admin: User, event: Event, fields: dict) -> Event:
    new_slug = fields.get("slug")
    if new_slug and new_slug != event.slug and db.query(Event).filter(Event.slug == new_slug).first():
        raise EventError(f"An event with slug '{new_slug}' already exists")
    for key, value in fields.items():
        setattr(event, key, value)
    audit.log(db, admin, "event", f"Updated event {event.title}")
    db.commit()
    db.refresh(event)
    return event


def delete_event(db: Session, admin: User, event: Event) -> None:
    count = db.query(EventRegistration).filter(EventRegistration.event_id == event.id).count()
    if count:
        raise EventError(f"Can't delete — {count} registration(s) exist for this event")
    audit.log(db, admin, "event", f"Deleted event {event.title}")
    db.delete(event)
    db.commit()


def archive_event(db: Session, admin: User, event: Event) -> Event:
    if event.archived_at is not None:
        raise EventError("Event is already archived")
    if event.starts_at > datetime.now(NAIROBI):
        raise EventError("Can't archive an event that hasn't happened yet")
    event.archived_at = datetime.now(NAIROBI)
    audit.log(db, admin, "event", f"Archived event {event.title}")
    db.commit()
    db.refresh(event)
    return event


def unarchive_event(db: Session, admin: User, event: Event) -> Event:
    if event.archived_at is None:
        raise EventError("Event is not archived")
    event.archived_at = None
    audit.log(db, admin, "event", f"Unarchived event {event.title}")
    db.commit()
    db.refresh(event)
    return event


def register(
    db: Session,
    slug: str,
    user: User | None,
    guest_name: str | None = None,
    guest_email: str | None = None,
) -> EventRegistration:
    event = get_event(db, slug)

    if event.audience == EventAudience.members_only:
        if not user:
            raise EventError("Sign in with an active membership to register for this event")
        if user.membership.status != MembershipStatus.active:
            raise EventError("Active club membership is required for this event")

    if user:
        existing = (
            db.query(EventRegistration)
            .filter(EventRegistration.event_id == event.id, EventRegistration.user_id == user.id)
            .first()
        )
        if existing:
            raise EventError("You've already registered for this event")
    else:
        if not guest_name or not guest_email:
            raise EventError("Name and email are required to register as a guest")

    slots = _open_slots(db, event)
    status = RegistrationStatus.waitlisted if slots is not None and slots <= 0 else RegistrationStatus.pending

    registration = EventRegistration(
        event_id=event.id,
        user_id=user.id if user else None,
        guest_name=None if user else guest_name,
        guest_email=None if user else guest_email,
        status=status,
    )
    db.add(registration)
    db.commit()
    db.refresh(registration)
    return registration


def my_registration(db: Session, slug: str, user: User) -> EventRegistration | None:
    event = db.query(Event).filter(Event.slug == slug).first()
    if not event:
        return None
    return (
        db.query(EventRegistration)
        .filter(EventRegistration.event_id == event.id, EventRegistration.user_id == user.id)
        .first()
    )


def list_for_event(db: Session, slug: str) -> list[EventRegistration]:
    event = get_event(db, slug)
    return (
        db.query(EventRegistration)
        .filter(EventRegistration.event_id == event.id)
        .order_by(EventRegistration.created_at.asc())
        .all()
    )


NOTIFY_TITLE = {
    RegistrationStatus.approved: "Registration confirmed ✓",
    RegistrationStatus.rejected: "Registration not approved",
    RegistrationStatus.waitlisted: "You're on the waitlist",
    RegistrationStatus.attended: "Attendance confirmed",
}


def _send_ticket_email(registration: EventRegistration) -> None:
    to = registration.user.email if registration.user else registration.guest_email
    if not to:
        return
    reference = str(registration.id)[:8].upper()
    pass_url = f"{settings.web_origin}/events/{registration.event.slug}/pass"
    when = _format_event_datetime(registration.event.starts_at)
    html = render_email(
        eyebrow="event ticket",
        heading="You're confirmed.",
        body_html=(
            f"Your spot for <strong>{registration.event.title}</strong> is booked. "
            f"Reference: <strong>{reference}</strong>."
            '<div style="margin-top:14px;padding:14px 16px;background:#faf8f3;border:1px solid #ddd6c4;'
            'border-radius:8px;font-size:14px;line-height:1.7;">'
            f"<strong>{when}</strong><br />{registration.event.venue}"
            "</div>"
            '<div style="margin-top:18px;text-align:center;">'
            '<img src="cid:ticket-qr" width="200" height="200" alt="Ticket QR code" '
            'style="display:inline-block;border:1px solid #ddd6c4;border-radius:8px;" />'
            "</div>"
            '<p style="margin-top:14px;">Show this QR code at the door — it&rsquo;s attached to this email, '
            "so it works even offline. Or bring up your account / the reference above instead.</p>"
        ),
        cta_label="View your ticket online",
        cta_url=pass_url,
    )
    try:
        email_service.send_email(
            to=to,
            subject=f"Your ticket — {registration.event.title}",
            html=html,
            inline_images=[email_service.InlineImage(cid="ticket-qr", data=_ticket_qr_png(registration.id))],
        )
    except Exception:
        logger.warning("Failed to send ticket email for registration %s", registration.id, exc_info=True)


def _transition(db: Session, admin: User, registration: EventRegistration, to: RegistrationStatus, allowed_from: set[RegistrationStatus]) -> None:
    if registration.status not in allowed_from:
        raise EventError(f"Cannot move registration from '{registration.status.value}' to '{to.value}'")
    registration.status = to
    who = registration.user.email if registration.user else registration.guest_email
    audit.log(db, admin, "event", f"{to.value.capitalize()} registration for {who} · {registration.event.title}")
    if registration.user:
        notification.notify(db, registration.user, "event", NOTIFY_TITLE[to], registration.event.title)
    db.commit()
    if to == RegistrationStatus.approved:
        _send_ticket_email(registration)


def approve(db: Session, admin: User, registration: EventRegistration) -> None:
    _transition(db, admin, registration, RegistrationStatus.approved, {RegistrationStatus.pending, RegistrationStatus.waitlisted})


def reject(db: Session, admin: User, registration: EventRegistration) -> None:
    _transition(db, admin, registration, RegistrationStatus.rejected, {RegistrationStatus.pending, RegistrationStatus.waitlisted})


def waitlist(db: Session, admin: User, registration: EventRegistration) -> None:
    _transition(db, admin, registration, RegistrationStatus.waitlisted, {RegistrationStatus.pending})


def mark_attended(db: Session, admin: User, registration: EventRegistration) -> None:
    _transition(db, admin, registration, RegistrationStatus.attended, {RegistrationStatus.approved})
