from datetime import UTC, date, datetime, timedelta

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


@pytest.mark.parametrize("status", [MembershipStatus.payment_pending, MembershipStatus.active])
def test_start_activation_blocked_from_disallowed_statuses(db_session, make_user, mock_mpesa_success, status):
    user = make_user(membership_status=status)
    with pytest.raises(membership_service.MembershipError):
        membership_service.start_activation(db_session, user, "0712345678")

    assert db_session.query(Payment).filter(Payment.user_id == user.id).count() == 0


def test_start_activation_allowed_from_expired(db_session, make_user, mock_mpesa_success):
    user = make_user(membership_status=MembershipStatus.expired)
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


def test_stk_callback_success_activates_membership_immediately(client, db_session, make_user, mock_mpesa_success):
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
    # Payment success is itself the qualifying action now — no admin approval step.
    assert user.membership.status == MembershipStatus.active
    assert user.membership.period_start == date.today()  # noqa: DTZ011 — mirrors _activate_membership()'s own naive date
    assert user.membership.period_end == date.today() + timedelta(days=365)  # noqa: DTZ011

    from app.models.notification import Notification

    assert db_session.query(Notification).filter(Notification.user_id == user.id).count() == 1


def test_stk_callback_success_invites_linked_github_user_to_org(
    client, db_session, make_user, mock_mpesa_success, mock_github_invite_success
):
    user = _activated_user(db_session, make_user, mock_mpesa_success)
    user.github_id = 999999
    user.github_login = "member-gh"
    db_session.commit()

    payload = _stk_callback("ws_CO_1", 0, items=[{"Name": "Amount", "Value": 500.0}])
    client.post("/mpesa/callback", json=payload)

    db_session.refresh(user)
    assert user.github_org_invite_status.value == "invited"
    assert mock_github_invite_success.routes[0].call_count == 1


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


# ── sync_pending_payment (STK Query fallback) ──────────────────────────


def _age_payment(db_session, payment, seconds):
    payment.created_at = datetime.now(UTC) - timedelta(seconds=seconds)
    db_session.commit()


def _mock_stk_query(router, result_code, result_desc=""):
    return router.post(url__regex=r".*/mpesa/stkpushquery/v1/query").mock(
        return_value=httpx.Response(
            200,
            json={
                "MerchantRequestID": "mr-1",
                "CheckoutRequestID": "ws_CO_1",
                "ResponseCode": 0,
                "ResponseDescription": "The service request has been accepted successfully",
                "ResultCode": result_code,
                "ResultDesc": result_desc,
            },
        )
    )


def test_sync_pending_payment_too_recent_is_left_alone(db_session, make_user, mock_mpesa_success):
    user = _activated_user(db_session, make_user, mock_mpesa_success)
    payment = db_session.query(Payment).filter(Payment.user_id == user.id).first()
    query_route = _mock_stk_query(mock_mpesa_success, 0)

    membership_service.sync_pending_payment(db_session, payment)

    # Still well under the 60s threshold — a query should never even fire.
    assert query_route.call_count == 0
    assert payment.status == PaymentStatus.pending


def test_sync_pending_payment_resolves_success_but_has_no_receipt(db_session, make_user, mock_mpesa_success):
    user = _activated_user(db_session, make_user, mock_mpesa_success)
    payment = db_session.query(Payment).filter(Payment.user_id == user.id).first()
    _age_payment(db_session, payment, 21)
    _mock_stk_query(mock_mpesa_success, 0, "The service request is processed successfully.")

    membership_service.sync_pending_payment(db_session, payment)

    assert payment.status == PaymentStatus.completed
    # STK Query carries no CallbackMetadata — unlike the callback path, there's
    # no receipt to record here (see test_late_callback_backfills_receipt_... below).
    assert payment.mpesa_receipt is None
    assert user.membership.status == MembershipStatus.active
    assert user.membership.period_start == date.today()  # noqa: DTZ011 — mirrors _activate_membership()'s own naive date


def test_sync_pending_payment_resolves_cancelled(db_session, make_user, mock_mpesa_success):
    user = _activated_user(db_session, make_user, mock_mpesa_success)
    payment = db_session.query(Payment).filter(Payment.user_id == user.id).first()
    _age_payment(db_session, payment, 21)
    _mock_stk_query(mock_mpesa_success, 1032, "Request cancelled by user")

    membership_service.sync_pending_payment(db_session, payment)

    assert payment.status == PaymentStatus.cancelled
    assert user.membership.status == MembershipStatus.none


def test_sync_pending_payment_resolves_generic_failure(db_session, make_user, mock_mpesa_success):
    user = _activated_user(db_session, make_user, mock_mpesa_success)
    payment = db_session.query(Payment).filter(Payment.user_id == user.id).first()
    _age_payment(db_session, payment, 21)
    _mock_stk_query(mock_mpesa_success, 1, "The balance is insufficient for the transaction.")

    membership_service.sync_pending_payment(db_session, payment)

    assert payment.status == PaymentStatus.failed
    assert user.membership.status == MembershipStatus.none


def test_sync_pending_payment_still_processing_leaves_pending(db_session, make_user, mock_mpesa_success):
    # The real Daraja shape when queried before the member has acted on the
    # prompt — an error response, not a ResultCode. Must not be treated as failed.
    user = _activated_user(db_session, make_user, mock_mpesa_success)
    payment = db_session.query(Payment).filter(Payment.user_id == user.id).first()
    _age_payment(db_session, payment, 21)
    mock_mpesa_success.post(url__regex=r".*/mpesa/stkpushquery/v1/query").mock(
        return_value=httpx.Response(
            500, json={"errorCode": "500.001.1001", "errorMessage": "The transaction is being processed"}
        )
    )

    membership_service.sync_pending_payment(db_session, payment)

    assert payment.status == PaymentStatus.pending
    assert user.membership.status == MembershipStatus.payment_pending


def test_sync_pending_payment_ignores_already_terminal_payment(db_session, make_user, mock_mpesa_success):
    user = _activated_user(db_session, make_user, mock_mpesa_success)
    payment = db_session.query(Payment).filter(Payment.user_id == user.id).first()
    payment.status = PaymentStatus.completed
    _age_payment(db_session, payment, 21)
    query_route = _mock_stk_query(mock_mpesa_success, 0)

    membership_service.sync_pending_payment(db_session, payment)

    assert query_route.call_count == 0


def test_membership_status_endpoint_triggers_reconciliation(
    client, db_session, make_user, login_as, mock_mpesa_success
):
    user = _activated_user(db_session, make_user, mock_mpesa_success)
    payment = db_session.query(Payment).filter(Payment.user_id == user.id).first()
    _age_payment(db_session, payment, 21)
    _mock_stk_query(mock_mpesa_success, 0, "done")
    login_as(user)

    res = client.get("/membership/status")

    assert res.status_code == 200
    body = res.json()
    assert body["latest_payment"]["status"] == "completed"
    assert body["membership_status"] == "active"


def test_late_callback_backfills_receipt_after_query_reconciliation(client, db_session, make_user, mock_mpesa_success):
    user = _activated_user(db_session, make_user, mock_mpesa_success)
    payment = db_session.query(Payment).filter(Payment.user_id == user.id).first()
    _age_payment(db_session, payment, 21)
    _mock_stk_query(mock_mpesa_success, 0, "done")
    membership_service.sync_pending_payment(db_session, payment)
    assert payment.status == PaymentStatus.completed
    assert payment.mpesa_receipt is None

    late_payload = _stk_callback(
        "ws_CO_1", 0, items=[{"Name": "Amount", "Value": 500.0}, {"Name": "MpesaReceiptNumber", "Value": "NLJ7RT61SV"}]
    )
    client.post("/mpesa/callback", json=late_payload)

    db_session.refresh(payment)
    assert payment.status == PaymentStatus.completed
    assert payment.mpesa_receipt == "NLJ7RT61SV"
    # A late callback backfilling the receipt must not re-run activation or
    # otherwise touch membership again.
    db_session.refresh(user.membership)
    assert user.membership.status == MembershipStatus.active


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


@pytest.mark.parametrize("status", [MembershipStatus.none, MembershipStatus.payment_pending])
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


def test_admin_add_member_emails_the_temp_password(client, db_session, make_user, login_as, mock_email):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)

    res = client.post(
        "/admin/members/add",
        json={
            "email": "welcomed@example.com",
            "display_name": "Welcomed Person",
            "registration_number": None,
            "github_handle": None,
            "reason": "Migrated from legacy list",
        },
    )
    assert res.status_code == 201
    temp_password = res.json()["temp_password"]

    assert len(mock_email) == 1
    assert mock_email[0]["to"] == "welcomed@example.com"
    assert temp_password in mock_email[0]["html"]


def test_admin_add_member_with_chosen_password_sends_no_welcome_email(client, make_user, login_as, mock_email):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)

    res = client.post(
        "/admin/members/add",
        json={
            "email": "chose-own2@example.com",
            "display_name": "Chose Own",
            "registration_number": None,
            "github_handle": None,
            "reason": "Sponsor",
            "password": "a-real-password123",
        },
    )
    assert res.status_code == 201
    assert len(mock_email) == 0


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


def test_admin_add_member_with_chosen_password_returns_no_temp_password(client, db_session, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)

    res = client.post(
        "/admin/members/add",
        json={
            "email": "chose-own-pw@example.com",
            "display_name": "Chose Own",
            "registration_number": None,
            "github_handle": None,
            "reason": "Sponsor",
            "password": "a-real-password123",
        },
    )
    assert res.status_code == 201
    # The admin already knows the password they set — nothing to display back.
    assert res.json()["temp_password"] is None

    from app.models.user import User

    user = db_session.query(User).filter(User.email == "chose-own-pw@example.com").first()
    assert verify_password("a-real-password123", user.password_hash) is True


def test_admin_add_member_stk_push_sends_payment_not_free_membership(
    client, db_session, make_user, login_as, mock_mpesa_success
):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)

    res = client.post(
        "/admin/members/add",
        json={
            "email": "pays-own-way@example.com",
            "display_name": "Pays Own Way",
            "registration_number": None,
            "github_handle": None,
            "reason": "In-person sign-up",
            "activation": "stk_push",
            "phone": "0712345678",
        },
    )
    assert res.status_code == 201
    assert res.json()["membership_status"] == "payment_pending"

    from app.models.payment import Payment, PaymentStatus
    from app.models.user import User

    user = db_session.query(User).filter(User.email == "pays-own-way@example.com").first()
    assert user.membership.status == MembershipStatus.payment_pending
    payment = db_session.query(Payment).filter(Payment.user_id == user.id).first()
    assert payment.status == PaymentStatus.pending
    assert payment.checkout_request_id == "ws_CO_1"


def test_admin_add_member_stk_push_requires_phone(client, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)

    res = client.post(
        "/admin/members/add",
        json={
            "email": "no-phone@example.com",
            "display_name": "No Phone",
            "registration_number": None,
            "github_handle": None,
            "reason": "In-person sign-up",
            "activation": "stk_push",
        },
    )
    assert res.status_code == 422


def test_admin_add_member_stk_push_daraja_failure_returns_400(client, db_session, make_user, login_as):
    import httpx
    import respx

    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)

    with respx.mock(assert_all_called=False) as m:
        m.get(url__regex=r".*/oauth/v1/generate").mock(return_value=httpx.Response(200, json={"access_token": "tok"}))
        m.post(url__regex=r".*/mpesa/stkpush/v1/processrequest").mock(
            return_value=httpx.Response(200, json={"errorCode": "500.001.1001", "errorMessage": "Invalid Access Token"})
        )
        res = client.post(
            "/admin/members/add",
            json={
                "email": "daraja-fails@example.com",
                "display_name": "Daraja Fails",
                "registration_number": None,
                "github_handle": None,
                "reason": "In-person sign-up",
                "activation": "stk_push",
                "phone": "0712345678",
            },
        )
    assert res.status_code == 400

    # The account itself should still exist — only the payment step failed.
    from app.models.user import User

    user = db_session.query(User).filter(User.email == "daraja-fails@example.com").first()
    assert user is not None
    assert user.membership.status == MembershipStatus.none


def test_admin_add_member_manual_receipt_activates_and_records_payment(client, db_session, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)

    res = client.post(
        "/admin/members/add",
        json={
            "email": "paid-in-cash@example.com",
            "display_name": "Paid In Cash",
            "registration_number": None,
            "github_handle": None,
            "reason": "In-person sign-up",
            "activation": "manual_receipt",
            "phone": "0712345678",
            "mpesa_receipt": "QWE1RTY2UI",
        },
    )
    assert res.status_code == 201, res.text
    assert res.json()["membership_status"] == "active"

    from app.models.payment import Payment, PaymentStatus
    from app.models.user import User

    user = db_session.query(User).filter(User.email == "paid-in-cash@example.com").first()
    assert user.membership.status == MembershipStatus.active
    payment = db_session.query(Payment).filter(Payment.user_id == user.id).first()
    assert payment.status == PaymentStatus.completed
    assert payment.mpesa_receipt == "QWE1RTY2UI"
    assert payment.amount == membership_service.settings.membership_fee_kes


def test_admin_add_member_manual_receipt_accepts_custom_amount(client, db_session, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)

    res = client.post(
        "/admin/members/add",
        json={
            "email": "paid-extra@example.com",
            "display_name": "Paid Extra",
            "registration_number": None,
            "github_handle": None,
            "reason": "In-person sign-up",
            "activation": "manual_receipt",
            "phone": "0712345678",
            "mpesa_receipt": "ABC123XYZ0",
            "amount_kes": 500,
        },
    )
    assert res.status_code == 201, res.text

    from app.models.payment import Payment
    from app.models.user import User

    user = db_session.query(User).filter(User.email == "paid-extra@example.com").first()
    payment = db_session.query(Payment).filter(Payment.user_id == user.id).first()
    assert payment.amount == 500


def test_admin_add_member_manual_receipt_requires_receipt_code(client, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)

    res = client.post(
        "/admin/members/add",
        json={
            "email": "no-receipt@example.com",
            "display_name": "No Receipt",
            "registration_number": None,
            "github_handle": None,
            "reason": "In-person sign-up",
            "activation": "manual_receipt",
            "phone": "0712345678",
        },
    )
    assert res.status_code == 422


def test_admin_add_member_manual_receipt_requires_phone(client, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)

    res = client.post(
        "/admin/members/add",
        json={
            "email": "no-phone-receipt@example.com",
            "display_name": "No Phone Receipt",
            "registration_number": None,
            "github_handle": None,
            "reason": "In-person sign-up",
            "activation": "manual_receipt",
            "mpesa_receipt": "ABC123XYZ0",
        },
    )
    assert res.status_code == 422


def test_admin_add_member_manual_receipt_fires_github_invite(client, db_session, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)

    from app.services.auth import create_user

    user = create_user(db_session, "already-linked@example.com", "pw12345678")
    user.github_id = 999
    user.github_login = "already-linked"
    db_session.commit()

    with respx.mock(assert_all_called=False) as m:
        route = m.post(url__regex=r".*/orgs/.*/invitations").mock(return_value=httpx.Response(201))
        res = client.post(
            "/admin/members/add",
            json={
                "email": "already-linked@example.com",
                "display_name": "Already Linked",
                "registration_number": None,
                "github_handle": None,
                "reason": "In-person sign-up",
                "activation": "manual_receipt",
                "phone": "0712345678",
                "mpesa_receipt": "ABC123XYZ0",
            },
        )
        assert res.status_code == 201, res.text
        assert route.call_count == 1

    db_session.refresh(user)
    from app.models.user import GithubOrgInviteStatus

    assert user.github_org_invite_status == GithubOrgInviteStatus.invited


# ── bulk member import ──────────────────────────────────────────────────


def test_import_members_creates_active_accounts_and_emails_each(client, db_session, make_user, login_as, mock_email):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)

    res = client.post(
        "/admin/members/import",
        json={
            "rows": [
                {"email": "legacy1@example.com", "display_name": "Legacy One"},
                {"email": "legacy2@example.com", "display_name": "Legacy Two", "registration_number": "SC1/1/2024"},
            ]
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert [r["status"] for r in body["results"]] == ["created", "created"]

    from app.models.user import User

    u1 = db_session.query(User).filter(User.email == "legacy1@example.com").first()
    u2 = db_session.query(User).filter(User.email == "legacy2@example.com").first()
    assert u1.membership.status == MembershipStatus.active
    assert u2.membership.status == MembershipStatus.active
    assert u2.profile.registration_number == "SC1/1/2024"

    assert len(mock_email) == 2
    assert {m["to"] for m in mock_email} == {"legacy1@example.com", "legacy2@example.com"}


def test_import_members_reports_per_row_errors_without_failing_the_batch(
    client, db_session, make_user, login_as, mock_email
):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)
    make_user(email="already-active@example.com", membership_status=MembershipStatus.active)

    res = client.post(
        "/admin/members/import",
        json={
            "rows": [
                {"email": "already-active@example.com", "display_name": "Dup"},
                {"email": "fresh@example.com", "display_name": "Fresh"},
            ]
        },
    )
    assert res.status_code == 200, res.text
    results = res.json()["results"]
    assert results[0]["status"] == "error"
    assert results[1]["status"] == "created"

    from app.models.user import User

    assert db_session.query(User).filter(User.email == "fresh@example.com").first() is not None
    assert len(mock_email) == 1


def test_import_members_requires_admin(client, make_user, login_as):
    user = make_user()
    login_as(user)
    res = client.post("/admin/members/import", json={"rows": [{"email": "x@example.com", "display_name": "X"}]})
    assert res.status_code == 403


def test_import_members_rejects_empty_rows(client, make_user, login_as):
    admin = make_user(is_admin=True)
    login_as(admin)
    res = client.post("/admin/members/import", json={"rows": []})
    assert res.status_code == 422
