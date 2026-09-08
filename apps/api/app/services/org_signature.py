from sqlalchemy.orm import Session

from app.core.security import decrypt_bytes, encrypt_bytes
from app.models.org_signature import OrgSignature
from app.models.user import User
from app.services import audit
from app.services.signature import SignatureError, decode_signature_png

__all__ = ["SignatureError", "delete_org_signature", "get_org_signature_image", "save_org_signature"]


def _get(db: Session) -> OrgSignature | None:
    return db.query(OrgSignature).first()


def save_org_signature(db: Session, chairperson: User, image_base64: str) -> OrgSignature:
    raw = decode_signature_png(image_base64)
    ciphertext = encrypt_bytes(raw)

    sig = _get(db)
    if sig:
        sig.ciphertext = ciphertext
        sig.updated_by_id = chairperson.id
    else:
        sig = OrgSignature(ciphertext=ciphertext, updated_by_id=chairperson.id)
        db.add(sig)
    audit.log(db, chairperson, "settings", "Updated the Dean/Patron signature")
    db.commit()
    db.refresh(sig)
    return sig


def get_org_signature_image(db: Session) -> bytes | None:
    sig = _get(db)
    if not sig:
        return None
    return decrypt_bytes(sig.ciphertext)


def delete_org_signature(db: Session, chairperson: User) -> None:
    sig = _get(db)
    if not sig:
        return
    db.delete(sig)
    audit.log(db, chairperson, "settings", "Removed the Dean/Patron signature")
    db.commit()
