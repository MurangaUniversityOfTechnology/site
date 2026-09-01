from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import SESSION_COOKIE_NAME, decode_session_token
from app.models.user import User


def get_current_user(
    session: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
    db: Session = Depends(get_db),
) -> User:
    if not session:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")

    decoded = decode_session_token(session)
    if not decoded:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired session")
    user_id, session_version = decoded

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    if user.session_version != session_version:
        # A password change/reset since this cookie was issued — see
        # create_session_token()'s "sver" claim.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired session")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin access required")
    return user


def get_current_user_optional(
    session: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
    db: Session = Depends(get_db),
) -> User | None:
    if not session:
        return None
    decoded = decode_session_token(session)
    if not decoded:
        return None
    user_id, session_version = decoded
    user = db.get(User, user_id)
    if not user or user.session_version != session_version:
        return None
    return user
