from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user
from app.models.payment import Payment
from app.models.user import User
from app.schemas.membership import (
    ActivateMembershipRequest,
    MembershipStatusResponse,
    PaymentStatusResponse,
)
from app.services import membership as membership_service

router = APIRouter(tags=["membership"])


def _payment_response(payment: Payment) -> PaymentStatusResponse:
    return PaymentStatusResponse(
        id=payment.id,
        status=payment.status.value,
        amount=float(payment.amount),
        phone=payment.phone,
        mpesa_receipt=payment.mpesa_receipt,
        created_at=payment.created_at,
    )


@router.post("/membership/activate", response_model=PaymentStatusResponse, status_code=status.HTTP_201_CREATED)
def activate_membership(
    payload: ActivateMembershipRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        payment = membership_service.start_activation(db, user, payload.phone)
    except membership_service.MembershipError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

    return _payment_response(payment)


@router.get("/membership/status", response_model=MembershipStatusResponse)
def membership_status(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    membership_service.sync_expiry(db, user.membership)
    payment = membership_service.latest_payment(db, user)
    return MembershipStatusResponse(
        membership_status=user.membership.status.value,
        latest_payment=_payment_response(payment) if payment else None,
    )


@router.post("/mpesa/callback", status_code=status.HTTP_200_OK)
async def mpesa_callback(request: Request, db: Session = Depends(get_db)):
    payload = await request.json()
    membership_service.apply_stk_callback(db, payload)
    # Safaricom expects this exact envelope to consider the callback acknowledged.
    return {"ResultCode": 0, "ResultDesc": "Accepted"}
