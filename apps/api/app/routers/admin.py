from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import require_admin
from app.models.audit_log import AuditLog
from app.models.membership import Membership, MembershipStatus
from app.models.payment import Payment, PaymentStatus
from app.models.user import User
from app.schemas.admin import AdminOverview, AuditEntry, MembershipApplication, PaymentRow, PaymentsOverview, PaymentTotal
from app.services import membership as membership_service

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])

STATUS_FILTERS = {
    "pending": [MembershipStatus.approval_pending],
    "active": [MembershipStatus.active],
    "rejected": [MembershipStatus.rejected],
    "all": None,
}


@router.get("/overview", response_model=AdminOverview)
def overview(db: Session = Depends(get_db)):
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    return AdminOverview(
        total_members=db.query(Membership).filter(Membership.status == MembershipStatus.active).count(),
        pending_approval=db.query(Membership).filter(Membership.status == MembershipStatus.approval_pending).count(),
        new_this_week=db.query(User).filter(User.created_at >= week_ago).count(),
        unmatched_payments=db.query(Payment)
        .filter(Payment.status.in_([PaymentStatus.pending, PaymentStatus.failed]))
        .count(),
    )


@router.get("/memberships", response_model=list[MembershipApplication])
def list_memberships(status_filter: str = "pending", db: Session = Depends(get_db)):
    statuses = STATUS_FILTERS.get(status_filter, STATUS_FILTERS["pending"])
    query = db.query(Membership)
    if statuses is not None:
        query = query.filter(Membership.status.in_(statuses))

    out = []
    for m in query.all():
        user = m.user
        profile = user.profile
        payment = membership_service.latest_payment(db, user)
        name = " ".join(part for part in [profile.first_name, profile.last_name] if part) if profile else ""
        out.append(
            MembershipApplication(
                user_id=user.id,
                name=name or user.email,
                email=user.email,
                course=profile.course if profile else None,
                year_of_study=profile.year_of_study if profile else None,
                registration_number=profile.registration_number if profile else None,
                payment_amount=float(payment.amount) if payment else None,
                payment_receipt=payment.mpesa_receipt if payment else None,
                payment_status=payment.status.value if payment else None,
                membership_status=m.status.value,
            )
        )
    return out


@router.post("/memberships/{user_id}/approve", status_code=status.HTTP_204_NO_CONTENT)
def approve_membership(user_id: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    applicant = db.get(User, user_id)
    if not applicant:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    try:
        membership_service.approve(db, admin, applicant)
    except membership_service.MembershipError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.post("/memberships/{user_id}/reject", status_code=status.HTTP_204_NO_CONTENT)
def reject_membership(user_id: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    applicant = db.get(User, user_id)
    if not applicant:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    try:
        membership_service.reject(db, admin, applicant)
    except membership_service.MembershipError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.get("/payments", response_model=PaymentsOverview)
def payments_overview(db: Session = Depends(get_db)):
    def total_for(*statuses: PaymentStatus) -> PaymentTotal:
        rows = db.query(Payment).filter(Payment.status.in_(statuses)).all()
        return PaymentTotal(
            label=statuses[0].value,
            amount_kes=float(sum(p.amount for p in rows)),
            count=len(rows),
        )

    totals = [
        total_for(PaymentStatus.completed),
        total_for(PaymentStatus.pending, PaymentStatus.initiated),
        total_for(PaymentStatus.failed, PaymentStatus.cancelled),
    ]

    rows = db.query(Payment).order_by(Payment.created_at.desc()).limit(50).all()
    payment_rows = [
        PaymentRow(
            receipt=p.mpesa_receipt,
            member=p.user.email,
            amount=float(p.amount),
            status=p.status.value,
        )
        for p in rows
    ]
    return PaymentsOverview(totals=totals, rows=payment_rows)


@router.get("/audit", response_model=list[AuditEntry])
def audit_log(db: Session = Depends(get_db)):
    entries = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(100).all()
    return [AuditEntry(at=e.created_at, who=e.actor_name, what=e.action, kind=e.kind) for e in entries]
