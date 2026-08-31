import base64

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user
from app.models.signature import Signature
from app.models.user import User
from app.schemas.profile import OnboardingRequest, ProfileResponse
from app.schemas.signature import SaveSignatureRequest, SignatureImage, SignatureStatus
from app.services import signature as signature_service

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("/me", response_model=ProfileResponse)
def get_my_profile(user: User = Depends(get_current_user)):
    return user.profile


@router.patch("/me", response_model=ProfileResponse)
def update_my_profile(
    payload: OnboardingRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = user.profile
    for field, value in payload.model_dump().items():
        setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    return profile


# ── signature ────────────────────────────────────────────────────────────
# Self-service only — a member captures and previews their own signature.
# The decrypted image is never returned for anyone but its owner; document
# generation (later) will decrypt in-memory server-side instead of over this
# API.


@router.get("/me/signature", response_model=SignatureStatus)
def get_signature_status(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sig = db.get(Signature, user.id)
    return SignatureStatus(has_signature=sig is not None, updated_at=sig.updated_at if sig else None)


@router.get("/me/signature/image", response_model=SignatureImage)
def get_signature_image(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sig = db.get(Signature, user.id)
    if not sig:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No signature on file")
    raw = signature_service.get_signature_image(db, user)
    return SignatureImage(image_base64=base64.b64encode(raw).decode("ascii"), updated_at=sig.updated_at)


@router.put("/me/signature", response_model=SignatureStatus)
def save_signature(
    payload: SaveSignatureRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    try:
        sig = signature_service.save_signature(db, user, payload.image_base64)
    except signature_service.SignatureError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return SignatureStatus(has_signature=True, updated_at=sig.updated_at)


@router.delete("/me/signature", status_code=status.HTTP_204_NO_CONTENT)
def delete_signature(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    signature_service.delete_signature(db, user)
