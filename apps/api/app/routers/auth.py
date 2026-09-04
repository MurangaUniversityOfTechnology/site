import logging
import secrets
from datetime import date, timedelta
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_db
from app.core.deps import get_current_user
from app.core.rate_limit import limiter
from app.core.security import (
    SESSION_COOKIE_NAME,
    SESSION_TTL,
    create_email_verification_token,
    create_password_reset_token,
    create_session_token,
    decode_email_verification_token,
    decode_password_reset_token_subject,
    hash_password,
    verify_password,
    verify_password_reset_token,
)
from app.models.membership import MembershipStatus
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    MeResponse,
    ResetPasswordRequest,
    SignupRequest,
)
from app.schemas.github import GithubStatus
from app.services import auth as auth_service
from app.services import email as email_service
from app.services import github as github_service
from app.services import membership as membership_service
from app.services.email_templates import render_email

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()
logger = logging.getLogger(__name__)

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_USER_URL = "https://api.github.com/user"
OAUTH_STATE_COOKIE = "oauth_state"
OAUTH_NEXT_COOKIE = "oauth_next"


def _safe_next(value: str | None) -> str | None:
    """Only ever a same-origin relative path — rejects protocol-relative
    ("//evil.com") and backslash ("/\\evil.com") tricks a browser will still
    treat as absolute, since this value ends up in a server-issued redirect."""
    if not value or not value.startswith("/") or value.startswith(("//", "/\\")):
        return None
    return value


def _set_session_cookie(response: Response, user: User) -> None:
    token = create_session_token(str(user.id), user.session_version)
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.environment != "development",
        samesite="lax",
        max_age=int(SESSION_TTL.total_seconds()),
    )


def _send_verification_email(user: User) -> None:
    token = create_email_verification_token(str(user.id))
    verify_url = f"{settings.api_base_url}/auth/verify-email?token={token}"
    html = render_email(
        eyebrow="verify your email",
        heading="One more step.",
        body_html=(
            f"Confirm <strong>{user.email}</strong> to finish setting up your MUT Tech Community account. "
            "This link expires in 48 hours."
        ),
        cta_label="Verify email",
        cta_url=verify_url,
    )
    try:
        email_service.send_email(to=user.email, subject="Verify your email — MUT Tech Community", html=html)
    except Exception:
        logger.warning("Failed to send verification email to user %s", user.id, exc_info=True)


@router.post("/signup", response_model=MeResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/hour")
def signup(request: Request, payload: SignupRequest, response: Response, db: Session = Depends(get_db)):
    if auth_service.get_user_by_email(db, payload.email):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")

    user = auth_service.create_user(db, payload.email, payload.password)
    _send_verification_email(user)
    _set_session_cookie(response, user)
    return _to_me_response(user)


@router.post("/send-verification-email", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("3/hour")
def send_verification_email(request: Request, user: User = Depends(get_current_user)):
    if user.email_verified:
        return
    _send_verification_email(user)


@router.get("/verify-email")
def verify_email(token: str, db: Session = Depends(get_db)):
    user_id = decode_email_verification_token(token)
    if not user_id:
        return RedirectResponse(f"{settings.web_origin}/verify-email?status=invalid")

    user = db.get(User, user_id)
    if not user:
        return RedirectResponse(f"{settings.web_origin}/verify-email?status=invalid")

    user.email_verified = True
    db.commit()
    return RedirectResponse(f"{settings.web_origin}/verify-email?status=success")


def _send_password_reset_email(user: User) -> None:
    token = create_password_reset_token(str(user.id), user.password_hash)
    reset_url = f"{settings.web_origin}/reset-password?token={token}"
    html = render_email(
        eyebrow="reset your password",
        heading="Reset your password.",
        body_html=(
            "We got a request to reset the password for this MUT Tech Community account. "
            "This link expires in 1 hour and can only be used once. "
            "If you didn't request this, you can ignore this email."
        ),
        cta_label="Reset password",
        cta_url=reset_url,
    )
    try:
        email_service.send_email(to=user.email, subject="Reset your password — MUT Tech Community", html=html)
    except Exception:
        logger.warning("Failed to send password reset email to user %s", user.id, exc_info=True)


@router.post("/forgot-password", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("3/hour")
def forgot_password(request: Request, payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    # Always 204, whether or not the email matches an account — otherwise
    # this endpoint becomes a free account-enumeration oracle.
    user = auth_service.get_user_by_email(db, payload.email)
    if user:
        _send_password_reset_email(user)


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("5/hour")
def reset_password(request: Request, payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    user_id = decode_password_reset_token_subject(payload.token)
    user = db.get(User, user_id) if user_id else None
    if not user or not verify_password_reset_token(payload.token, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This reset link is invalid or has expired")

    # Bumping session_version invalidates every outstanding session cookie
    # for this account (including whatever the attacker was using, if the
    # reset was prompted by a compromise) — see security.py's "sver" claim.
    # No cookie to reissue here since reset-password isn't authenticated;
    # the caller signs in fresh from /sign-in afterward.
    user.password_hash = hash_password(payload.new_password)
    user.session_version += 1
    db.commit()


@router.post("/login", response_model=MeResponse)
@limiter.limit("5/minute")
def login(request: Request, payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = auth_service.get_user_by_email(db, payload.email)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No account found with that email — sign up first")

    # A password-less account only exists via Google sign-in — there's no
    # password to compare against, so point them at the flow that actually
    # works instead of a generic "incorrect password".
    if not user.password_hash:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This account signs in with Google — use that instead")

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect password")

    _set_session_cookie(response, user)
    return _to_me_response(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    response.delete_cookie(SESSION_COOKIE_NAME)


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: ChangePasswordRequest,
    response: Response,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # A password-less account (signed up via Google only) has nothing to
    # verify against — anyone else does, including a temp password from an
    # admin-created account.
    if user.password_hash and not (
        payload.current_password and verify_password(payload.current_password, user.password_hash)
    ):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")

    user.password_hash = hash_password(payload.new_password)
    # Same session-invalidation as reset-password, but this path *is*
    # authenticated — reissue the caller's own cookie with the bumped
    # version so they aren't logged out of the request they just made,
    # while every other outstanding session for the account still dies.
    user.session_version += 1
    db.commit()
    _set_session_cookie(response, user)


DEV_ADMIN_EMAIL = "dev-admin@mut-tech.local"


@router.post("/dev-login", response_model=MeResponse)
def dev_login(response: Response, db: Session = Depends(get_db)):
    """Dev-only shortcut: signs in as a dummy admin account (creating it on
    first use, with an active membership), so local development never needs
    real Google/GitHub OAuth or a manual make-admin round trip just to reach
    the admin views. Hard-gated to ENVIRONMENT=development — 404s (not 403)
    everywhere else, so it doesn't even advertise the route exists if this
    were ever reached somewhere misconfigured."""
    if settings.environment != "development":
        raise HTTPException(status.HTTP_404_NOT_FOUND)

    user = auth_service.get_user_by_email(db, DEV_ADMIN_EMAIL)
    if not user:
        user = auth_service.create_user(db, DEV_ADMIN_EMAIL, password=None)
        user.profile.display_name = "Dev Admin"
        user.email_verified = True

    user.is_admin = True
    if user.membership.status != MembershipStatus.active:
        user.membership.status = MembershipStatus.active
        # Naive local date, not a tz-aware datetime — see membership.py's
        # _activate_membership(), which this mirrors for the dummy account.
        user.membership.period_start = date.today()  # noqa: DTZ011
        user.membership.period_end = date.today() + timedelta(days=365)  # noqa: DTZ011
    db.commit()

    _set_session_cookie(response, user)
    return _to_me_response(user)


@router.get("/me", response_model=MeResponse)
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    membership_service.sync_expiry(db, user.membership)
    return _to_me_response(user)


@router.get("/google/start")
def google_start(response: Response, next: str | None = None):
    if not settings.google_client_id:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Google sign-in is not configured yet")

    state = secrets.token_urlsafe(24)
    response = RedirectResponse(
        f"{GOOGLE_AUTH_URL}?"
        + urlencode(
            {
                "client_id": settings.google_client_id,
                "redirect_uri": settings.google_redirect_uri,
                "response_type": "code",
                "scope": "openid email profile",
                "state": state,
                "access_type": "online",
                "prompt": "select_account",
            }
        )
    )
    response.set_cookie(OAUTH_STATE_COOKIE, state, httponly=True, samesite="lax", max_age=600)
    safe_next = _safe_next(next)
    if safe_next:
        # Round-tripped through the callback so an existing member who
        # started Google sign-in from, say, an event registration page
        # lands back there instead of on the dashboard — see google_callback.
        response.set_cookie(OAUTH_NEXT_COOKIE, safe_next, httponly=True, samesite="lax", max_age=600)
    return response


@router.get("/google/callback")
def google_callback(
    code: str,
    state: str,
    oauth_state: str | None = Cookie(default=None, alias=OAUTH_STATE_COOKIE),
    oauth_next: str | None = Cookie(default=None, alias=OAUTH_NEXT_COOKIE),
    db: Session = Depends(get_db),
):
    if not oauth_state or oauth_state != state:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid OAuth state")

    with httpx.Client(timeout=10) as client:
        token_res = client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": settings.google_redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        token_res.raise_for_status()
        access_token = token_res.json()["access_token"]

        userinfo_res = client.get(GOOGLE_USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"})
        userinfo_res.raise_for_status()
        info = userinfo_res.json()

    google_sub = info["sub"]
    email = info["email"]
    picture = info.get("picture")

    user = auth_service.get_user_by_google_sub(db, google_sub)
    if not user:
        user = auth_service.get_user_by_email(db, email)
        if user:
            user.google_sub = google_sub
            user.email_verified = True
            # Only backfill — never clobber a photo the member already set
            # themselves (upload or a prior Google link) with this login's.
            if user.profile and not user.profile.photo_url:
                user.profile.photo_url = picture
            db.commit()
        else:
            user = auth_service.create_user(db, email, password=None, google_sub=google_sub, photo_url=picture)

    if _is_onboarded(user):
        # New signups always go through onboarding regardless of `next` —
        # only an already-onboarded member returning mid-flow gets bounced
        # back to wherever they started (e.g. an event registration page).
        destination = _safe_next(oauth_next) or "/dashboard"
    else:
        destination = "/onboarding"
    redirect = RedirectResponse(f"{settings.web_origin}{destination}")
    _set_session_cookie(redirect, user)
    redirect.delete_cookie(OAUTH_STATE_COOKIE)
    redirect.delete_cookie(OAUTH_NEXT_COOKIE)
    return redirect


@router.get("/github/start")
def github_start(user: User = Depends(get_current_user)):
    """Account-linking, not sign-in — requires an existing session, unlike
    the Google flow which creates one."""
    if not settings.github_client_id:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "GitHub connect is not configured yet")

    state = secrets.token_urlsafe(24)
    response = RedirectResponse(
        f"{GITHUB_AUTH_URL}?"
        + urlencode(
            {
                "client_id": settings.github_client_id,
                "redirect_uri": settings.github_redirect_uri,
                "scope": "read:user",
                "state": state,
            }
        )
    )
    response.set_cookie(OAUTH_STATE_COOKIE, state, httponly=True, samesite="lax", max_age=600)
    return response


@router.get("/github/callback")
def github_callback(
    code: str,
    state: str,
    user: User = Depends(get_current_user),
    oauth_state: str | None = Cookie(default=None, alias=OAUTH_STATE_COOKIE),
    db: Session = Depends(get_db),
):
    if not oauth_state or oauth_state != state:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid OAuth state")

    with httpx.Client(timeout=10) as client:
        token_res = client.post(
            GITHUB_TOKEN_URL,
            data={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": code,
                "redirect_uri": settings.github_redirect_uri,
            },
            headers={"Accept": "application/json"},
        )
        token_res.raise_for_status()
        token_body = token_res.json()
        if "access_token" not in token_body:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, token_body.get("error_description", "GitHub link failed"))

        user_res = client.get(
            GITHUB_USER_URL, headers={"Authorization": f"Bearer {token_body['access_token']}"}
        )
        user_res.raise_for_status()
        info = user_res.json()

    existing = auth_service.get_user_by_github_id(db, info["id"])
    if existing and existing.id != user.id:
        raise HTTPException(status.HTTP_409_CONFLICT, "This GitHub account is already linked to another user")

    user.github_id = info["id"]
    user.github_login = info["login"]
    db.commit()
    github_service.maybe_invite_to_org(db, user)

    redirect = RedirectResponse(f"{settings.web_origin}/github")
    redirect.delete_cookie(OAUTH_STATE_COOKIE)
    return redirect


@router.get("/github/status", response_model=GithubStatus)
def github_status(user: User = Depends(get_current_user)):
    return GithubStatus(
        linked=user.github_id is not None,
        login=user.github_login,
        invite_status=user.github_org_invite_status.value,
    )


@router.post("/github/revoke", status_code=status.HTTP_204_NO_CONTENT)
def github_revoke(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.github_id = None
    user.github_login = None
    db.commit()


def _is_onboarded(user: User) -> bool:
    # Admins skip onboarding entirely, however their account was created —
    # covers the bootstrap admin (granted by DB migration, never onboarded)
    # as much as one made admin later from the members/roles UI.
    return user.is_admin or bool(user.profile and user.profile.onboarded)


def _to_me_response(user: User) -> MeResponse:
    return MeResponse(
        id=user.id,
        email=user.email,
        email_verified=user.email_verified,
        is_admin=user.is_admin,
        is_staff=user.is_staff,
        photo_url=user.profile.photo_url if user.profile else None,
        membership_status=user.membership.status.value if user.membership else "none",
        onboarded=_is_onboarded(user),
    )
