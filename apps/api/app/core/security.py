import hashlib
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt
from cryptography.fernet import Fernet

from app.core.config import get_settings

settings = get_settings()

SESSION_COOKIE_NAME = "session"
SESSION_TTL = timedelta(days=30)

# bcrypt only uses the first 72 bytes of the input; reject longer passwords
# outright rather than silently truncating them.
MAX_PASSWORD_BYTES = 72


def hash_password(password: str) -> str:
    if len(password.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise ValueError(f"Password must be at most {MAX_PASSWORD_BYTES} bytes")
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    if len(password.encode("utf-8")) > MAX_PASSWORD_BYTES:
        return False
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def create_session_token(user_id: str, session_version: int) -> str:
    payload = {
        "sub": user_id,
        # A distinct "purpose" claim (see create_email_verification_token's
        # comment below) — without it, a verification or password-reset
        # link (which also just carries a signed "sub") could be replayed
        # as a working session cookie for that account.
        "purpose": "session",
        # Bumped on every password change/reset — lets change_password() and
        # reset_password() invalidate every *other* outstanding session for
        # the account without a server-side token blocklist.
        "sver": session_version,
        "exp": datetime.now(UTC) + SESSION_TTL,
        "iat": datetime.now(UTC),
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def decode_session_token(token: str) -> tuple[str, int] | None:
    """Returns (user_id, session_version) — the caller (get_current_user)
    still has to compare session_version against the user's current one;
    this only proves the token itself is a well-formed, unexpired session
    token, not that it's still the account's live one."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        if payload.get("purpose") != "session":
            return None
        sub = payload.get("sub")
        if not sub:
            return None
        return sub, payload.get("sver", 0)
    except jwt.PyJWTError:
        return None


def _signature_fernet() -> Fernet:
    return Fernet(settings.signature_encryption_key.encode("utf-8"))


def encrypt_bytes(data: bytes) -> bytes:
    return _signature_fernet().encrypt(data)


def decrypt_bytes(token: bytes) -> bytes:
    return _signature_fernet().decrypt(token)


EMAIL_VERIFICATION_TTL = timedelta(hours=48)


def create_email_verification_token(user_id: str) -> str:
    # A distinct "purpose" claim, not just a shorter TTL, so a leaked/expired
    # verification link can never be replayed as (or confused with) a session
    # token even though both are just HS256 JWTs signed with the same key.
    payload = {
        "sub": user_id,
        "purpose": "verify_email",
        "exp": datetime.now(UTC) + EMAIL_VERIFICATION_TTL,
        "iat": datetime.now(UTC),
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def decode_email_verification_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        if payload.get("purpose") != "verify_email":
            return None
        return payload.get("sub")
    except jwt.PyJWTError:
        return None


PASSWORD_RESET_TTL = timedelta(hours=1)


def _password_hash_fingerprint(password_hash: str | None) -> str:
    # A stable (not Python's hash(), which is randomized per-process) digest
    # of the current password_hash, folded into the "pwh" claim — makes a
    # reset link single-use in practice, since setting a new password changes
    # this fingerprint and any old link stops matching, with no server-side
    # token storage/invalidation needed.
    return hashlib.sha256((password_hash or "").encode("utf-8")).hexdigest()


def create_password_reset_token(user_id: str, password_hash: str | None) -> str:
    payload = {
        "sub": user_id,
        "purpose": "reset_password",
        "pwh": _password_hash_fingerprint(password_hash),
        "exp": datetime.now(UTC) + PASSWORD_RESET_TTL,
        "iat": datetime.now(UTC),
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def decode_password_reset_token_subject(token: str) -> str | None:
    """First pass: who does this token claim to be for? Doesn't confirm the
    token is still valid for that user — call verify_password_reset_token()
    with their current password_hash once loaded, since the fingerprint check
    needs it and it isn't worth a second, separate DB lookup path."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        if payload.get("purpose") != "reset_password":
            return None
        return payload.get("sub")
    except jwt.PyJWTError:
        return None


def verify_password_reset_token(token: str, password_hash: str | None) -> bool:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    except jwt.PyJWTError:
        return False
    if payload.get("purpose") != "reset_password":
        return False
    return payload.get("pwh") == _password_hash_fingerprint(password_hash)
