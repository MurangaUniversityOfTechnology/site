from sqlalchemy.orm import Session

from app.models.event import Event, EventAudience
from app.models.event_registration import EventRegistration, RegistrationStatus
from app.models.membership import MembershipStatus
from app.models.user import User
from app.services import audit


class EventError(Exception):
    pass


def get_event(db: Session, slug: str) -> Event:
    event = db.query(Event).filter(Event.slug == slug).first()
    if not event:
        raise EventError(f"Unknown event '{slug}'")
    return event


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


def _transition(db: Session, admin: User, registration: EventRegistration, to: RegistrationStatus, allowed_from: set[RegistrationStatus]) -> None:
    if registration.status not in allowed_from:
        raise EventError(f"Cannot move registration from '{registration.status.value}' to '{to.value}'")
    registration.status = to
    who = registration.user.email if registration.user else registration.guest_email
    audit.log(db, admin, "event", f"{to.value.capitalize()} registration for {who} · {registration.event.title}")
    db.commit()


def approve(db: Session, admin: User, registration: EventRegistration) -> None:
    _transition(db, admin, registration, RegistrationStatus.approved, {RegistrationStatus.pending, RegistrationStatus.waitlisted})


def reject(db: Session, admin: User, registration: EventRegistration) -> None:
    _transition(db, admin, registration, RegistrationStatus.rejected, {RegistrationStatus.pending, RegistrationStatus.waitlisted})


def waitlist(db: Session, admin: User, registration: EventRegistration) -> None:
    _transition(db, admin, registration, RegistrationStatus.waitlisted, {RegistrationStatus.pending})


def mark_attended(db: Session, admin: User, registration: EventRegistration) -> None:
    _transition(db, admin, registration, RegistrationStatus.attended, {RegistrationStatus.approved})
