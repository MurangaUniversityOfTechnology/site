from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.models.donation import Donation, DonationReason
from app.models.payment import PaymentStatus
from app.models.user import User
from app.services import mpesa

DONATION_CALLBACK_PATH = "/mpesa/donations/callback"


class DonationError(Exception):
    pass


def start_donation(
    db: Session,
    *,
    amount: int,
    phone: str,
    reason: DonationReason,
    donor_name: str | None,
    is_anonymous: bool,
    message: str | None,
    user: User | None,
) -> Donation:
    donation = Donation(
        user_id=user.id if user else None,
        amount=amount,
        phone=phone,
        reason=reason,
        donor_name=donor_name,
        is_anonymous=is_anonymous,
        message=message,
        status=PaymentStatus.initiated,
    )
    db.add(donation)
    db.flush()

    try:
        response = mpesa.initiate_stk_push(
            phone=phone,
            amount=amount,
            # Daraja caps AccountReference at 12 characters.
            account_reference=f"DON-{donation.id.hex[:8]}",
            # Daraja caps TransactionDesc at 13 characters.
            transaction_desc="Donation",
            callback_path=DONATION_CALLBACK_PATH,
        )
    except mpesa.MpesaError as exc:
        donation.status = PaymentStatus.failed
        donation.raw_callback = {"error": str(exc)}
        db.commit()
        raise DonationError(str(exc)) from exc

    donation.checkout_request_id = response["CheckoutRequestID"]
    donation.merchant_request_id = response["MerchantRequestID"]
    donation.status = PaymentStatus.pending
    db.commit()
    db.refresh(donation)
    return donation


def apply_stk_callback(db: Session, payload: dict) -> None:
    parsed = mpesa.parse_stk_callback(payload)

    donation = (
        db.query(Donation)
        .filter(Donation.checkout_request_id == parsed["checkout_request_id"])
        .first()
    )
    if not donation:
        return  # unknown checkout request — nothing to reconcile

    # Idempotent — see membership.apply_stk_callback for why a completed
    # donation can still backfill a late receipt.
    if donation.status in (PaymentStatus.completed, PaymentStatus.failed, PaymentStatus.cancelled):
        if donation.status == PaymentStatus.completed and not donation.mpesa_receipt and parsed["mpesa_receipt"]:
            donation.mpesa_receipt = parsed["mpesa_receipt"]
            db.commit()
        return

    donation.raw_callback = payload
    if parsed["result_code"] == 0:
        donation.status = PaymentStatus.completed
        donation.mpesa_receipt = parsed["mpesa_receipt"]
    elif parsed["cancelled"]:
        donation.status = PaymentStatus.cancelled
    else:
        donation.status = PaymentStatus.failed

    db.commit()


# Mirrors membership.PENDING_RECONCILE_AFTER_SECONDS — see that module for
# why this threshold and why it's a read-path fallback rather than a cron.
PENDING_RECONCILE_AFTER_SECONDS = 45


def sync_pending_donation(db: Session, donation: Donation) -> None:
    if donation.status != PaymentStatus.pending or not donation.checkout_request_id:
        return

    age = datetime.now(UTC) - donation.created_at
    if age < timedelta(seconds=PENDING_RECONCILE_AFTER_SECONDS):
        return

    parsed = mpesa.query_stk_status(donation.checkout_request_id)
    if parsed is None:
        return  # still processing, or the query itself was inconclusive — try again next poll

    if parsed["result_code"] == 0:
        donation.status = PaymentStatus.completed
    elif parsed["cancelled"]:
        donation.status = PaymentStatus.cancelled
    else:
        donation.status = PaymentStatus.failed

    db.commit()
