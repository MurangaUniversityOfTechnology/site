from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.membership import Membership, MembershipStatus
from app.models.payment import Payment, PaymentStatus
from app.models.user import User
from app.services import audit, mpesa, notification

settings = get_settings()


class MembershipError(Exception):
    pass


def start_activation(db: Session, user: User, phone: str) -> Payment:
    membership = user.membership
    if membership.status not in (MembershipStatus.none, MembershipStatus.rejected, MembershipStatus.expired):
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
            account_reference=f"MUTTECH-{user.id.hex[:8]}",
            transaction_desc="MUT Tech Community membership",
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


def apply_stk_callback(db: Session, payload: dict) -> None:
    parsed = mpesa.parse_stk_callback(payload)

    payment = (
        db.query(Payment)
        .filter(Payment.checkout_request_id == parsed["checkout_request_id"])
        .first()
    )
    if not payment:
        return  # unknown checkout request — nothing to reconcile

    # Idempotent: a duplicate callback for an already-terminal payment is a no-op.
    if payment.status in (PaymentStatus.completed, PaymentStatus.failed, PaymentStatus.cancelled):
        return

    payment.raw_callback = payload
    membership = db.query(Membership).filter(Membership.user_id == payment.user_id).first()

    if parsed["result_code"] == 0:
        payment.status = PaymentStatus.completed
        payment.mpesa_receipt = parsed["mpesa_receipt"]
        if membership and membership.status == MembershipStatus.payment_pending:
            membership.status = MembershipStatus.approval_pending
    elif parsed["cancelled"]:
        payment.status = PaymentStatus.cancelled
        if membership and membership.status == MembershipStatus.payment_pending:
            membership.status = MembershipStatus.none
    else:
        payment.status = PaymentStatus.failed
        if membership and membership.status == MembershipStatus.payment_pending:
            membership.status = MembershipStatus.none

    db.commit()


def approve(db: Session, admin: User, applicant: User) -> None:
    membership = applicant.membership
    if membership.status != MembershipStatus.approval_pending:
        raise MembershipError(f"Cannot approve from status '{membership.status.value}'")

    membership.status = MembershipStatus.active
    membership.period_start = date.today()
    membership.period_end = date.today() + timedelta(days=365)
    audit.log(db, admin, "membership", f"Approved membership for {applicant.email}")
    notification.notify(db, applicant, "membership", "Membership approved ✓", "Your Tech Club membership is now active.")
    db.commit()


def reject(db: Session, admin: User, applicant: User) -> None:
    membership = applicant.membership
    if membership.status != MembershipStatus.approval_pending:
        raise MembershipError(f"Cannot reject from status '{membership.status.value}'")

    membership.status = MembershipStatus.rejected
    audit.log(db, admin, "membership", f"Rejected membership for {applicant.email}")
    notification.notify(db, applicant, "membership", "Membership application not approved", "Reach out to a club admin if you'd like to know more.")
    db.commit()


def latest_payment(db: Session, user: User) -> Payment | None:
    return (
        db.query(Payment)
        .filter(Payment.user_id == user.id)
        .order_by(Payment.created_at.desc())
        .first()
    )


def sync_expiry(db: Session, membership: Membership) -> None:
    """Lazily flips active -> expired once period_end has passed. No cron
    needed — called on the read paths (auth/me, membership/status) that
    already touch membership on every page load."""
    if membership.status == MembershipStatus.active and membership.period_end and membership.period_end < date.today():
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
) -> tuple[User, str | None]:
    """Returns (user, temp_password) — temp_password is only set (and only
    ever shown once, in the API response) when a brand-new account was
    created; the admin is responsible for sharing it with the member."""
    import secrets

    from app.services.auth import create_user, get_user_by_email  # local import avoids a circular import

    user = get_user_by_email(db, email)
    if user and user.membership.status == MembershipStatus.active:
        raise MembershipError(f"{email} is already an active member")

    temp_password: str | None = None
    if not user:
        temp_password = secrets.token_urlsafe(9)
        user = create_user(db, email, password=temp_password)

    user.profile.display_name = display_name
    if registration_number:
        user.profile.registration_number = registration_number
    if github_handle:
        user.profile.github_url = f"github.com/{github_handle}"

    user.membership.status = MembershipStatus.active
    user.membership.period_start = date.today()
    user.membership.period_end = date.today() + timedelta(days=365)

    audit.log(db, admin, "import", f"Added {email} as active member without payment · reason: {reason}")
    notification.notify(db, user, "membership", "You're a member ✓", "A club admin added you directly — welcome in.")
    db.commit()
    db.refresh(user)
    return user, temp_password
