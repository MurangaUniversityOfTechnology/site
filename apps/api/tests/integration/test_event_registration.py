import pytest

from app.models.event import Event, EventAudience
from app.models.event_registration import RegistrationStatus
from app.models.membership import MembershipStatus
from app.services import event as event_service

pytestmark = pytest.mark.integration


@pytest.fixture
def make_event(db_session):
    counter = {"n": 0}

    def _make(*, capacity=None, audience=EventAudience.open_to_all, fee_kes=0):
        counter["n"] += 1
        event = Event(slug=f"event-{counter['n']}", title=f"Event {counter['n']}", capacity=capacity, audience=audience, fee_kes=fee_kes)
        db_session.add(event)
        db_session.commit()
        db_session.refresh(event)
        return event

    return _make


# ── registration gating ─────────────────────────────────────────────────


def test_register_open_event_as_member(db_session, make_user, make_event):
    event = make_event()
    user = make_user()
    reg = event_service.register(db_session, event.slug, user)
    assert reg.status == RegistrationStatus.pending


def test_register_members_only_event_requires_active_membership(db_session, make_user, make_event):
    event = make_event(audience=EventAudience.members_only)
    user = make_user(membership_status=MembershipStatus.none)
    with pytest.raises(event_service.EventError):
        event_service.register(db_session, event.slug, user)


def test_register_members_only_event_succeeds_when_active(db_session, make_user, make_event):
    event = make_event(audience=EventAudience.members_only)
    user = make_user(membership_status=MembershipStatus.active)
    reg = event_service.register(db_session, event.slug, user)
    assert reg.status == RegistrationStatus.pending


def test_guest_registration_requires_name_and_email(db_session, make_event):
    event = make_event()
    with pytest.raises(event_service.EventError):
        event_service.register(db_session, event.slug, None)


def test_guest_registration_succeeds_with_name_and_email(db_session, make_event):
    event = make_event()
    reg = event_service.register(db_session, event.slug, None, guest_name="Guest Person", guest_email="guest@example.com")
    assert reg.status == RegistrationStatus.pending
    assert reg.user_id is None
    assert reg.guest_name == "Guest Person"


def test_guest_registration_blocked_for_members_only_event(db_session, make_event):
    event = make_event(audience=EventAudience.members_only)
    with pytest.raises(event_service.EventError):
        event_service.register(db_session, event.slug, None, guest_name="Guest", guest_email="guest@example.com")


def test_duplicate_registration_blocked(db_session, make_user, make_event):
    event = make_event()
    user = make_user()
    event_service.register(db_session, event.slug, user)
    with pytest.raises(event_service.EventError):
        event_service.register(db_session, event.slug, user)


# ── capacity / waitlist ─────────────────────────────────────────────────


def test_capacity_auto_waitlists_once_full(db_session, make_user, make_event):
    event = make_event(capacity=1)
    first = make_user(email="first@example.com")
    second = make_user(email="second@example.com")

    reg1 = event_service.register(db_session, event.slug, first)
    reg2 = event_service.register(db_session, event.slug, second)

    assert reg1.status == RegistrationStatus.pending
    assert reg2.status == RegistrationStatus.waitlisted


def test_rejected_registration_does_not_count_against_capacity(db_session, make_user, make_event):
    event = make_event(capacity=1)
    admin = make_user(is_admin=True, email="admin@example.com")
    first = make_user(email="first@example.com")
    second = make_user(email="second@example.com")

    reg1 = event_service.register(db_session, event.slug, first)
    event_service.reject(db_session, admin, reg1)

    reg2 = event_service.register(db_session, event.slug, second)
    assert reg2.status == RegistrationStatus.pending  # slot freed up, not waitlisted


# ── admin transitions ───────────────────────────────────────────────────


def test_approve_from_pending(db_session, make_user, make_event):
    event = make_event()
    admin = make_user(is_admin=True, email="admin@example.com")
    user = make_user(email="attendee@example.com")
    reg = event_service.register(db_session, event.slug, user)

    event_service.approve(db_session, admin, reg)
    assert reg.status == RegistrationStatus.approved


def test_approve_from_waitlisted_is_allowed(db_session, make_user, make_event):
    event = make_event(capacity=1)
    admin = make_user(is_admin=True, email="admin@example.com")
    first = make_user(email="first@example.com")
    second = make_user(email="second@example.com")

    event_service.register(db_session, event.slug, first)
    reg2 = event_service.register(db_session, event.slug, second)
    assert reg2.status == RegistrationStatus.waitlisted

    event_service.approve(db_session, admin, reg2)  # pulling someone off the waitlist
    assert reg2.status == RegistrationStatus.approved


@pytest.mark.parametrize("from_status", [RegistrationStatus.rejected, RegistrationStatus.attended])
def test_approve_blocked_from_terminal_statuses(db_session, make_user, make_event, from_status):
    event = make_event()
    admin = make_user(is_admin=True, email="admin@example.com")
    user = make_user(email="attendee@example.com")
    reg = event_service.register(db_session, event.slug, user)
    reg.status = from_status
    db_session.commit()

    with pytest.raises(event_service.EventError):
        event_service.approve(db_session, admin, reg)


def test_waitlist_from_pending_is_allowed(db_session, make_user, make_event):
    event = make_event()
    admin = make_user(is_admin=True, email="admin@example.com")
    user = make_user(email="attendee@example.com")
    reg = event_service.register(db_session, event.slug, user)

    event_service.waitlist(db_session, admin, reg)
    assert reg.status == RegistrationStatus.waitlisted


def test_waitlist_from_approved_is_not_allowed(db_session, make_user, make_event):
    event = make_event()
    admin = make_user(is_admin=True, email="admin@example.com")
    user = make_user(email="attendee@example.com")
    reg = event_service.register(db_session, event.slug, user)
    event_service.approve(db_session, admin, reg)

    with pytest.raises(event_service.EventError):
        event_service.waitlist(db_session, admin, reg)


def test_mark_attended_from_approved(db_session, make_user, make_event):
    event = make_event()
    admin = make_user(is_admin=True, email="admin@example.com")
    user = make_user(email="attendee@example.com")
    reg = event_service.register(db_session, event.slug, user)
    event_service.approve(db_session, admin, reg)

    event_service.mark_attended(db_session, admin, reg)
    assert reg.status == RegistrationStatus.attended


@pytest.mark.parametrize("from_status", [RegistrationStatus.pending, RegistrationStatus.waitlisted, RegistrationStatus.rejected])
def test_mark_attended_requires_approved_first(db_session, make_user, make_event, from_status):
    event = make_event()
    admin = make_user(is_admin=True, email="admin@example.com")
    user = make_user(email="attendee@example.com")
    reg = event_service.register(db_session, event.slug, user)
    reg.status = from_status
    db_session.commit()

    with pytest.raises(event_service.EventError):
        event_service.mark_attended(db_session, admin, reg)


def test_guest_registration_transitions_use_guest_email_for_audit(db_session, make_user, make_event):
    event = make_event()
    admin = make_user(is_admin=True, email="admin@example.com")
    reg = event_service.register(db_session, event.slug, None, guest_name="Guest", guest_email="guest@example.com")

    event_service.approve(db_session, admin, reg)
    assert reg.status == RegistrationStatus.approved

    from app.models.audit_log import AuditLog

    entry = db_session.query(AuditLog).filter(AuditLog.actor_id == admin.id).first()
    assert "guest@example.com" in entry.action


# ── HTTP layer ───────────────────────────────────────────────────────────


def test_register_endpoint(client, db_session, make_user, make_event, login_as):
    event = make_event()
    user = make_user()
    login_as(user)

    res = client.post(f"/events/{event.slug}/register", json={})
    assert res.status_code == 201
    assert res.json()["status"] == "pending"


def test_admin_approve_registration_endpoint(client, db_session, make_user, make_event, login_as):
    event = make_event()
    admin = make_user(is_admin=True)
    user = make_user(email="attendee@example.com")
    reg = event_service.register(db_session, event.slug, user)
    login_as(admin)

    res = client.post(f"/admin/registrations/{reg.id}/approve")
    assert res.status_code == 204
