from fastapi import Cookie, Depends, HTTPException, Request, status
from mpesakit.security.ip_whitelist import is_mpesa_ip_allowed
from sqlalchemy.orm import Session

from app.core.config import get_settings
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


def require_staff(user: User = Depends(get_current_user)) -> User:
    """Scoped admin access — forms, courses, events. Admins always qualify."""
    if not (user.is_admin or user.is_staff):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Staff access required")
    return user


def require_mpesa_ip(request: Request) -> None:
    """Guards every /mpesa/callback* route against forged callbacks. Real
    STK push callbacks only ever arrive from Safaricom's Daraja servers, so
    anything else is rejected before the payload is ever parsed or trusted —
    without this, a caller who guesses/enumerates a pending
    checkout_request_id could POST a fabricated ResultCode: 0 and grant
    themselves a membership/enrollment/registration for free.

    `request.client.host` is trustworthy here because uvicorn is started
    with --proxy-headers --forwarded-allow-ips='*' (see the Dockerfile) and
    the API is never reachable except through Caddy in production — Caddy
    always appends the real observed peer to X-Forwarded-For regardless of
    what a client sends, so this can't be spoofed via that header.

    Skipped in development, matching mpesakit's own documented caveat that
    local/ngrok testing never originates from a real Safaricom IP:
    https://mpesakit.dev/webhooks-best-practices
    """
    if get_settings().environment == "development":
        return
    client_host = request.client.host if request.client else None
    if not client_host or not is_mpesa_ip_allowed(client_host):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not a recognized M-Pesa callback source")


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
