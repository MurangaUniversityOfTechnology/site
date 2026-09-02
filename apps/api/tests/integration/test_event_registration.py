from datetime import UTC, datetime

import httpx
import pytest
import respx

from app.models.event import Event, EventAudience
from app.models.event_payment import EventPayment
from app.models.event_registration import RegistrationStatus
from app.models.membership import MembershipStatus
from app.models.payment import PaymentStatus
from app.services import event as event_service
from app.services import event_payment

pytestmark = pytest.mark.integration


@pytest.fixture
def make_event(db_session):
    counter = {"n": 0}

    def _make(*, capacity=None, audience=EventAudience.open_to_all, fee_kes=0):
        counter["n"] += 1
        event = Event(
            slug=f"event-{counter['n']}",
            title=f"Event {counter['n']}",
            capacity=capacity,
            audience=audience,
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


def test_register_members_only_event_succeeds_for_admin_without_active_membership(db_session, make_user, make_event):
    event = make_event(audience=EventAudience.members_only)
    admin = make_user(is_admin=True, membership_status=MembershipStatus.none)
    reg = event_service.register(db_session, event.slug, admin)
    assert reg.status == RegistrationStatus.pending


def test_register_members_only_event_requires_verified_email(db_session, make_user, make_event):
    event = make_event(audience=EventAudience.members_only)
    user = make_user(membership_status=MembershipStatus.active, email_verified=False)
    with pytest.raises(event_service.EventError):
        event_service.register(db_session, event.slug, user)


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


def test_approve_emails_a_ticket_to_the_member(db_session, make_user, make_event, mock_email):
    event = make_event()
    admin = make_user(is_admin=True, email="admin@example.com")
    user = make_user(email="attendee@example.com")
    reg = event_service.register(db_session, event.slug, user)

    event_service.approve(db_session, admin, reg)

    assert len(mock_email) == 1
    assert mock_email[0]["to"] == "attendee@example.com"
    assert event.title in mock_email[0]["html"]
    assert str(reg.id)[:8].upper() in mock_email[0]["html"]
    assert 'cid:ticket-qr' in mock_email[0]["html"]
    assert event.venue in mock_email[0]["html"]
    images = mock_email[0]["inline_images"]
    assert images is not None and len(images) == 1
    assert images[0].cid == "ticket-qr"
    assert images[0].data[:8] == b"\x89PNG\r\n\x1a\n"  # PNG file signature


def test_approve_emails_a_ticket_to_a_guest(db_session, make_user, make_event, mock_email):
    event = make_event()
    admin = make_user(is_admin=True, email="admin@example.com")
    reg = event_service.register(db_session, event.slug, None, guest_name="Guest", guest_email="guest@example.com")

    event_service.approve(db_session, admin, reg)

    assert len(mock_email) == 1
    assert mock_email[0]["to"] == "guest@example.com"


@pytest.mark.parametrize("transition", ["reject", "waitlist"])
def test_other_transitions_do_not_send_a_ticket(db_session, make_user, make_event, mock_email, transition):
    event = make_event()
    admin = make_user(is_admin=True, email="admin@example.com")
    user = make_user(email="attendee@example.com")
    reg = event_service.register(db_session, event.slug, user)

    getattr(event_service, transition)(db_session, admin, reg)

    assert mock_email == []


def test_ticket_email_failure_does_not_block_approval(db_session, make_user, make_event, monkeypatch):
    def _boom(**kwargs):
        raise RuntimeError("SMTP is down")

    monkeypatch.setattr("app.services.email.send_email", _boom)

    event = make_event()
    admin = make_user(is_admin=True, email="admin@example.com")
    user = make_user(email="attendee@example.com")
    reg = event_service.register(db_session, event.slug, user)

    event_service.approve(db_session, admin, reg)  # must not raise
    assert reg.status == RegistrationStatus.approved


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


# ── paid events — M-Pesa collection ─────────────────────────────────────


def _stk_callback(checkout_request_id, result_code, result_desc="", items=None):
    body = {
        "MerchantRequestID": "mr-1",
        "CheckoutRequestID": checkout_request_id,
        "ResultCode": result_code,
        "ResultDesc": result_desc,
    }
    if items is not None:
        body["CallbackMetadata"] = {"Item": items}
    return {"Body": {"stkCallback": body}}


def test_paid_event_requires_phone(db_session, make_user, make_event):
    event = make_event(fee_kes=200)
    user = make_user()
    with pytest.raises(event_service.EventError):
        event_service.register(db_session, event.slug, user)


def test_paid_event_registration_starts_pending_payment(db_session, make_user, make_event, mock_mpesa_success):
    event = make_event(fee_kes=200)
    user = make_user()
    reg = event_service.register(db_session, event.slug, user, phone="0712345678")

    assert reg.status == RegistrationStatus.pending
    payment = db_session.query(EventPayment).filter(EventPayment.registration_id == reg.id).first()
    assert payment.status == PaymentStatus.pending
    assert payment.checkout_request_id == "ws_CO_1"
    assert payment.amount == 200


def test_paid_event_daraja_failure_rolls_back_registration(db_session, make_user, make_event):
    from app.models.event_registration import EventRegistration

    event = make_event(fee_kes=200)
    user = make_user()

    with respx.mock(assert_all_called=False) as m:
        m.get(url__regex=r".*/oauth/v1/generate").mock(return_value=httpx.Response(200, json={"access_token": "tok"}))
        m.post(url__regex=r".*/mpesa/stkpush/v1/processrequest").mock(
            return_value=httpx.Response(200, json={"errorCode": "500.001.1001", "errorMessage": "Invalid Access Token"})
        )
        with pytest.raises(event_service.EventError):
            event_service.register(db_session, event.slug, user, phone="0712345678")

    assert db_session.query(EventPayment).count() == 0
    assert db_session.query(EventRegistration).count() == 0


def test_free_event_does_not_require_phone(db_session, make_user, make_event):
    event = make_event(fee_kes=0)
    user = make_user()
    reg = event_service.register(db_session, event.slug, user)
    assert db_session.query(EventPayment).filter(EventPayment.registration_id == reg.id).first() is None


def test_approve_blocked_when_paid_event_fee_unpaid(db_session, make_user, make_event, mock_mpesa_success):
    event = make_event(fee_kes=200)
    admin = make_user(is_admin=True, email="admin@example.com")
    user = make_user(email="attendee@example.com")
    reg = event_service.register(db_session, event.slug, user, phone="0712345678")

    with pytest.raises(event_service.EventError):
        event_service.approve(db_session, admin, reg)
    assert reg.status == RegistrationStatus.pending


def test_approve_succeeds_once_fee_is_paid(db_session, make_user, make_event, mock_mpesa_success):
    event = make_event(fee_kes=200)
    admin = make_user(is_admin=True, email="admin@example.com")
    user = make_user(email="attendee@example.com")
    reg = event_service.register(db_session, event.slug, user, phone="0712345678")
    payment = db_session.query(EventPayment).filter(EventPayment.registration_id == reg.id).first()
    payment.status = PaymentStatus.completed
    db_session.commit()

    event_service.approve(db_session, admin, reg)
    assert reg.status == RegistrationStatus.approved


def test_event_stk_callback_marks_payment_completed_without_auto_approving(
    client, db_session, make_user, make_event, mock_mpesa_success
):
    event = make_event(fee_kes=200)
    user = make_user()
    reg = event_service.register(db_session, event.slug, user, phone="0712345678")

    payload = _stk_callback("ws_CO_1", 0, items=[{"Name": "Amount", "Value": 200.0}, {"Name": "MpesaReceiptNumber", "Value": "ABC123"}])
    res = client.post("/events/mpesa/callback", json=payload)
    assert res.status_code == 200

    db_session.refresh(reg)
    payment = db_session.query(EventPayment).filter(EventPayment.registration_id == reg.id).first()
    assert payment.status == PaymentStatus.completed
    assert payment.mpesa_receipt == "ABC123"
    assert reg.status == RegistrationStatus.pending  # admin still approves manually


def test_event_stk_callback_failure_cancels_registration_and_frees_seat(db_session, make_user, make_event):
    event = make_event(fee_kes=200, capacity=1)
    first = make_user(email="first@example.com")
    second = make_user(email="second@example.com")

    with respx.mock(assert_all_called=False) as m:
        m.get(url__regex=r".*/oauth/v1/generate").mock(return_value=httpx.Response(200, json={"access_token": "tok"}))
        m.post(url__regex=r".*/mpesa/stkpush/v1/processrequest").mock(
            return_value=httpx.Response(
                200,
                json={"MerchantRequestID": "mr-1", "CheckoutRequestID": "ws_CO_1", "ResponseCode": "0", "ResponseDescription": "ok", "CustomerMessage": "ok"},
            )
        )
        reg1 = event_service.register(db_session, event.slug, first, phone="0712345678")

    payload = _stk_callback("ws_CO_1", 1, "The balance is insufficient for the transaction.")
    event_payment.apply_stk_callback(db_session, payload)

    db_session.refresh(reg1)
    assert reg1.status == RegistrationStatus.cancelled

    # Seat freed up — a second registrant lands pending, not waitlisted.
    with respx.mock(assert_all_called=False) as m:
        m.get(url__regex=r".*/oauth/v1/generate").mock(return_value=httpx.Response(200, json={"access_token": "tok"}))
        m.post(url__regex=r".*/mpesa/stkpush/v1/processrequest").mock(
            return_value=httpx.Response(
                200,
                json={"MerchantRequestID": "mr-2", "CheckoutRequestID": "ws_CO_2", "ResponseCode": "0", "ResponseDescription": "ok", "CustomerMessage": "ok"},
            )
        )
        reg2 = event_service.register(db_session, event.slug, second, phone="0712345678")
    assert reg2.status == RegistrationStatus.pending


def test_register_endpoint_paid_event_requires_phone(client, db_session, make_user, make_event, login_as):
    event = make_event(fee_kes=200)
    user = make_user()
    login_as(user)

    res = client.post(f"/events/{event.slug}/register", json={})
    assert res.status_code == 400


def test_register_endpoint_paid_event_returns_nested_payment(
    client, db_session, make_user, make_event, login_as, mock_mpesa_success
):
    event = make_event(fee_kes=200)
    user = make_user()
    login_as(user)

    res = client.post(f"/events/{event.slug}/register", json={"phone": "0712345678"})
    assert res.status_code == 201
    body = res.json()
    assert body["status"] == "pending"
    assert body["payment"]["status"] == "pending"
    assert body["payment"]["amount"] == 200


def test_registration_status_endpoint_is_public(client, db_session, make_event, mock_mpesa_success):
    event = make_event(fee_kes=200)
    reg = event_service.register(
        db_session, event.slug, None, guest_name="Guest", guest_email="guest@example.com", phone="0712345678"
    )

    # No login_as call — a guest with no account must be able to poll their
    # own registration by its (unguessable) id.
    res = client.get(f"/events/registrations/{reg.id}")
    assert res.status_code == 200
    assert res.json()["payment"]["status"] == "pending"
