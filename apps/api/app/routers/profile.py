import base64

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user
from app.models.signature import Signature
from app.models.user import User
from app.schemas.profile import OnboardingRequest, ProfileResponse
from app.schemas.signature import SaveSignatureRequest, SignatureImage, SignatureStatus
from app.schemas.upload import FileUploadResponse
from app.services import signature as signature_service
from app.services import uploads as uploads_service

router = APIRouter(prefix="/profile", tags=["profile"])

# Subset of uploads_service.ALLOWED_CONTENT_TYPES — a profile photo has no
# business being a PDF or zip.
AVATAR_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


@router.get("/me", response_model=ProfileResponse)
def get_my_profile(user: User = Depends(get_current_user)):
    return user.profile


@router.patch("/me", response_model=ProfileResponse)
def update_my_profile(
    payload: OnboardingRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Blocks onboarding specifically (this is the endpoint the wizard calls)
    # for an account that hasn't proven its email is real yet — admins skip
    # onboarding entirely already (see auth.py's _is_onboarded) so they're
    # exempt here too, for the same reason.
    if not user.is_admin and not user.email_verified:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Verify your email before completing your profile")

    profile = user.profile
    for field, value in payload.model_dump().items():
        setattr(profile, field, value)
    profile.onboarded = True
    db.commit()
    db.refresh(profile)
    return profile


# ── photo ────────────────────────────────────────────────────────────────
# Self-service, unlike /admin/uploads — any signed-in member can set their
# own avatar. Google sign-in seeds photo_url from the account's picture
# (see routers/auth.py), but never overwrites a photo a member set here.


@router.post("/me/photo", response_model=FileUploadResponse)
def upload_my_photo(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if file.content_type not in AVATAR_CONTENT_TYPES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Profile photos must be a JPEG, PNG, WEBP, or GIF")
    try:
        url = uploads_service.upload_file(file.file.read(), file.content_type, folder="mut-tech/avatars")
    except uploads_service.UploadError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

    user.profile.photo_url = url
    db.commit()
    return FileUploadResponse(url=url)


@router.delete("/me/photo", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_photo(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.profile.photo_url = None
    db.commit()


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
