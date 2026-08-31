from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

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


def create_session_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(UTC) + SESSION_TTL,
        "iat": datetime.now(UTC),
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def decode_session_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        return payload.get("sub")
    except jwt.PyJWTError:
        return None


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
