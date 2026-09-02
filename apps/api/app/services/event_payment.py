from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.models.event_payment import EventPayment
from app.models.event_registration import EventRegistration, RegistrationStatus
from app.models.payment import PaymentStatus
from app.services import mpesa

# The route lives on events.router, which has prefix="/events" — so this
# resolves to the actual mounted path, not "/mpesa/events/callback".
EVENT_CALLBACK_PATH = "/events/mpesa/callback"


class EventPaymentError(Exception):
    pass


def start_event_payment(db: Session, registration: EventRegistration, phone: str, amount: int) -> EventPayment:
    """Doesn't commit — the caller (services/event.py's register()) commits
    the registration and this payment together, so a failed STK push rolls
    back the registration too rather than leaving an unpaid seat held."""
    payment = EventPayment(registration_id=registration.id, amount=amount, phone=phone, status=PaymentStatus.initiated)
    db.add(payment)
    db.flush()

    try:
        response = mpesa.initiate_stk_push(
            phone=phone,
            amount=amount,
            # Daraja caps AccountReference at 12 characters.
            account_reference=f"EVT-{registration.id.hex[:8]}",
            # Daraja caps TransactionDesc at 13 characters.
            transaction_desc="Event fee",
            callback_path=EVENT_CALLBACK_PATH,
        )
    except mpesa.MpesaError as exc:
        raise EventPaymentError(str(exc)) from exc

    payment.checkout_request_id = response["CheckoutRequestID"]
    payment.merchant_request_id = response["MerchantRequestID"]
    payment.status = PaymentStatus.pending
    return payment


def latest_payment_for(db: Session, registration_id) -> EventPayment | None:
    return db.query(EventPayment).filter(EventPayment.registration_id == registration_id).first()


def apply_stk_callback(db: Session, payload: dict) -> None:
    parsed = mpesa.parse_stk_callback(payload)

    payment = (
        db.query(EventPayment)
        .filter(EventPayment.checkout_request_id == parsed["checkout_request_id"])
        .first()
    )
    if not payment:
        return  # unknown checkout request — nothing to reconcile

    # Idempotent — see membership.apply_stk_callback for why a completed
    # payment can still backfill a late receipt.
    if payment.status in (PaymentStatus.completed, PaymentStatus.failed, PaymentStatus.cancelled):
        if payment.status == PaymentStatus.completed and not payment.mpesa_receipt and parsed["mpesa_receipt"]:
            payment.mpesa_receipt = parsed["mpesa_receipt"]
            db.commit()
        return

    payment.raw_callback = payload
    registration = payment.registration

    if parsed["result_code"] == 0:
        payment.status = PaymentStatus.completed
        payment.mpesa_receipt = parsed["mpesa_receipt"]
    else:
        # Failed or cancelled — free the seat rather than leaving an unpaid
        # registration holding it (mirrors membership reverting to `none`).
        payment.status = PaymentStatus.cancelled if parsed["cancelled"] else PaymentStatus.failed
        if registration.status in (RegistrationStatus.pending, RegistrationStatus.waitlisted):
            registration.status = RegistrationStatus.cancelled

    db.commit()


# Mirrors membership.PENDING_RECONCILE_AFTER_SECONDS — see that module for
# why this threshold and why it's a read-path fallback rather than a cron.
PENDING_RECONCILE_AFTER_SECONDS = 45


def sync_pending_event_payment(db: Session, payment: EventPayment) -> None:
    if payment.status != PaymentStatus.pending or not payment.checkout_request_id:
        return

    age = datetime.now(UTC) - payment.created_at
    if age < timedelta(seconds=PENDING_RECONCILE_AFTER_SECONDS):
        return

    parsed = mpesa.query_stk_status(payment.checkout_request_id)
    if parsed is None:
        return  # still processing, or the query itself was inconclusive — try again next poll

    registration = payment.registration
    if parsed["result_code"] == 0:
        payment.status = PaymentStatus.completed
    else:
        payment.status = PaymentStatus.cancelled if parsed["cancelled"] else PaymentStatus.failed
        if registration.status in (RegistrationStatus.pending, RegistrationStatus.waitlisted):
            registration.status = RegistrationStatus.cancelled

    db.commit()
