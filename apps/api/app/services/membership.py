import logging
from datetime import UTC, date, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.membership import Membership, MembershipStatus
from app.models.payment import Payment, PaymentStatus
from app.models.user import User
from app.services import audit, github, mpesa, notification
from app.services import email as email_service
from app.services.email_templates import render_email

settings = get_settings()
logger = logging.getLogger(__name__)


def _send_membership_email(user: User, temp_password: str | None) -> None:
    """Always sent when an admin manually adds a member — regardless of
    whether a brand-new account (with an auto-generated password) was
    created, or an existing account was reactivated / given an admin-chosen
    password (temp_password is None either way, since the admin either
    already knows the password they set or the account already had one)."""
    sign_in_url = f"{settings.web_origin}/sign-in"
    if temp_password:
        body_html = (
            "An admin added you to MUT Tech Community. Sign in with:"
            '<div style="margin-top:14px;padding:14px 16px;background:#faf8f3;border:1px solid #ddd6c4;'
            'border-radius:8px;font-size:14px;line-height:1.9;">'
            f"<strong>Email:</strong> {user.email}<br />"
            f'<strong>Password:</strong> <span style="font-family:\'Courier New\',monospace;">{temp_password}</span>'
            "</div>"
            '<p style="margin-top:14px;">This is a one-time password — change it from Settings once you\'re signed in.</p>'
        )
        heading = "You're in — here's your login."
    else:
        body_html = (
            f"An admin added <strong>{user.email}</strong> to MUT Tech Community. Sign in with your existing "
            "password, or use \"Forgot password\" on the sign-in page if you don't remember it."
        )
        heading = "You're in."
    html = render_email(eyebrow="your account", heading=heading, body_html=body_html, cta_label="Sign in", cta_url=sign_in_url)
    try:
        email_service.send_email(to=user.email, subject="Your MUT Tech Community account", html=html)
    except Exception:
        logger.warning("Failed to send membership email to %s", user.email, exc_info=True)


class MembershipError(Exception):
    pass


def start_activation(db: Session, user: User, phone: str) -> Payment:
    membership = user.membership
    if membership.status not in (MembershipStatus.none, MembershipStatus.expired):
        raise MembershipError(f"Cannot start activation from status '{membership.status.value}'")

    payment = Payment(
        user_id=user.id,
        amount=settings.membership_fee_kes,
        phone=phone,
        status=PaymentStatus.initiated,
    )
    db.add(payment)
    db.flush()

    try:
        response = mpesa.initiate_stk_push(
            phone=phone,
            amount=settings.membership_fee_kes,
            # Daraja caps AccountReference at 12 characters.
            account_reference=f"MUT-{user.id.hex[:8]}",
            # Daraja caps TransactionDesc at 13 characters.
            transaction_desc="Membership",
        )
    except mpesa.MpesaError as exc:
        payment.status = PaymentStatus.failed
        payment.raw_callback = {"error": str(exc)}
        db.commit()
        raise MembershipError(str(exc)) from exc

    payment.checkout_request_id = response["CheckoutRequestID"]
    payment.merchant_request_id = response["MerchantRequestID"]
    payment.status = PaymentStatus.pending
    membership.status = MembershipStatus.payment_pending
    db.commit()
    db.refresh(payment)
    return payment


def _activate_membership(db: Session, membership: Membership, user: User) -> None:
    """Activates membership the moment a payment completes — payment is
    itself the qualifying action, so there's no separate admin approval
    step anymore. Mirrors what the old admin-only approve() used to do,
    minus an audit log entry (there's no admin actor here — same convention
    as the equally-automatic sync_expiry(), which doesn't log either)."""
    membership.status = MembershipStatus.active
    # Naive local date, not a tz-aware datetime — period_start/period_end are
    # calendar-day Date columns (a membership year, not a precise instant),
    # so date.today() is correct here, not a missing-timezone bug.
    membership.period_start = date.today()  # noqa: DTZ011
    membership.period_end = date.today() + timedelta(days=365)  # noqa: DTZ011
    notification.notify(db, user, "membership", "Membership active ✓", "Your Tech Club membership is now active. Welcome in.")
    db.commit()
    github.maybe_invite_to_org(db, user)


def apply_stk_callback(db: Session, payload: dict) -> None:
    parsed = mpesa.parse_stk_callback(payload)

    payment = (
        db.query(Payment)
        .filter(Payment.checkout_request_id == parsed["checkout_request_id"])
        .first()
    )
    if not payment:
        return  # unknown checkout request — nothing to reconcile

    # Idempotent: a duplicate callback for an already-terminal payment is a no-op —
    # except a late callback can still backfill the receipt for a payment that
    # sync_pending_payment() already completed via STK Query, which has no
    # CallbackMetadata to source one from.
    if payment.status in (PaymentStatus.completed, PaymentStatus.failed, PaymentStatus.cancelled):
        if payment.status == PaymentStatus.completed and not payment.mpesa_receipt and parsed["mpesa_receipt"]:
            payment.mpesa_receipt = parsed["mpesa_receipt"]
            db.commit()
        return

    payment.raw_callback = payload
    membership = db.query(Membership).filter(Membership.user_id == payment.user_id).first()
    should_activate = False

    if parsed["result_code"] == 0:
        payment.status = PaymentStatus.completed
        payment.mpesa_receipt = parsed["mpesa_receipt"]
        should_activate = bool(membership and membership.status == MembershipStatus.payment_pending)
    elif parsed["cancelled"]:
        payment.status = PaymentStatus.cancelled
        if membership and membership.status == MembershipStatus.payment_pending:
            membership.status = MembershipStatus.none
    else:
        payment.status = PaymentStatus.failed
        if membership and membership.status == MembershipStatus.payment_pending:
            membership.status = MembershipStatus.none

    db.commit()
    if should_activate:
        _activate_membership(db, membership, payment.user)


def latest_payment(db: Session, user: User) -> Payment | None:
    return (
        db.query(Payment)
        .filter(Payment.user_id == user.id)
        .order_by(Payment.created_at.desc())
        .first()
    )


# How long to wait before actively querying Safaricom rather than just
# trusting their callback to arrive. This is a fallback path only — the real
# callback (apply_stk_callback, POST /mpesa/callback) fires the moment
# Safaricom has it, independent of this threshold, and the frontend polls
# /membership/status every 3s (see POLL_INTERVAL_MS in
# apps/web/.../membership/waiting/page.tsx), so a member who approves
# promptly sees success within a few seconds — this only kicks in for a
# callback that's slow or never arrives. Still comfortably before that
# page's own, separate 60s UNKNOWN_AFTER_MS starts showing "status unknown".
PENDING_RECONCILE_AFTER_SECONDS = 45


def sync_pending_payment(db: Session, payment: Payment) -> None:
    """Lazily reconciles a payment stuck in `pending` by asking Safaricom
    directly via STK Query — a fallback for when their result callback is
    dropped or delayed. Mirrors sync_expiry(): no cron, just called from the
    read paths (membership/status) that already poll payment status."""
    if payment.status != PaymentStatus.pending or not payment.checkout_request_id:
        return

    age = datetime.now(UTC) - payment.created_at
    if age < timedelta(seconds=PENDING_RECONCILE_AFTER_SECONDS):
        return

    parsed = mpesa.query_stk_status(payment.checkout_request_id)
    if parsed is None:
        return  # still processing, or the query itself was inconclusive — try again next poll

    membership = db.query(Membership).filter(Membership.user_id == payment.user_id).first()
    should_activate = False

    if parsed["result_code"] == 0:
        payment.status = PaymentStatus.completed
        should_activate = bool(membership and membership.status == MembershipStatus.payment_pending)
    elif parsed["cancelled"]:
        payment.status = PaymentStatus.cancelled
        if membership and membership.status == MembershipStatus.payment_pending:
            membership.status = MembershipStatus.none
    else:
        payment.status = PaymentStatus.failed
        if membership and membership.status == MembershipStatus.payment_pending:
            membership.status = MembershipStatus.none

    db.commit()
    if should_activate:
        _activate_membership(db, membership, payment.user)


def sync_expiry(db: Session, membership: Membership) -> None:
    """Lazily flips active -> expired once period_end has passed. No cron
    needed — called on the read paths (auth/me, membership/status) that
    already touch membership on every page load."""
    if (
        membership.status == MembershipStatus.active
        and membership.period_end
        and membership.period_end < date.today()  # noqa: DTZ011 — naive Date comparison, see _activate_membership()
    ):
        membership.status = MembershipStatus.expired
        db.commit()


def admin_add_member(
    db: Session,
    admin: User,
    email: str,
    display_name: str,
    registration_number: str | None,
    github_handle: str | None,
    reason: str,
    password: str | None = None,
    activation: str = "active",
    phone: str | None = None,
    mpesa_receipt: str | None = None,
    amount_kes: float | None = None,
) -> tuple[User, str | None]:
    """Returns (user, temp_password) — temp_password is only set (and only
    ever shown once, in the API response) when a brand-new account was
    created with an auto-generated password (i.e. the admin left `password`
    blank); the admin is responsible for sharing it with the member.

    `activation="active"` grants membership immediately for free (the
    original sponsor-path behavior). `activation="stk_push"` instead sends a
    real M-Pesa request to `phone` — the account exists right away, but
    membership only goes active once they actually pay, via the exact same
    start_activation() used for self-service signup. `activation="manual_receipt"`
    is for a payment that already happened outside the app (cash, or paid to
    a till/agent directly) — records a completed Payment with the receipt the
    admin was given, then activates membership the same way a real STK
    callback would."""
    import secrets

    from app.services.auth import (  # local import avoids a circular import
        create_user,
        get_user_by_email,
    )

    if activation == "stk_push" and not phone:
        raise MembershipError("A phone number is required to send an M-Pesa request")
    if activation == "manual_receipt":
        if not phone:
            raise MembershipError("A phone number is required to record a payment")
        if not mpesa_receipt or not mpesa_receipt.strip():
            raise MembershipError("An M-Pesa receipt code is required")

    user = get_user_by_email(db, email)
    if user and user.membership.status == MembershipStatus.active:
        raise MembershipError(f"{email} is already an active member")

    temp_password: str | None = None
    if not user:
        temp_password = password or secrets.token_urlsafe(9)
        user = create_user(db, email, password=temp_password)
        if password:
            temp_password = None  # admin already knows the password they chose

    user.profile.display_name = display_name
    if registration_number:
        user.profile.registration_number = registration_number
    if github_handle:
        user.profile.github_url = f"github.com/{github_handle}"

    if activation == "stk_push":
        assert phone is not None  # validated above
        audit.log(db, admin, "import", f"Added {email} and requested M-Pesa payment via STK push · reason: {reason}")
        db.commit()
        start_activation(db, user, phone)
    elif activation == "manual_receipt":
        assert phone is not None and mpesa_receipt is not None  # validated above
        receipt = mpesa_receipt.strip()
        payment = Payment(
            user_id=user.id,
            amount=amount_kes or settings.membership_fee_kes,
            phone=phone,
            mpesa_receipt=receipt,
            status=PaymentStatus.completed,
        )
        db.add(payment)
        audit.log(db, admin, "import", f"Added {email} and recorded payment {receipt} · reason: {reason}")
        db.commit()
        _activate_membership(db, user.membership, user)
    else:
        user.membership.status = MembershipStatus.active
        user.membership.period_start = date.today()  # noqa: DTZ011 — naive Date, see _activate_membership()
        user.membership.period_end = date.today() + timedelta(days=365)  # noqa: DTZ011
        audit.log(db, admin, "import", f"Added {email} as active member without payment · reason: {reason}")
        notification.notify(db, user, "membership", "You're a member ✓", "A club admin added you directly — welcome in.")
        db.commit()

    db.refresh(user)
    _send_membership_email(user, temp_password)
    return user, temp_password
