from datetime import datetime, timedelta

import pytest

from app.models.event import Event
from app.models.event_registration import EventRegistration, RegistrationStatus
from app.services import event_reminders
from app.services.event import NAIROBI

pytestmark = pytest.mark.integration

# Far enough ahead that no other test's events fall inside the scan window.
EVENT_START = datetime(2031, 3, 12, 14, 0, tzinfo=NAIROBI)  # a Wednesday, 2 PM
EVENING_BEFORE = datetime(2031, 3, 11, 18, 0, tzinfo=NAIROBI)
REGISTERED_AT = datetime(2031, 3, 1, 9, 0, tzinfo=NAIROBI)


@pytest.fixture
def make_registration(db_session, make_user):
    counter = {"n": 0}

    def _make(*, starts_at=EVENT_START, status=RegistrationStatus.approved, created_at=REGISTERED_AT, guest=False):
        counter["n"] += 1
        event = Event(
            slug=f"reminder-event-{counter['n']}-{starts_at.timestamp():.0f}",
            title=f"Reminder Event {counter['n']}",
            starts_at=starts_at,
            venue="Main Hall",
        )
        db_session.add(event)
        db_session.flush()
        if guest:
            registration = EventRegistration(event_id=event.id, guest_name="Wanjiku Guest", guest_email="guest@example.com")
        else:
            registration = EventRegistration(event_id=event.id, user_id=make_user().id)
        registration.status = status
        registration.created_at = created_at
        db_session.add(registration)
        db_session.commit()
        return registration

    return _make


def _for(sent, registration):
    to = registration.user.email if registration.user else registration.guest_email
    return [m for m in sent if m["to"] == to]


def test_nothing_goes_out_before_the_evening_before(db_session, mock_email, make_registration):
    registration = make_registration()
    event_reminders.send_due_reminders(db_session, now=EVENING_BEFORE - timedelta(minutes=5))
    assert _for(mock_email, registration) == []


def test_evening_before_reminder_sends_once(db_session, mock_email, make_registration):
    registration = make_registration()
    event_reminders.send_due_reminders(db_session, now=EVENING_BEFORE + timedelta(minutes=2))
    event_reminders.send_due_reminders(db_session, now=EVENING_BEFORE + timedelta(minutes=7))
    sent = _for(mock_email, registration)
    assert len(sent) == 1
    assert sent[0]["subject"].startswith("Tomorrow")


def test_hour_before_reminder_sends_once(db_session, mock_email, make_registration):
    registration = make_registration()
    event_reminders.send_due_reminders(db_session, now=EVENING_BEFORE + timedelta(minutes=2))
    event_reminders.send_due_reminders(db_session, now=EVENT_START - timedelta(minutes=58))
    event_reminders.send_due_reminders(db_session, now=EVENT_START - timedelta(minutes=53))
    subjects = [m["subject"] for m in _for(mock_email, registration)]
    assert len(subjects) == 2
    assert subjects[1].startswith("Starting in 1 hour")


def test_guests_get_reminders_too(db_session, mock_email, make_registration):
    registration = make_registration(guest=True)
    event_reminders.send_due_reminders(db_session, now=EVENING_BEFORE + timedelta(minutes=2))
    sent = _for(mock_email, registration)
    assert len(sent) == 1
    assert "Hi Wanjiku" in sent[0]["html"]


@pytest.mark.parametrize("status", [RegistrationStatus.pending, RegistrationStatus.waitlisted, RegistrationStatus.cancelled])
def test_only_approved_registrations_are_reminded(db_session, mock_email, make_registration, status):
    registration = make_registration(status=status)
    event_reminders.send_due_reminders(db_session, now=EVENT_START - timedelta(minutes=58))
    assert _for(mock_email, registration) == []


def test_missed_evening_window_never_sends_late(db_session, mock_email, make_registration):
    # e.g. the API was down all evening — the first tick is already inside
    # the hour-before window, so only that one should go out.
    registration = make_registration()
    event_reminders.send_due_reminders(db_session, now=EVENT_START - timedelta(minutes=58))
    event_reminders.send_due_reminders(db_session, now=EVENT_START - timedelta(minutes=53))
    subjects = [m["subject"] for m in _for(mock_email, registration)]
    assert len(subjects) == 1
    assert subjects[0].startswith("Starting in 1 hour")


def test_registering_after_the_evening_skips_the_evening_reminder(db_session, mock_email, make_registration):
    registration = make_registration(created_at=EVENING_BEFORE + timedelta(hours=2))
    event_reminders.send_due_reminders(db_session, now=EVENING_BEFORE + timedelta(hours=2, minutes=5))
    assert _for(mock_email, registration) == []
    event_reminders.send_due_reminders(db_session, now=EVENT_START - timedelta(minutes=58))
    assert len(_for(mock_email, registration)) == 1


def test_early_morning_event_skips_evening_reminder_when_too_close(db_session, mock_email, make_registration):
    # 1 AM event: "6 PM the evening before" is 7 hours out — fine. But a
    # first tick at 11 PM (2h out) is too close to bother with both.
    starts_at = datetime(2031, 4, 2, 1, 0, tzinfo=NAIROBI)
    registration = make_registration(starts_at=starts_at)
    event_reminders.send_due_reminders(db_session, now=starts_at - timedelta(hours=2))
    assert _for(mock_email, registration) == []


def test_day_before_send_time_uses_nairobi_calendar_day():
    # 1 AM Nairobi on the 2nd is still the 1st in UTC — the reminder must
    # follow the club's local calendar, not UTC's.
    starts_at = datetime(2031, 4, 2, 1, 0, tzinfo=NAIROBI)
    assert event_reminders.day_before_send_time(starts_at) == datetime(2031, 4, 1, 18, 0, tzinfo=NAIROBI)
