"""Reminder emails for upcoming events — one the evening before, one an hour
before. Driven by app/core/scheduler.py, which calls send_due_reminders()
every few minutes; everything here is idempotent per registration (the
*_sent_at stamps), so a missed or doubled tick never double-sends."""

import html
import logging
from datetime import UTC, datetime, time, timedelta

from sqlalchemy.orm import Session, joinedload

from app.core.config import get_settings
from app.models.event import Event
from app.models.event_registration import EventRegistration, RegistrationStatus
from app.services import email as email_service
from app.services.email_templates import render_email
from app.services.event import NAIROBI, _format_event_datetime

settings = get_settings()
logger = logging.getLogger(__name__)

# "The evening before" — 6 PM Nairobi time on the day before the event.
DAY_BEFORE_AT = time(18, 0)
HOUR_BEFORE = timedelta(hours=1)
# Past this point the hour-before email is close enough that a separate
# evening-before one would just be noise (e.g. an 8 AM event, where 6 PM
# the day before is still fine, vs. a registration approved at 11 PM for
# a 1 AM event, where it isn't).
DAY_BEFORE_CUTOFF = timedelta(hours=3)


def day_before_send_time(starts_at: datetime) -> datetime:
    local_day = starts_at.astimezone(NAIROBI).date() - timedelta(days=1)
    return datetime.combine(local_day, DAY_BEFORE_AT, tzinfo=NAIROBI)


def _recipient(registration: EventRegistration) -> tuple[str | None, str]:
    """(email, first name to greet) — "there" when no name is on file."""
    if registration.user:
        profile = registration.user.profile
        name = (profile.first_name or profile.display_name) if profile else None
        return registration.user.email, (name or "there").split()[0]
    return registration.guest_email, ((registration.guest_name or "").split() or ["there"])[0]


def _send(registration: EventRegistration, *, hour_before: bool) -> None:
    to, first_name = _recipient(registration)
    if not to:
        return
    first_name = html.escape(first_name)
    event = registration.event
    when = _format_event_datetime(event.starts_at)
    if hour_before:
        eyebrow, heading = "starting soon", "See you in an hour."
        lead = f"Hi {first_name}, <strong>{event.title}</strong> starts in about an hour."
        subject = f"Starting in 1 hour — {event.title}"
    else:
        eyebrow, heading = "tomorrow", "See you tomorrow."
        lead = f"Hi {first_name}, just a heads-up that <strong>{event.title}</strong> is tomorrow."
        subject = f"Tomorrow — {event.title}"
    body = render_email(
        eyebrow=eyebrow,
        heading=heading,
        body_html=(
            lead
            + '<div style="margin-top:14px;padding:14px 16px;background:#faf8f3;border:1px solid #ddd6c4;'
            'border-radius:8px;font-size:14px;line-height:1.7;">'
            f"<strong>{when}</strong><br />{event.venue}"
            "</div>"
            '<p style="margin-top:14px;">Have your ticket ready at the door — it&rsquo;s the QR code in your '
            "confirmation email, or on the ticket page below.</p>"
        ),
        cta_label="View your ticket",
        cta_url=f"{settings.web_origin}/events/{event.slug}/pass",
    )
    try:
        email_service.send_email(to=to, subject=subject, html=body)
    except Exception:
        logger.warning("Failed to send event reminder for registration %s", registration.id, exc_info=True)


def send_due_reminders(db: Session, now: datetime | None = None) -> int:
    """Sends every reminder that's due as of `now` and returns how many went
    out. Only approved registrations (a confirmed spot) get reminders."""
    now = now or datetime.now(UTC)
    candidates = (
        db.query(EventRegistration)
        .join(Event, EventRegistration.event_id == Event.id)
        .options(joinedload(EventRegistration.event), joinedload(EventRegistration.user))
        .filter(
            EventRegistration.status == RegistrationStatus.approved,
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

    due: list[tuple[EventRegistration, bool]] = []
    for registration in candidates:
        starts_at = registration.event.starts_at
        created_at = registration.created_at or now

        if registration.reminder_hour_before_sent_at is None and now >= starts_at - HOUR_BEFORE:
            registration.reminder_hour_before_sent_at = now
            # Whatever happened with the evening-before one, its window is
            # gone now — close it so it can never go out after this.
            registration.reminder_day_before_sent_at = registration.reminder_day_before_sent_at or now
            # Registered inside the last hour: they've just seen the event
            # page / confirmation, a reminder would only be noise.
            if created_at < starts_at - HOUR_BEFORE:
                due.append((registration, True))
            continue

        day_before_at = day_before_send_time(starts_at)
        if registration.reminder_day_before_sent_at is None and now >= day_before_at:
            registration.reminder_day_before_sent_at = now
            if created_at < day_before_at and starts_at - now > DAY_BEFORE_CUTOFF:
                due.append((registration, False))

    # Stamp first, send after: SMTP is slow and can fail halfway, and a
    # missed reminder is far better than the same one landing every tick.
    db.commit()
    for registration, hour_before in due:
        _send(registration, hour_before=hour_before)
    return len(due)
