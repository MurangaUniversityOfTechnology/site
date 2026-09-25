from datetime import datetime, time, timedelta

import pytest

from app.models.event import Event
from app.models.event_registration import EventRegistration, RegistrationStatus
from app.models.membership import MembershipStatus
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


# ── configurable settings ────────────────────────────────────────────────


def _configure(db_session, **fields):
    row = event_reminders.get_reminder_settings(db_session)
    for key, value in fields.items():
        setattr(row, key, value)
    db_session.commit()


def test_evening_send_time_is_configurable(db_session, mock_email, make_registration):
    _configure(db_session, day_before_time=time(20, 30))
    registration = make_registration()
    event_reminders.send_due_reminders(db_session, now=EVENING_BEFORE + timedelta(minutes=5))  # 6:05 PM
    assert _for(mock_email, registration) == []
    event_reminders.send_due_reminders(db_session, now=EVENING_BEFORE + timedelta(hours=2, minutes=35))  # 8:35 PM
    assert len(_for(mock_email, registration)) == 1


def test_shortly_before_lead_is_configurable(db_session, mock_email, make_registration):
    _configure(db_session, day_before_enabled=False, hour_before_minutes=30)
    registration = make_registration()
    event_reminders.send_due_reminders(db_session, now=EVENT_START - timedelta(minutes=50))
    assert _for(mock_email, registration) == []
    event_reminders.send_due_reminders(db_session, now=EVENT_START - timedelta(minutes=28))
    sent = _for(mock_email, registration)
    assert len(sent) == 1
    assert sent[0]["subject"].startswith("Starting in 30 minutes")


def test_disabled_reminders_never_send(db_session, mock_email, make_registration):
    _configure(db_session, day_before_enabled=False, hour_before_enabled=False)
    registration = make_registration()
    event_reminders.send_due_reminders(db_session, now=EVENING_BEFORE + timedelta(minutes=5))
    event_reminders.send_due_reminders(db_session, now=EVENT_START - timedelta(minutes=58))
    assert _for(mock_email, registration) == []


def test_disabled_evening_reminder_doesnt_go_out_late_when_reenabled(db_session, mock_email, make_registration):
    _configure(db_session, day_before_enabled=False)
    registration = make_registration()
    event_reminders.send_due_reminders(db_session, now=EVENING_BEFORE + timedelta(minutes=5))
    _configure(db_session, day_before_enabled=True)
    event_reminders.send_due_reminders(db_session, now=EVENING_BEFORE + timedelta(minutes=10))
    assert _for(mock_email, registration) == []


def test_include_pending_reminds_pending_with_a_note(db_session, mock_email, make_registration):
    _configure(db_session, include_pending=True)
    registration = make_registration(status=RegistrationStatus.pending)
    event_reminders.send_due_reminders(db_session, now=EVENING_BEFORE + timedelta(minutes=5))
    sent = _for(mock_email, registration)
    assert len(sent) == 1
    assert "still pending" in sent[0]["html"]
    assert "/pass" not in sent[0]["html"]  # no ticket yet — links the event page instead


# ── admin API ────────────────────────────────────────────────────────────


@pytest.fixture
def staff(make_user, login_as):
    user = make_user(is_staff=True, membership_status=MembershipStatus.active)
    login_as(user)
    return user


def test_settings_api_round_trip(client, staff):
    res = client.get("/admin/event-reminders/settings")
    assert res.status_code == 200
    assert res.json()["day_before_time"] == "18:00:00"
    res = client.put("/admin/event-reminders/settings", json={"day_before_time": "19:15", "hour_before_minutes": 90})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["day_before_time"] == "19:15:00" and body["hour_before_minutes"] == 90
    assert "7:15 PM" in body["summary"] and "1.5 hours" in body["summary"]


def test_settings_api_rejects_silly_lead_times(client, staff):
    assert client.put("/admin/event-reminders/settings", json={"hour_before_minutes": 2}).status_code == 400


def test_settings_api_is_staff_only(client, make_user, login_as):
    login_as(make_user())
    assert client.get("/admin/event-reminders/settings").status_code == 403
    assert client.put("/admin/event-reminders/settings", json={"include_pending": True}).status_code == 403
