"""Reminder emails for upcoming events.

Automatic: one the evening before and one shortly before the event, timed
by the EventReminderSettings row admins edit at /admin/event-reminders.
Driven by app/core/scheduler.py, which calls send_due_reminders() every few
minutes; everything there is idempotent per registration (the *_sent_at
stamps), so a missed or doubled tick never double-sends.

Manual: staff can email an event's registrants on demand from its admin
page — the standard reminder, or a message of their own.
"""

import html
import logging
from datetime import UTC, datetime, time, timedelta
from typing import NamedTuple

from sqlalchemy.orm import Session, joinedload

from app.core.config import get_settings
from app.models.event import Event
from app.models.event_registration import EventRegistration, RegistrationStatus
from app.models.event_reminder_settings import EventReminderSettings
from app.models.user import User
from app.services import audit
from app.services import email as email_service
from app.services.email_templates import render_email
from app.services.event import NAIROBI, _format_event_datetime

settings = get_settings()
logger = logging.getLogger(__name__)

# Past this point the shortly-before email is close enough that a separate
# evening-before one would just be noise (e.g. an 8 AM event, where 6 PM
# the day before is still fine, vs. a registration approved at 11 PM for
# a 1 AM event, where it isn't).
DAY_BEFORE_CUTOFF = timedelta(hours=3)
MIN_LEAD_MINUTES = 10
MAX_LEAD_MINUTES = 12 * 60


class ReminderError(Exception):
    pass


class OutgoingEmail(NamedTuple):
    to: str
    subject: str
    html: str


# ── settings ─────────────────────────────────────────────────────────────


def get_reminder_settings(db: Session) -> EventReminderSettings:
    row = db.query(EventReminderSettings).first()
    if row is None:
        row = EventReminderSettings(
            day_before_enabled=True,
            day_before_time=time(18, 0),
            hour_before_enabled=True,
            hour_before_minutes=60,
            include_pending=False,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def update_reminder_settings(db: Session, admin: User, fields: dict) -> EventReminderSettings:
    minutes = fields.get("hour_before_minutes")
    if minutes is not None and not MIN_LEAD_MINUTES <= minutes <= MAX_LEAD_MINUTES:
        raise ReminderError(f"The before-event reminder must be {MIN_LEAD_MINUTES} minutes to 12 hours ahead")
    row = get_reminder_settings(db)
    for key, value in fields.items():
        setattr(row, key, value)
    row.updated_by_id = admin.id
    audit.log(db, admin, "event", f"Updated event reminder settings ({describe(row)})")
    db.commit()
    db.refresh(row)
    return row


def describe(s: EventReminderSettings) -> str:
    parts = []
    if s.day_before_enabled:
        parts.append(f"evening before at {s.day_before_time.strftime('%-I:%M %p')}")
    if s.hour_before_enabled:
        parts.append(f"{_lead_phrase(s.hour_before_minutes)} before")
    if not parts:
        return "automatic reminders off"
    return ", ".join(parts) + ("; pending included" if s.include_pending else "")


def _reminded_statuses(s: EventReminderSettings) -> list[RegistrationStatus]:
    statuses = [RegistrationStatus.approved]
    if s.include_pending:
        statuses.append(RegistrationStatus.pending)
    return statuses


# ── rendering ────────────────────────────────────────────────────────────


def _lead_phrase(minutes: int) -> str:
    """60 → "1 hour", 90 → "1.5 hours", 30 → "30 minutes"."""
    if minutes < 60:
        return f"{minutes} minutes"
    hours = minutes / 60
    return "1 hour" if hours == 1 else f"{hours:g} hours"


def day_before_send_time(starts_at: datetime, at: time = time(18, 0)) -> datetime:
    local_day = starts_at.astimezone(NAIROBI).date() - timedelta(days=1)
    return datetime.combine(local_day, at, tzinfo=NAIROBI)


def _recipient(registration: EventRegistration) -> tuple[str | None, str]:
    """(email, first name to greet) — "there" when no name is on file."""
    if registration.user:
        profile = registration.user.profile
        name = (profile.first_name or profile.display_name) if profile else None
        return registration.user.email, (name or "there").split()[0]
    return registration.guest_email, ((registration.guest_name or "").split() or ["there"])[0]


def _event_box(event: Event) -> str:
    return (
        '<div style="margin-top:14px;padding:14px 16px;background:#faf8f3;border:1px solid #ddd6c4;'
        'border-radius:8px;font-size:14px;line-height:1.7;">'
        f"<strong>{_format_event_datetime(event.starts_at)}</strong><br />{html.escape(event.venue)}"
        "</div>"
    )


def _cta(registration: EventRegistration) -> tuple[str, str]:
    """Confirmed spots get their ticket; everyone else the event page."""
    event = registration.event
    if registration.status in (RegistrationStatus.approved, RegistrationStatus.attended):
        return "View your ticket", f"{settings.web_origin}/events/{event.slug}/pass"
    return "View the event", f"{settings.web_origin}/events/{event.slug}"


def _pending_note(registration: EventRegistration) -> str:
    if registration.status != RegistrationStatus.pending:
        return ""
    return (
        '<p style="margin-top:14px;">Heads-up: your registration is <strong>still pending</strong> '
        "approval — you&rsquo;ll get your ticket once it&rsquo;s confirmed.</p>"
    )


def _reminder_email(registration: EventRegistration, *, eyebrow: str, heading: str, lead: str, subject: str) -> OutgoingEmail | None:
    to, first_name = _recipient(registration)
    if not to:
        return None
    event = registration.event
    ticket_note = (
        '<p style="margin-top:14px;">Have your ticket ready at the door — it&rsquo;s the QR code in your '
        "confirmation email, or on the ticket page below.</p>"
        if registration.status == RegistrationStatus.approved
        else _pending_note(registration)
    )
    cta_label, cta_url = _cta(registration)
    body = render_email(
        eyebrow=eyebrow,
        heading=heading,
        body_html=f"Hi {html.escape(first_name)}, {lead}" + _event_box(event) + ticket_note,
        cta_label=cta_label,
        cta_url=cta_url,
    )
    return OutgoingEmail(to=to, subject=subject, html=body)


def _day_before_email(registration: EventRegistration) -> OutgoingEmail | None:
    title = html.escape(registration.event.title)
    return _reminder_email(
        registration,
        eyebrow="tomorrow",
        heading="See you tomorrow.",
        lead=f"just a heads-up that <strong>{title}</strong> is tomorrow.",
        subject=f"Tomorrow — {registration.event.title}",
    )


def _shortly_before_email(registration: EventRegistration, minutes: int) -> OutgoingEmail | None:
    title = html.escape(registration.event.title)
    phrase = _lead_phrase(minutes)
    return _reminder_email(
        registration,
        eyebrow="starting soon",
        heading=f"See you in {'an hour' if minutes == 60 else phrase}.",
        lead=f"<strong>{title}</strong> starts in about {'an hour' if minutes == 60 else phrase}.",
        subject=f"Starting in {phrase} — {registration.event.title}",
    )


def deliver(messages: list[OutgoingEmail]) -> int:
    """Sends each message, logging (not raising) individual failures so one
    bad address doesn't stop the rest. Returns how many went out."""
    sent = 0
    for m in messages:
        try:
            email_service.send_email(to=m.to, subject=m.subject, html=m.html)
            sent += 1
        except Exception:
            logger.warning("Failed to send event email to %s (%r)", m.to, m.subject, exc_info=True)
    return sent


# ── automatic reminders ──────────────────────────────────────────────────


def send_due_reminders(db: Session, now: datetime | None = None) -> int:
    """Sends every automatic reminder that's due as of `now` and returns how
    many went out."""
    now = now or datetime.now(UTC)
    config = get_reminder_settings(db)
    if not (config.day_before_enabled or config.hour_before_enabled):
        return 0
    lead = timedelta(minutes=config.hour_before_minutes)

    candidates = (
        db.query(EventRegistration)
        .join(Event, EventRegistration.event_id == Event.id)
        .options(joinedload(EventRegistration.event), joinedload(EventRegistration.user))
        .filter(
            EventRegistration.status.in_(_reminded_statuses(config)),
            Event.archived_at.is_(None),
            Event.starts_at > now,
            # Nothing is ever due earlier than the evening before, which is
            # at most ~2 days out — keeps the scan to a handful of rows.
            Event.starts_at <= now + timedelta(days=2),
            (EventRegistration.reminder_day_before_sent_at.is_(None))
            | (EventRegistration.reminder_hour_before_sent_at.is_(None)),
        )
        # SKIP LOCKED: if two API processes tick at once, each row is only
        # picked up (and so only emailed) by one of them.
        .with_for_update(of=EventRegistration, skip_locked=True)
        .all()
    )

    due: list[OutgoingEmail | None] = []
    for registration in candidates:
        starts_at = registration.event.starts_at
        created_at = registration.created_at or now

        # Checked against the configured lead even when that reminder is
        # switched off, so the evening-before one still closes on time.
        if registration.reminder_hour_before_sent_at is None and now >= starts_at - lead:
            registration.reminder_hour_before_sent_at = now
            # Whatever happened with the evening-before one, its window is
            # gone now — close it so it can never go out after this.
            registration.reminder_day_before_sent_at = registration.reminder_day_before_sent_at or now
            # Registered inside the window: they've just seen the event
            # page / confirmation, a reminder would only be noise.
            if config.hour_before_enabled and created_at < starts_at - lead:
                due.append(_shortly_before_email(registration, config.hour_before_minutes))
            continue

        day_before_at = day_before_send_time(starts_at, config.day_before_time)
        if registration.reminder_day_before_sent_at is None and now >= day_before_at:
            registration.reminder_day_before_sent_at = now
            if config.day_before_enabled and created_at < day_before_at and starts_at - now > DAY_BEFORE_CUTOFF:
                due.append(_day_before_email(registration))

    # Stamp first, send after: SMTP is slow and can fail halfway, and a
    # missed reminder is far better than the same one landing every tick.
    db.commit()
    return deliver([m for m in due if m])


# ── manual emails ────────────────────────────────────────────────────────

AUDIENCES: dict[str, list[RegistrationStatus]] = {
    "confirmed": [RegistrationStatus.approved, RegistrationStatus.attended],
    "pending": [RegistrationStatus.pending],
    "waitlisted": [RegistrationStatus.waitlisted],
    "everyone": [
        RegistrationStatus.approved,
        RegistrationStatus.attended,
        RegistrationStatus.pending,
        RegistrationStatus.waitlisted,
    ],
}


def _message_html(message: str) -> str:
    """Plain text from the admin form → escaped HTML paragraphs."""
    paragraphs = [p.strip() for p in message.replace("\r\n", "\n").split("\n\n") if p.strip()]
    return "".join(
        f'<p style="margin:14px 0 0;">{html.escape(p).replace(chr(10), "<br />")}</p>' for p in paragraphs
    )


def _custom_email(registration: EventRegistration, subject: str, message: str) -> OutgoingEmail | None:
    to, first_name = _recipient(registration)
    if not to:
        return None
    event = registration.event
    cta_label, cta_url = _cta(registration)
    body = render_email(
        eyebrow="event update",
        heading=html.escape(event.title),
        body_html=f"Hi {html.escape(first_name)},{_message_html(message)}{_event_box(event)}",
        cta_label=cta_label,
        cta_url=cta_url,
    )
    return OutgoingEmail(to=to, subject=subject, html=body)


def _manual_reminder_email(registration: EventRegistration, now: datetime) -> OutgoingEmail | None:
    event = registration.event
    title = html.escape(event.title)
    days = (event.starts_at.astimezone(NAIROBI).date() - now.astimezone(NAIROBI).date()).days
    when = "today" if days == 0 else "tomorrow" if days == 1 else f"in {days} days"
    return _reminder_email(
        registration,
        eyebrow="reminder",
        heading="Don't forget.",
        lead=f"a reminder that <strong>{title}</strong> is {when}.",
        subject=f"Reminder — {event.title}",
    )


def prepare_manual_email(
    db: Session,
    admin: User,
    event: Event,
    *,
    audience: str,
    kind: str,
    subject: str | None = None,
    message: str | None = None,
    now: datetime | None = None,
) -> list[OutgoingEmail]:
    """Builds (but doesn't send) one email per registrant in `audience`, so
    the caller can hand the slow SMTP part to a background task. Each
    address gets at most one copy."""
    now = now or datetime.now(UTC)
    if audience not in AUDIENCES:
        raise ReminderError("Pick who to email")
    if kind == "reminder":
        if event.starts_at <= now:
            raise ReminderError("This event has already started — send a custom message instead")
    elif kind == "custom":
        subject, message = (subject or "").strip(), (message or "").strip()
        if not subject or not message:
            raise ReminderError("A custom email needs a subject and a message")
    else:
        raise ReminderError("Unknown email type")

    registrations = (
        db.query(EventRegistration)
        .options(joinedload(EventRegistration.event), joinedload(EventRegistration.user))
        .filter(EventRegistration.event_id == event.id, EventRegistration.status.in_(AUDIENCES[audience]))
        .order_by(EventRegistration.created_at)
        .all()
    )
    messages: dict[str, OutgoingEmail] = {}
    for registration in registrations:
        m = (
            _manual_reminder_email(registration, now)
            if kind == "reminder"
            else _custom_email(registration, subject, message)  # type: ignore[arg-type]
        )
        if m and m.to.lower() not in messages:
            messages[m.to.lower()] = m
    if not messages:
        raise ReminderError("Nobody in that group to email")

    what = "a reminder" if kind == "reminder" else f"'{subject}'"
    audit.log(db, admin, "event", f"Emailed {what} to {len(messages)} {audience} registrant(s) of '{event.title}'")
    db.commit()
    return list(messages.values())
