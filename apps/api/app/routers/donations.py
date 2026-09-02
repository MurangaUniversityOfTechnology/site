import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user_optional
from app.core.rate_limit import limiter
from app.models.donation import Donation
from app.models.payment import PaymentStatus
from app.models.user import User
from app.schemas.donation import (
    CreateDonationRequest,
    DonationStatusResponse,
    DonationWallEntry,
)
from app.services import donation as donation_service

router = APIRouter(tags=["donations"])


@router.post("/donations", response_model=DonationStatusResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/hour")
def create_donation(
    request: Request,
    payload: CreateDonationRequest,
    user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    try:
        donation = donation_service.start_donation(
            db,
            amount=payload.amount,
            phone=payload.phone,
            reason=payload.reason,
            donor_name=payload.donor_name,
            is_anonymous=payload.is_anonymous,
            message=payload.message,
            user=user,
        )
    except donation_service.DonationError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

    return donation


@router.get("/donations/wall", response_model=list[DonationWallEntry])
def donation_wall(db: Session = Depends(get_db)):
    rows = (
        db.query(Donation)
        .filter(Donation.status == PaymentStatus.completed)
        .order_by(Donation.created_at.desc())
        .limit(20)
        .all()
    )
    return [
        DonationWallEntry(
            donor_name=None if d.is_anonymous else d.donor_name,
            reason=d.reason,
            message=d.message,
            amount=float(d.amount),
            created_at=d.created_at,
        )
        for d in rows
    ]


@router.get("/donations/{donation_id}", response_model=DonationStatusResponse)
def donation_status(donation_id: uuid.UUID, db: Session = Depends(get_db)):
    donation = db.get(Donation, donation_id)
    if not donation:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Donation not found")
    donation_service.sync_pending_donation(db, donation)
    return donation


@router.post("/mpesa/donations/callback", status_code=status.HTTP_200_OK)
async def mpesa_donation_callback(request: Request, db: Session = Depends(get_db)):
    payload = await request.json()
    donation_service.apply_stk_callback(db, payload)
    # Safaricom expects this exact envelope to consider the callback acknowledged.
    return {"ResultCode": 0, "ResultDesc": "Accepted"}
