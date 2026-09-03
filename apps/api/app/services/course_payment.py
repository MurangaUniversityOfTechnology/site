from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.models.course_enrollment import CourseEnrollment
from app.models.course_payment import CoursePayment
from app.models.payment import PaymentStatus
from app.services import mpesa

# The route lives on courses.router, which has prefix="/courses" — so this
# resolves to the actual mounted path, not "/mpesa/courses/callback".
COURSE_CALLBACK_PATH = "/courses/mpesa/callback"


class CoursePaymentError(Exception):
    pass


def start_course_payment(db: Session, enrollment: CourseEnrollment, phone: str, amount: int) -> CoursePayment:
    """Doesn't commit — the caller (services/course.py's enroll()) commits
    the enrollment and this payment together, so a failed STK push rolls
    back the enrollment too rather than leaving an unpaid enrollment
    granting no access."""
    payment = CoursePayment(enrollment_id=enrollment.id, amount=amount, phone=phone, status=PaymentStatus.initiated)
    db.add(payment)
    db.flush()

    try:
        response = mpesa.initiate_stk_push(
            phone=phone,
            amount=amount,
            # Daraja caps AccountReference at 12 characters.
            account_reference=f"CRS-{enrollment.id.hex[:8]}",
            # Daraja caps TransactionDesc at 13 characters.
            transaction_desc="Course fee",
            callback_path=COURSE_CALLBACK_PATH,
        )
    except mpesa.MpesaError as exc:
        raise CoursePaymentError(str(exc)) from exc

    payment.checkout_request_id = response["CheckoutRequestID"]
    payment.merchant_request_id = response["MerchantRequestID"]
    payment.status = PaymentStatus.pending
    return payment


def latest_payment_for(db: Session, enrollment_id) -> CoursePayment | None:
    return db.query(CoursePayment).filter(CoursePayment.enrollment_id == enrollment_id).first()


def apply_stk_callback(db: Session, payload: dict) -> None:
    parsed = mpesa.parse_stk_callback(payload)

    payment = (
        db.query(CoursePayment).filter(CoursePayment.checkout_request_id == parsed["checkout_request_id"]).first()
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

    if parsed["result_code"] == 0:
        payment.status = PaymentStatus.completed
        payment.mpesa_receipt = parsed["mpesa_receipt"]
    else:
        # Unlike a paid event, there's no "seat" to free on failure — the
        # enrollment simply stays without access, and the student can pay
        # again later (a fresh enroll attempt is blocked while this one
        # exists, same limitation events already have for a cancelled
        # registration — not something introduced here).
        payment.status = PaymentStatus.cancelled if parsed["cancelled"] else PaymentStatus.failed

    db.commit()


# Mirrors event_payment.PENDING_RECONCILE_AFTER_SECONDS — see that module
# for why this threshold and why it's a read-path fallback rather than a cron.
PENDING_RECONCILE_AFTER_SECONDS = 45


def sync_pending_course_payment(db: Session, payment: CoursePayment) -> None:
    if payment.status != PaymentStatus.pending or not payment.checkout_request_id:
        return

    age = datetime.now(UTC) - payment.created_at
    if age < timedelta(seconds=PENDING_RECONCILE_AFTER_SECONDS):
        return

    parsed = mpesa.query_stk_status(payment.checkout_request_id)
    if parsed is None:
        return  # still processing, or the query itself was inconclusive — try again next poll

    if parsed["result_code"] == 0:
        payment.status = PaymentStatus.completed
    else:
        payment.status = PaymentStatus.cancelled if parsed["cancelled"] else PaymentStatus.failed

    db.commit()
