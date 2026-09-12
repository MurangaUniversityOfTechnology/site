from datetime import UTC, datetime

import pytest

from app.models.event import Event, EventAudience
from app.models.event_manager import EventManager, EventManagerStatus
from app.models.event_payment import EventPayment
from app.models.event_registration import EventRegistration, RegistrationStatus
from app.models.membership import MembershipStatus
from app.models.payment import PaymentStatus
from app.services import event_manager as event_manager_service

pytestmark = pytest.mark.integration


@pytest.fixture
def make_event(db_session):
    counter = {"n": 0}

    def _make(*, fee_kes=0):
        counter["n"] += 1
        event = Event(
            slug=f"event-{counter['n']}",
            title=f"Event {counter['n']}",
            audience=EventAudience.open_to_all,
            fee_kes=fee_kes,
            starts_at=datetime.now(UTC),
            venue="Test Venue",
            description="Test description",
        )
        db_session.add(event)
        db_session.commit()
        db_session.refresh(event)
        return event

    return _make


@pytest.fixture
def admin(make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)
    return admin


# ── scoped access ────────────────────────────────────────────────────────


def test_non_manager_gets_403(client, make_event, make_user, login_as):
    event = make_event()
    user = make_user(membership_status=MembershipStatus.active)
    login_as(user)
    assert client.get(f"/events/{event.slug}/manage/registrations").status_code == 403


def test_unauthenticated_gets_401(client, make_event):
    event = make_event()
    assert client.get(f"/events/{event.slug}/manage/registrations").status_code == 401


def test_staff_can_manage_any_event_without_being_invited(client, make_event, make_user, login_as):
    event = make_event()
    staff = make_user(is_staff=True, membership_status=MembershipStatus.active)
    login_as(staff)
    assert client.get(f"/events/{event.slug}/manage/registrations").status_code == 200


def test_manager_of_one_event_cannot_manage_another(client, db_session, make_event, make_user, login_as, admin):
    event_a = make_event()
    event_b = make_event()
    manager_user = make_user(email="manager@example.com", membership_status=MembershipStatus.active)

    manager = event_manager_service.invite_manager(db_session, admin, event_a, manager_user.email)
    event_manager_service.accept_invite(db_session, manager_user, manager.token)

    login_as(manager_user)
    assert client.get(f"/events/{event_a.slug}/manage/registrations").status_code == 200
    assert client.get(f"/events/{event_b.slug}/manage/registrations").status_code == 403


# ── invite / accept ──────────────────────────────────────────────────────


def test_invite_then_accept_grants_access(client, db_session, make_event, make_user, login_as, admin):
    event = make_event()
    invitee = make_user(email="helper@example.com", membership_status=MembershipStatus.active)

    res = client.post(f"/admin/events/{event.slug}/managers/invite", json={"email": "helper@example.com"})
    assert res.status_code == 201, res.text
    assert res.json()["status"] == "invited"

    manager = db_session.query(EventManager).filter(EventManager.event_id == event.id).first()
    assert manager.status == EventManagerStatus.invited

    preview = client.get(f"/event-invites/{manager.token}")
    assert preview.status_code == 200
    assert preview.json()["event_slug"] == event.slug
    assert preview.json()["invited_email"] == "helper@example.com"

    login_as(invitee)
    accept = client.post(f"/event-invites/{manager.token}/accept")
    assert accept.status_code == 200, accept.text
    assert accept.json()["event_slug"] == event.slug

    assert client.get(f"/events/{event.slug}/manage/registrations").status_code == 200


def test_accept_rejects_wrong_email(client, db_session, make_event, make_user, login_as, admin):
    event = make_event()
    make_user(email="helper@example.com", membership_status=MembershipStatus.active)
    someone_else = make_user(email="other@example.com", membership_status=MembershipStatus.active)

    client.post(f"/admin/events/{event.slug}/managers/invite", json={"email": "helper@example.com"})
    manager = db_session.query(EventManager).filter(EventManager.event_id == event.id).first()

    login_as(someone_else)
    res = client.post(f"/event-invites/{manager.token}/accept")
    assert res.status_code == 400


def test_invite_can_go_to_email_with_no_account_yet(client, db_session, make_event, make_user, login_as, admin):
    event = make_event()
    res = client.post(f"/admin/events/{event.slug}/managers/invite", json={"email": "newcomer@example.com"})
    assert res.status_code == 201

    manager = db_session.query(EventManager).filter(EventManager.event_id == event.id).first()
    assert manager.user_id is None
    assert manager.status == EventManagerStatus.invited

    # they sign up after the invite was sent, then accept
    newcomer = make_user(email="newcomer@example.com", membership_status=MembershipStatus.active)
    login_as(newcomer)
    res = client.post(f"/event-invites/{manager.token}/accept")
    assert res.status_code == 200


def test_manager_can_invite_a_co_manager(client, db_session, make_event, make_user, login_as, admin):
    event = make_event()
    manager_user = make_user(email="lead@example.com", membership_status=MembershipStatus.active)
    manager = event_manager_service.invite_manager(db_session, admin, event, manager_user.email)
    event_manager_service.accept_invite(db_session, manager_user, manager.token)

    login_as(manager_user)
    res = client.post(f"/events/{event.slug}/manage/managers/invite", json={"email": "second@example.com"})
    assert res.status_code == 201, res.text


def test_revoke_removes_access(client, db_session, make_event, make_user, login_as, admin):
    event = make_event()
    manager_user = make_user(email="helper2@example.com", membership_status=MembershipStatus.active)
    manager = event_manager_service.invite_manager(db_session, admin, event, manager_user.email)
    event_manager_service.accept_invite(db_session, manager_user, manager.token)

    login_as(admin)
    res = client.post(f"/admin/events/managers/{manager.id}/revoke")
    assert res.status_code == 204

    login_as(manager_user)
    assert client.get(f"/events/{event.slug}/manage/registrations").status_code == 403


def test_reinviting_after_revoke_reuses_the_row(db_session, make_event, make_user, admin):
    event = make_event()
    make_user(email="helper3@example.com", membership_status=MembershipStatus.active)

    m1 = event_manager_service.invite_manager(db_session, admin, event, "helper3@example.com")
    event_manager_service.revoke_manager(db_session, admin, m1)
    m2 = event_manager_service.invite_manager(db_session, admin, event, "helper3@example.com")

    assert m1.id == m2.id
    assert db_session.query(EventManager).filter(EventManager.event_id == event.id).count() == 1


def test_invite_rejects_already_active_manager(db_session, make_event, make_user, admin):
    event = make_event()
    manager_user = make_user(email="already@example.com", membership_status=MembershipStatus.active)
    manager = event_manager_service.invite_manager(db_session, admin, event, manager_user.email)
    event_manager_service.accept_invite(db_session, manager_user, manager.token)

    with pytest.raises(event_manager_service.EventManagerError):
        event_manager_service.invite_manager(db_session, admin, event, manager_user.email)


# ── /events/my-managed doesn't collide with /events/{slug} ──────────────


def test_my_managed_lists_only_active_manager_events(client, db_session, make_event, make_user, login_as, admin):
    event_a = make_event()
    make_event()
    manager_user = make_user(email="mine@example.com", membership_status=MembershipStatus.active)
    manager = event_manager_service.invite_manager(db_session, admin, event_a, manager_user.email)
    event_manager_service.accept_invite(db_session, manager_user, manager.token)

    login_as(manager_user)
    res = client.get("/events/my-managed")
    assert res.status_code == 200
    assert res.json() == [event_a.slug]


def test_my_managed_empty_for_non_manager(client, make_user, login_as):
    user = make_user(membership_status=MembershipStatus.active)
    login_as(user)
    res = client.get("/events/my-managed")
    assert res.status_code == 200
    assert res.json() == []


# ── walk-in registrations ────────────────────────────────────────────────


def test_walk_in_free_event_auto_approved(client, make_event, admin):
    event = make_event(fee_kes=0)
    res = client.post(
        f"/events/{event.slug}/manage/registrations", json={"name": "Walk In", "email": "walkin@example.com"}
    )
    assert res.status_code == 201, res.text
    assert res.json()["status"] == "approved"


def test_walk_in_comped_on_paid_event(client, make_event, admin):
    event = make_event(fee_kes=200)
    res = client.post(
        f"/events/{event.slug}/manage/registrations",
        json={"name": "Comped Guest", "email": "comped@example.com", "payment": "free"},
    )
    assert res.status_code == 201, res.text
    assert res.json()["status"] == "approved"


def test_walk_in_manual_receipt_records_payment_and_approves(client, db_session, make_event, admin):
    event = make_event(fee_kes=200)
    res = client.post(
        f"/events/{event.slug}/manage/registrations",
        json={
            "name": "Cash Payer",
            "email": "cash@example.com",
            "payment": "manual_receipt",
            "phone": "0712345678",
            "mpesa_receipt": "QAX1234",
            "amount_kes": 200,
        },
    )
    assert res.status_code == 201, res.text
    reg_id = res.json()["id"]
    payment = db_session.query(EventPayment).filter(EventPayment.registration_id == reg_id).first()
    assert payment.status == PaymentStatus.completed
    assert payment.mpesa_receipt == "QAX1234"


def test_walk_in_manual_receipt_requires_receipt(client, make_event, admin):
    event = make_event(fee_kes=200)
    res = client.post(
        f"/events/{event.slug}/manage/registrations",
        json={"name": "No Receipt", "email": "noreceipt@example.com", "payment": "manual_receipt", "phone": "0712345678"},
    )
    assert res.status_code == 400


def test_walk_in_stk_push_leaves_registration_pending(client, db_session, make_event, admin, mock_mpesa_success):
    event = make_event(fee_kes=200)
    res = client.post(
        f"/events/{event.slug}/manage/registrations",
        json={"name": "STK Guest", "email": "stk@example.com", "payment": "stk_push", "phone": "0712345678"},
    )
    assert res.status_code == 201, res.text
    assert res.json()["status"] == "pending"
    reg = db_session.get(EventRegistration, res.json()["id"])
    assert reg.status == RegistrationStatus.pending
    payment = db_session.query(EventPayment).filter(EventPayment.registration_id == reg.id).first()
    assert payment is not None


def test_walk_in_matches_existing_member_by_email(client, db_session, make_event, make_user, admin):
    event = make_event()
    member = make_user(email="existing@example.com", membership_status=MembershipStatus.active)

    res = client.post(
        f"/events/{event.slug}/manage/registrations", json={"name": "ignored", "email": "existing@example.com"}
    )
    assert res.status_code == 201, res.text
    reg = db_session.get(EventRegistration, res.json()["id"])
    assert reg.user_id == member.id
    assert reg.guest_name is None


def test_walk_in_rejects_duplicate_for_existing_member(client, db_session, make_event, make_user, admin):
    event = make_event()
    make_user(email="dup@example.com", membership_status=MembershipStatus.active)
    client.post(f"/events/{event.slug}/manage/registrations", json={"name": "x", "email": "dup@example.com"})

    res = client.post(f"/events/{event.slug}/manage/registrations", json={"name": "x", "email": "dup@example.com"})
    assert res.status_code == 400
