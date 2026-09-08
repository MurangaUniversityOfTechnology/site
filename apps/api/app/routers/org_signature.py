import base64

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import require_chairperson
from app.models.org_signature import OrgSignature
from app.models.user import User
from app.schemas.signature import SaveSignatureRequest, SignatureImage, SignatureStatus
from app.services import org_signature as org_signature_service

# The Dean/Club Patron's signature — kept up to date by whoever currently
# holds the "Chairperson" tag, for reuse on official documents later. See
# app.services.org_signature and app.core.deps.require_chairperson.
router = APIRouter(
    prefix="/org-signature", tags=["org-signature"], dependencies=[Depends(require_chairperson)]
)


@router.get("", response_model=SignatureStatus)
def get_org_signature_status(db: Session = Depends(get_db)):
    sig = db.query(OrgSignature).first()
    return SignatureStatus(has_signature=sig is not None, updated_at=sig.updated_at if sig else None)


@router.get("/image", response_model=SignatureImage)
def get_org_signature_image(db: Session = Depends(get_db)):
    sig = db.query(OrgSignature).first()
    if not sig:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No Dean/Patron signature on file")
    raw = org_signature_service.get_org_signature_image(db)
    return SignatureImage(image_base64=base64.b64encode(raw).decode("ascii"), updated_at=sig.updated_at)


@router.put("", response_model=SignatureStatus)
def save_org_signature(
    payload: SaveSignatureRequest,
    chairperson: User = Depends(require_chairperson),
    db: Session = Depends(get_db),
):
    try:
        sig = org_signature_service.save_org_signature(db, chairperson, payload.image_base64)
    except org_signature_service.SignatureError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return SignatureStatus(has_signature=True, updated_at=sig.updated_at)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def delete_org_signature(chairperson: User = Depends(require_chairperson), db: Session = Depends(get_db)):
    org_signature_service.delete_org_signature(db, chairperson)
