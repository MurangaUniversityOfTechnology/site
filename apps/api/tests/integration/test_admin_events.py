from datetime import UTC, datetime, timedelta

import pytest

from app.models.audit_log import AuditLog
from app.models.event import Event, EventAudience
from app.models.event_registration import EventRegistration, RegistrationStatus
from app.models.membership import MembershipStatus

pytestmark = pytest.mark.integration


def _payload(**overrides):
    payload = {
        "slug": "test-event",
        "title": "Test Event",
        "starts_at": "2026-10-01T17:00:00Z",
        "venue": "Lab 1",
        "description": "A test event.",
        "audience": "open_to_all",
        "fee_kes": 0,
        "capacity": 10,
    }
    payload.update(overrides)
    return payload


def test_create_event(client, make_user, login_as):
    admin = make_user(is_admin=True)
    login_as(admin)

    res = client.post("/admin/events", json=_payload())
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["slug"] == "test-event"
    assert body["seats_left"] == 10
    assert body["registration_count"] == 0


def test_create_event_rejects_duplicate_slug(client, db_session, make_user, login_as):
    admin = make_user(is_admin=True)
    login_as(admin)
    db_session.add(
        Event(slug="test-event", title="Existing", starts_at=datetime.now(UTC), venue="V", description="d")
    )
    db_session.commit()

    res = client.post("/admin/events", json=_payload())
    assert res.status_code == 400


def test_create_event_requires_admin(client, make_user, login_as):
    user = make_user()
    login_as(user)
    res = client.post("/admin/events", json=_payload())
    assert res.status_code == 403


def test_update_event_patches_only_provided_fields(client, db_session, make_user, login_as):
    admin = make_user(is_admin=True)
    login_as(admin)
    event = Event(
        slug="test-event",
        title="Original title",
        starts_at=datetime.now(UTC),
        venue="Original venue",
        description="Original description",
    )
    db_session.add(event)
    db_session.commit()

    res = client.patch("/admin/events/test-event", json={"title": "New title"})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["title"] == "New title"
    assert body["venue"] == "Original venue"
    assert body["description"] == "Original description"


def test_update_event_can_null_out_capacity(client, db_session, make_user, login_as):
    admin = make_user(is_admin=True)
    login_as(admin)
    event = Event(
        slug="test-event", title="T", starts_at=datetime.now(UTC), venue="V", description="d", capacity=10
    )
    db_session.add(event)
    db_session.commit()

    res = client.patch("/admin/events/test-event", json={"capacity": None})
    assert res.status_code == 200, res.text
    assert res.json()["capacity"] is None
    assert res.json()["seats_left"] is None


def test_delete_event_without_registrations(client, db_session, make_user, login_as):
    admin = make_user(is_admin=True)
    login_as(admin)
    db_session.add(Event(slug="test-event", title="T", starts_at=datetime.now(UTC), venue="V", description="d"))
    db_session.commit()

    res = client.delete("/admin/events/test-event")
    assert res.status_code == 204
    assert db_session.query(Event).filter(Event.slug == "test-event").first() is None


def test_delete_event_blocked_when_registrations_exist(client, db_session, make_user, login_as):
    admin = make_user(is_admin=True)
    login_as(admin)
    event = Event(slug="test-event", title="T", starts_at=datetime.now(UTC), venue="V", description="d")
    db_session.add(event)
    db_session.commit()
    db_session.add(EventRegistration(event_id=event.id, guest_name="G", guest_email="g@example.com"))
    db_session.commit()

    res = client.delete("/admin/events/test-event")
    assert res.status_code == 400
    assert db_session.query(Event).filter(Event.slug == "test-event").first() is not None


def test_list_public_events_computes_seats_left(client, db_session, make_user):
    event = Event(
        slug="test-event",
        title="T",
        starts_at=datetime.now(UTC),
        venue="V",
        description="d",
        capacity=2,
        audience=EventAudience.open_to_all,
    )
    db_session.add(event)
    db_session.commit()
    member = make_user(membership_status=MembershipStatus.active)
    db_session.add(EventRegistration(event_id=event.id, user_id=member.id, status=RegistrationStatus.approved))
    db_session.commit()

    res = client.get("/events")
    assert res.status_code == 200
    row = next(r for r in res.json() if r["slug"] == "test-event")
    assert row["seats_left"] == 1


def test_get_public_event_detail_includes_schedule(client, db_session):
    event = Event(
        slug="test-event",
        title="T",
        starts_at=datetime.now(UTC),
        venue="V",
        description="d",
        schedule=[{"time": "10:00", "what": "Kickoff"}],
        requirements=["A laptop"],
    )
    db_session.add(event)
    db_session.commit()

    res = client.get("/events/test-event")
    assert res.status_code == 200
    body = res.json()
    assert body["schedule"] == [{"time": "10:00", "what": "Kickoff"}]
    assert body["requirements"] == ["A laptop"]


def test_get_public_event_detail_404_for_unknown_slug(client):
    res = client.get("/events/unknown-slug")
    assert res.status_code == 404


def _past_event(db_session, **overrides):
    fields = {
        "slug": "past-event",
        "title": "Past Event",
        "starts_at": datetime.now(UTC) - timedelta(days=7),
        "venue": "V",
        "description": "d",
    }
    fields.update(overrides)
    event = Event(**fields)
    db_session.add(event)
    db_session.commit()
    return event


def test_archive_event_requires_admin(client, db_session, make_user, login_as):
    _past_event(db_session)
    user = make_user()
    login_as(user)

    res = client.post("/admin/events/past-event/archive")
    assert res.status_code == 403


def test_archive_past_event(client, db_session, make_user, login_as):
    _past_event(db_session)
    admin = make_user(is_admin=True)
    login_as(admin)

    res = client.post("/admin/events/past-event/archive")
    assert res.status_code == 200, res.text
    assert res.json()["archived_at"] is not None

    assert db_session.query(AuditLog).filter(AuditLog.actor_id == admin.id, AuditLog.kind == "event").count() == 1


def test_cannot_archive_future_event(client, db_session, make_user, login_as):
    _past_event(db_session, starts_at=datetime.now(UTC) + timedelta(days=7))
    admin = make_user(is_admin=True)
    login_as(admin)

    res = client.post("/admin/events/past-event/archive")
    assert res.status_code == 400


def test_cannot_archive_already_archived_event(client, db_session, make_user, login_as):
    _past_event(db_session)
    admin = make_user(is_admin=True)
    login_as(admin)
    client.post("/admin/events/past-event/archive")

    res = client.post("/admin/events/past-event/archive")
    assert res.status_code == 400


def test_unarchive_event(client, db_session, make_user, login_as):
    _past_event(db_session)
    admin = make_user(is_admin=True)
    login_as(admin)
    client.post("/admin/events/past-event/archive")

    res = client.post("/admin/events/past-event/unarchive")
    assert res.status_code == 200, res.text
    assert res.json()["archived_at"] is None


def test_cannot_unarchive_event_that_isnt_archived(client, db_session, make_user, login_as):
    _past_event(db_session)
    admin = make_user(is_admin=True)
    login_as(admin)

    res = client.post("/admin/events/past-event/unarchive")
    assert res.status_code == 400


def test_admin_events_list_excludes_archived_by_default(client, db_session, make_user, login_as):
    _past_event(db_session)
    admin = make_user(is_admin=True)
    login_as(admin)
    client.post("/admin/events/past-event/archive")

    res = client.get("/admin/events")
    assert res.json() == []

    res = client.get("/admin/events", params={"archived": "true"})
    assert [e["slug"] for e in res.json()] == ["past-event"]


def test_public_events_list_excludes_archived(client, db_session, make_user, login_as):
    _past_event(db_session)
    admin = make_user(is_admin=True)
    login_as(admin)
    client.post("/admin/events/past-event/archive")

    res = client.get("/events")
    assert res.json() == []

    res = client.get("/events/archived")
    assert [e["slug"] for e in res.json()] == ["past-event"]


def test_archived_event_still_reachable_by_direct_slug(client, db_session, make_user, login_as):
    _past_event(db_session)
    admin = make_user(is_admin=True)
    login_as(admin)
    client.post("/admin/events/past-event/archive")

    res = client.get("/events/past-event")
    assert res.status_code == 200
    assert res.json()["slug"] == "past-event"
