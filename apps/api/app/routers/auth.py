import secrets
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
    create_session_token,
    verify_password,
)
from app.models.user import User
from app.schemas.auth import LoginRequest, MeResponse, SignupRequest
from app.schemas.github import GithubStatus
from app.services import auth as auth_service
from app.services import github as github_service
from app.services import membership as membership_service

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_USER_URL = "https://api.github.com/user"
OAUTH_STATE_COOKIE = "oauth_state"


def _set_session_cookie(response: Response, user_id: str) -> None:
    token = create_session_token(str(user_id))
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.environment != "development",
        samesite="lax",
        max_age=int(SESSION_TTL.total_seconds()),
    )


@router.post("/signup", response_model=MeResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/hour")
def signup(request: Request, payload: SignupRequest, response: Response, db: Session = Depends(get_db)):
    if auth_service.get_user_by_email(db, payload.email):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")

    user = auth_service.create_user(db, payload.email, payload.password)
    _set_session_cookie(response, str(user.id))
    return _to_me_response(user)


@router.post("/login", response_model=MeResponse)
@limiter.limit("5/minute")
def login(request: Request, payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = auth_service.get_user_by_email(db, payload.email)
    if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")

    _set_session_cookie(response, str(user.id))
    return _to_me_response(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    response.delete_cookie(SESSION_COOKIE_NAME)


@router.get("/me", response_model=MeResponse)
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    membership_service.sync_expiry(db, user.membership)
    return _to_me_response(user)


@router.get("/google/start")
def google_start(response: Response):
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
    return response


@router.get("/google/callback")
def google_callback(
    code: str,
    state: str,
    oauth_state: str | None = Cookie(default=None, alias=OAUTH_STATE_COOKIE),
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

    user = auth_service.get_user_by_google_sub(db, google_sub)
    if not user:
        user = auth_service.get_user_by_email(db, email)
        if user:
            user.google_sub = google_sub
            user.email_verified = True
            db.commit()
        else:
            user = auth_service.create_user(db, email, password=None, google_sub=google_sub)

    redirect = RedirectResponse(f"{settings.web_origin}/onboarding")
    _set_session_cookie(redirect, str(user.id))
    redirect.delete_cookie(OAUTH_STATE_COOKIE)
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


def _to_me_response(user: User) -> MeResponse:
    return MeResponse(
        id=user.id,
        email=user.email,
        email_verified=user.email_verified,
        is_admin=user.is_admin,
        membership_status=user.membership.status.value if user.membership else "none",
    )
