from datetime import date, timedelta

import httpx
import pytest
import respx

from app.core.security import verify_password
from app.models.membership import MembershipStatus
from app.models.payment import Payment, PaymentStatus
from app.services import membership as membership_service

pytestmark = pytest.mark.integration


# ── start_activation ────────────────────────────────────────────────────


def test_start_activation_success(db_session, make_user, mock_mpesa_success):
    user = make_user()
    payment = membership_service.start_activation(db_session, user, "0712345678")

    assert payment.status == PaymentStatus.pending
    assert payment.checkout_request_id == "ws_CO_1"
    assert user.membership.status == MembershipStatus.payment_pending


@pytest.mark.parametrize(
    "status", [MembershipStatus.payment_pending, MembershipStatus.approval_pending, MembershipStatus.active]
)
def test_start_activation_blocked_from_disallowed_statuses(db_session, make_user, mock_mpesa_success, status):
    user = make_user(membership_status=status)
    with pytest.raises(membership_service.MembershipError):
        membership_service.start_activation(db_session, user, "0712345678")

    assert db_session.query(Payment).filter(Payment.user_id == user.id).count() == 0


@pytest.mark.parametrize("status", [MembershipStatus.rejected, MembershipStatus.expired])
def test_start_activation_allowed_from_rejected_or_expired(db_session, make_user, mock_mpesa_success, status):
    user = make_user(membership_status=status)
    payment = membership_service.start_activation(db_session, user, "0712345678")
    assert payment.status == PaymentStatus.pending


def test_start_activation_daraja_failure_marks_payment_failed_not_membership(db_session, make_user):
    user = make_user()
    with respx.mock(assert_all_called=False) as m:
        m.get(url__regex=r".*/oauth/v1/generate").mock(
            return_value=httpx.Response(200, json={"access_token": "tok"})
        )
        m.post(url__regex=r".*/mpesa/stkpush/v1/processrequest").mock(
            return_value=httpx.Response(200, json={"errorCode": "500.001.1001", "errorMessage": "Invalid Access Token"})
        )
        with pytest.raises(membership_service.MembershipError):
            membership_service.start_activation(db_session, user, "0712345678")

    payment = db_session.query(Payment).filter(Payment.user_id == user.id).first()
    assert payment.status == PaymentStatus.failed
    # The failure must not have flipped membership into payment_pending.
    db_session.refresh(user.membership)
    assert user.membership.status == MembershipStatus.none


# ── apply_stk_callback ──────────────────────────────────────────────────


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


def _activated_user(db_session, make_user, mock_mpesa_success):
    user = make_user()
    membership_service.start_activation(db_session, user, "0712345678")
    return user


def test_stk_callback_success_moves_to_approval_pending(client, db_session, make_user, mock_mpesa_success):
    user = _activated_user(db_session, make_user, mock_mpesa_success)
    payload = _stk_callback(
        "ws_CO_1",
        0,
        "The service request is processed successfully.",
        items=[
            {"Name": "Amount", "Value": 500.0},
            {"Name": "MpesaReceiptNumber", "Value": "NLJ7RT61SV"},
            {"Name": "PhoneNumber", "Value": 254712345678},
        ],
    )
    res = client.post("/mpesa/callback", json=payload)
    assert res.status_code == 200

    db_session.refresh(user.membership)
    payment = db_session.query(Payment).filter(Payment.user_id == user.id).first()
    assert payment.status == PaymentStatus.completed
    assert payment.mpesa_receipt == "NLJ7RT61SV"
    assert user.membership.status == MembershipStatus.approval_pending


def test_stk_callback_cancelled_resets_to_none(client, db_session, make_user, mock_mpesa_success):
    user = _activated_user(db_session, make_user, mock_mpesa_success)
    payload = _stk_callback("ws_CO_1", 1032, "Request cancelled by user")
    client.post("/mpesa/callback", json=payload)

    db_session.refresh(user.membership)
    payment = db_session.query(Payment).filter(Payment.user_id == user.id).first()
    assert payment.status == PaymentStatus.cancelled
    assert user.membership.status == MembershipStatus.none


def test_stk_callback_generic_failure_resets_to_none(client, db_session, make_user, mock_mpesa_success):
    user = _activated_user(db_session, make_user, mock_mpesa_success)
    payload = _stk_callback("ws_CO_1", 1, "The balance is insufficient for the transaction.")
    client.post("/mpesa/callback", json=payload)

    db_session.refresh(user.membership)
    payment = db_session.query(Payment).filter(Payment.user_id == user.id).first()
    assert payment.status == PaymentStatus.failed
    assert user.membership.status == MembershipStatus.none


def test_stk_callback_is_idempotent(client, db_session, make_user, mock_mpesa_success):
    # A same-outcome duplicate wouldn't actually catch a missing guard here
    # (the inner "only transition from payment_pending" check would mask
    # it) — the guard's real job is stopping a late/out-of-order duplicate
    # from *overwriting* an already-terminal payment with a different
    # outcome. Cancel first, then a late "success" callback for the same
    # checkout_request_id arrives (a real Daraja race) — the payment must
    # stay cancelled, not flip to completed.
    user = _activated_user(db_session, make_user, mock_mpesa_success)
    cancel_payload = _stk_callback("ws_CO_1", 1032, "Request cancelled by user")
    client.post("/mpesa/callback", json=cancel_payload)

    payment = db_session.query(Payment).filter(Payment.user_id == user.id).first()
    assert payment.status == PaymentStatus.cancelled

    late_success_payload = _stk_callback(
        "ws_CO_1", 0, items=[{"Name": "Amount", "Value": 500.0}, {"Name": "MpesaReceiptNumber", "Value": "NLJ7RT61SV"}]
    )
    client.post("/mpesa/callback", json=late_success_payload)

    db_session.refresh(payment)
    assert payment.status == PaymentStatus.cancelled
    assert payment.mpesa_receipt is None


def test_stk_callback_unknown_checkout_id_is_silently_ignored(client):
    payload = _stk_callback("ws_CO_does_not_exist", 0, items=[{"Name": "Amount", "Value": 500.0}])
    res = client.post("/mpesa/callback", json=payload)
    assert res.status_code == 200


# ── approve / reject ────────────────────────────────────────────────────


def test_approve_from_approval_pending(client, db_session, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    applicant = make_user(membership_status=MembershipStatus.approval_pending)
    login_as(admin)

    res = client.post(f"/admin/memberships/{applicant.id}/approve")
    assert res.status_code == 204

    db_session.refresh(applicant.membership)
    assert applicant.membership.status == MembershipStatus.active
    assert applicant.membership.period_start == date.today()  # noqa: DTZ011 — mirrors approve()'s own naive date
    assert applicant.membership.period_end == date.today() + timedelta(days=365)  # noqa: DTZ011

    from app.models.audit_log import AuditLog
    from app.models.notification import Notification

    assert db_session.query(AuditLog).filter(AuditLog.actor_id == admin.id).count() == 1
    assert db_session.query(Notification).filter(Notification.user_id == applicant.id).count() == 1


@pytest.mark.parametrize(
    "status",
    [MembershipStatus.none, MembershipStatus.payment_pending, MembershipStatus.active, MembershipStatus.rejected],
)
def test_approve_blocked_from_non_approval_pending(client, make_user, login_as, status):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    applicant = make_user(membership_status=status)
    login_as(admin)

    res = client.post(f"/admin/memberships/{applicant.id}/approve")
    assert res.status_code == 400


def test_approve_invites_linked_github_user_to_org(client, db_session, make_user, login_as, mock_github_invite_success):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    applicant = make_user(membership_status=MembershipStatus.approval_pending)
    applicant.github_id = 999999
    applicant.github_login = "applicant-gh"
    db_session.commit()
    login_as(admin)

    res = client.post(f"/admin/memberships/{applicant.id}/approve")
    assert res.status_code == 204

    db_session.refresh(applicant)
    assert applicant.github_org_invite_status.value == "invited"
    assert mock_github_invite_success.routes[0].call_count == 1


def test_approve_without_github_linked_does_not_invite(client, db_session, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    applicant = make_user(membership_status=MembershipStatus.approval_pending)
    login_as(admin)

    with respx.mock(assert_all_called=False) as m:
        invite_route = m.post(url__regex=r".*/orgs/.*/invitations").mock(return_value=httpx.Response(201))
        res = client.post(f"/admin/memberships/{applicant.id}/approve")
        assert res.status_code == 204
        assert invite_route.call_count == 0


def test_reject_from_approval_pending(client, db_session, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    applicant = make_user(membership_status=MembershipStatus.approval_pending)
    login_as(admin)

    res = client.post(f"/admin/memberships/{applicant.id}/reject")
    assert res.status_code == 204
    db_session.refresh(applicant.membership)
    assert applicant.membership.status == MembershipStatus.rejected


def test_reject_blocked_from_non_approval_pending(client, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    applicant = make_user(membership_status=MembershipStatus.none)
    login_as(admin)

    res = client.post(f"/admin/memberships/{applicant.id}/reject")
    assert res.status_code == 400


# ── sync_expiry ─────────────────────────────────────────────────────────


def test_sync_expiry_flips_past_period_end(db_session, make_user):
    user = make_user(membership_status=MembershipStatus.active)
    user.membership.period_end = date.today() - timedelta(days=1)  # noqa: DTZ011
    db_session.commit()

    membership_service.sync_expiry(db_session, user.membership)
    assert user.membership.status == MembershipStatus.expired


def test_sync_expiry_leaves_future_period_end(db_session, make_user):
    user = make_user(membership_status=MembershipStatus.active)
    user.membership.period_end = date.today() + timedelta(days=1)  # noqa: DTZ011
    db_session.commit()

    membership_service.sync_expiry(db_session, user.membership)
    assert user.membership.status == MembershipStatus.active


def test_sync_expiry_leaves_null_period_end(db_session, make_user):
    user = make_user(membership_status=MembershipStatus.active)
    user.membership.period_end = None
    db_session.commit()

    membership_service.sync_expiry(db_session, user.membership)
    assert user.membership.status == MembershipStatus.active


@pytest.mark.parametrize(
    "status", [MembershipStatus.none, MembershipStatus.payment_pending, MembershipStatus.rejected]
)
def test_sync_expiry_ignores_non_active_statuses(db_session, make_user, status):
    user = make_user(membership_status=status)
    membership_service.sync_expiry(db_session, user.membership)
    assert user.membership.status == status


def test_membership_status_endpoint_reflects_lazy_expiry(client, db_session, make_user, login_as):
    user = make_user(membership_status=MembershipStatus.active)
    user.membership.period_end = date.today() - timedelta(days=1)  # noqa: DTZ011
    db_session.commit()
    login_as(user)

    res = client.get("/membership/status")
    assert res.status_code == 200
    assert res.json()["membership_status"] == "expired"


# ── admin_add_member ────────────────────────────────────────────────────


def test_admin_add_member_brand_new_account(client, db_session, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)

    res = client.post(
        "/admin/members/add",
        json={
            "email": "sponsor@example.com",
            "display_name": "Sponsor Person",
            "registration_number": None,
            "github_handle": None,
            "reason": "Sponsor",
        },
    )
    assert res.status_code == 201
    body = res.json()
    assert body["temp_password"] is not None

    from app.models.user import User

    user = db_session.query(User).filter(User.email == "sponsor@example.com").first()
    assert user.membership.status == MembershipStatus.active
    assert verify_password(body["temp_password"], user.password_hash) is True


def test_admin_add_member_reuses_never_activated_account_no_temp_password(client, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    make_user(email="already-signed-up@example.com", membership_status=MembershipStatus.none)
    login_as(admin)

    res = client.post(
        "/admin/members/add",
        json={
            "email": "already-signed-up@example.com",
            "display_name": "Existing User",
            "registration_number": None,
            "github_handle": None,
            "reason": "Migrated",
        },
    )
    assert res.status_code == 201
    assert res.json()["temp_password"] is None


def test_admin_add_member_rejects_already_active(client, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    make_user(email="already-active@example.com", membership_status=MembershipStatus.active)
    login_as(admin)

    res = client.post(
        "/admin/members/add",
        json={
            "email": "already-active@example.com",
            "display_name": "Existing",
            "registration_number": None,
            "github_handle": None,
            "reason": "Oops",
        },
    )
    assert res.status_code == 400


def test_admin_add_member_sets_github_url_from_handle(client, db_session, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)

    client.post(
        "/admin/members/add",
        json={
            "email": "ghuser@example.com",
            "display_name": "GH User",
            "registration_number": None,
            "github_handle": "ghuser",
            "reason": "Sponsor",
        },
    )

    from app.models.user import User

    user = db_session.query(User).filter(User.email == "ghuser@example.com").first()
    assert user.profile.github_url == "github.com/ghuser"
