import base64
import binascii

from sqlalchemy.orm import Session

from app.core.security import decrypt_bytes, encrypt_bytes
from app.models.signature import Signature
from app.models.user import User

# A drawn signature is a few KB at most — this is just an abuse guard, not a
# real limit anyone should ever hit.
MAX_SIGNATURE_BYTES = 300_000


class SignatureError(Exception):
    pass


def _decode_png(image_base64: str) -> bytes:
    image_base64 = image_base64.strip()
    if image_base64.startswith("data:") and "," in image_base64:
        image_base64 = image_base64.split(",", 1)[1]
    try:
        raw = base64.b64decode(image_base64, validate=True)
    except binascii.Error as exc:
        raise SignatureError("Invalid image data") from exc
    if not raw.startswith(b"\x89PNG\r\n\x1a\n"):
        raise SignatureError("Signature must be a PNG image")
    if len(raw) > MAX_SIGNATURE_BYTES:
        raise SignatureError("Signature image is too large")
    return raw


def save_signature(db: Session, user: User, image_base64: str) -> Signature:
    raw = _decode_png(image_base64)
    ciphertext = encrypt_bytes(raw)

    sig = db.get(Signature, user.id)
    if sig:
        sig.ciphertext = ciphertext
    else:
        sig = Signature(user_id=user.id, ciphertext=ciphertext)
        db.add(sig)
    db.commit()
    db.refresh(sig)
    return sig


def get_signature_image(db: Session, user: User) -> bytes | None:
    sig = db.get(Signature, user.id)
    if not sig:
        return None
    return decrypt_bytes(sig.ciphertext)


def delete_signature(db: Session, user: User) -> None:
    sig = db.get(Signature, user.id)
    if not sig:
        return
    db.delete(sig)
    db.commit()
