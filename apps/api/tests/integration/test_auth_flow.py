import pytest

pytestmark = pytest.mark.integration


def test_signup_creates_account(client, db_session):
    res = client.post("/auth/signup", json={"email": "new@example.com", "password": "pw12345678"})
    assert res.status_code == 201
    body = res.json()
    assert body["email"] == "new@example.com"
    assert body["membership_status"] == "none"
    assert "session" in res.cookies

    from app.models.membership import Membership
    from app.models.profile import Profile
    from app.models.user import User

    user = db_session.query(User).filter(User.email == "new@example.com").first()
    assert user is not None
    assert db_session.query(Profile).filter(Profile.user_id == user.id).first() is not None
    assert db_session.query(Membership).filter(Membership.user_id == user.id).first() is not None


def test_signup_rejects_duplicate_email(client, make_user):
    make_user(email="taken@example.com")
    res = client.post("/auth/signup", json={"email": "taken@example.com", "password": "pw12345678"})
    assert res.status_code == 409


def test_signup_rejects_short_password(client):
    res = client.post("/auth/signup", json={"email": "short@example.com", "password": "short"})
    assert res.status_code == 422


def test_login_success(client, make_user):
    make_user(email="member@example.com", password="pw12345678")
    res = client.post("/auth/login", json={"email": "member@example.com", "password": "pw12345678"})
    assert res.status_code == 200
    assert "session" in res.cookies


def test_login_wrong_password(client, make_user):
    make_user(email="member@example.com", password="pw12345678")
    res = client.post("/auth/login", json={"email": "member@example.com", "password": "wrong"})
    assert res.status_code == 401


def test_change_password_requires_current_password(client, make_user, login_as):
    user = make_user(email="member@example.com", password="pw12345678")
    login_as(user)
    res = client.post("/auth/change-password", json={"new_password": "brandnewpassword1"})
    assert res.status_code == 400


def test_change_password_rejects_wrong_current_password(client, make_user, login_as):
    user = make_user(email="member@example.com", password="pw12345678")
    login_as(user)
    res = client.post(
        "/auth/change-password", json={"current_password": "wrong", "new_password": "brandnewpassword1"}
    )
    assert res.status_code == 400


def test_change_password_succeeds_and_new_password_works(client, db_session, make_user, login_as):
    user = make_user(email="member@example.com", password="pw12345678")
    login_as(user)
    res = client.post(
        "/auth/change-password", json={"current_password": "pw12345678", "new_password": "brandnewpassword1"}
    )
    assert res.status_code == 204

    from app.core.security import verify_password

    db_session.refresh(user)
    assert verify_password("brandnewpassword1", user.password_hash) is True

    logout_res = client.post("/auth/logout")
    assert logout_res.status_code == 204
    login_res = client.post("/auth/login", json={"email": "member@example.com", "password": "brandnewpassword1"})
    assert login_res.status_code == 200


def test_change_password_invalidates_other_sessions_but_not_this_one(client, make_user, login_as):
    # A second, independent client holding an older cookie for the same
    # account — stands in for e.g. a stolen session the password change is
    # meant to kick out.
    from fastapi.testclient import TestClient

    from app.main import app

    user = make_user(email="member@example.com", password="pw12345678")
    login_as(user)
    other_client = TestClient(app)
    other_client.cookies.set("session", client.cookies["session"])
    assert other_client.get("/auth/me").status_code == 200

    res = client.post(
        "/auth/change-password", json={"current_password": "pw12345678", "new_password": "brandnewpassword1"}
    )
    assert res.status_code == 204

    # The client that made the change keeps working (its cookie was reissued)...
    assert client.get("/auth/me").status_code == 200
    # ...but the other one, still holding the pre-change cookie, is logged out.
    assert other_client.get("/auth/me").status_code == 401


def test_change_password_on_google_only_account_needs_no_current_password(client, db_session):
    # A Google-only account has no password_hash, so it can't sign in through
    # /auth/login — set the session cookie directly, the same way the real
    # Google OAuth callback would.
    from app.core.security import SESSION_COOKIE_NAME, create_session_token
    from app.services.auth import create_user

    user = create_user(db_session, "googleuser@example.com", password=None, google_sub="google-sub-123")
    client.cookies.set(SESSION_COOKIE_NAME, create_session_token(str(user.id), user.session_version))

    res = client.post("/auth/change-password", json={"new_password": "brandnewpassword1"})
    assert res.status_code == 204


def test_login_nonexistent_email(client):
    res = client.post("/auth/login", json={"email": "nobody@example.com", "password": "whatever1"})
    assert res.status_code == 401


def test_login_google_only_account_returns_401_not_500(client, db_session):
    from app.services.auth import create_user

    create_user(db_session, "google-only@example.com", password=None, google_sub="google-sub-123")
    db_session.commit()

    res = client.post("/auth/login", json={"email": "google-only@example.com", "password": "anything1"})
    assert res.status_code == 401


def test_me_without_cookie(client):
    res = client.get("/auth/me")
    assert res.status_code == 401


def test_me_with_valid_cookie(client, make_user, login_as):
    user = make_user(email="member@example.com")
    login_as(user)
    res = client.get("/auth/me")
    assert res.status_code == 200
    assert res.json()["email"] == "member@example.com"


def test_logout_clears_session(client, make_user, login_as):
    user = make_user(email="member@example.com")
    login_as(user)
    assert client.get("/auth/me").status_code == 200

    res = client.post("/auth/logout")
    assert res.status_code == 204
    assert client.get("/auth/me").status_code == 401


def test_login_rate_limited_after_five_attempts(client, make_user):
    make_user(email="member@example.com", password="pw12345678")

    for _ in range(5):
        res = client.post("/auth/login", json={"email": "member@example.com", "password": "wrong"})
        assert res.status_code == 401

    res = client.post("/auth/login", json={"email": "member@example.com", "password": "wrong"})
    assert res.status_code == 429


def test_signup_rate_limited_after_five_attempts(client):
    for i in range(5):
        res = client.post("/auth/signup", json={"email": f"burst{i}@example.com", "password": "pw12345678"})
        assert res.status_code == 201

    res = client.post("/auth/signup", json={"email": "burst-sixth@example.com", "password": "pw12345678"})
    assert res.status_code == 429


# ── dev-login ────────────────────────────────────────────────────────────


def test_dev_login_creates_active_admin_and_signs_in(client, db_session):
    res = client.post("/auth/dev-login")
    assert res.status_code == 200
    body = res.json()
    assert body["is_admin"] is True
    assert body["membership_status"] == "active"
    assert "session" in res.cookies

    from app.models.user import User

    user = db_session.query(User).filter(User.email == "dev-admin@mut-tech.local").first()
    assert user is not None
    assert user.password_hash is None  # can't be logged into via the normal password form


def test_dev_login_is_idempotent(client, db_session):
    client.post("/auth/dev-login")
    res = client.post("/auth/dev-login")
    assert res.status_code == 200

    from app.models.user import User

    assert db_session.query(User).filter(User.email == "dev-admin@mut-tech.local").count() == 1


def test_dev_login_404s_outside_development(client, monkeypatch):
    from app.routers import auth as auth_router

    monkeypatch.setattr(auth_router.settings, "environment", "production")
    res = client.post("/auth/dev-login")
    assert res.status_code == 404


# ── email verification ─────────────────────────────────────────────────


def test_signup_sends_a_verification_email(client, db_session, mock_email):
    res = client.post("/auth/signup", json={"email": "verify-me@example.com", "password": "pw12345678"})
    assert res.status_code == 201
    assert res.json()["email_verified"] is False

    assert len(mock_email) == 1
    assert mock_email[0]["to"] == "verify-me@example.com"
    assert "token=" in mock_email[0]["html"]


def test_verify_email_with_valid_token_marks_verified(client, db_session, mock_email):
    client.post("/auth/signup", json={"email": "verify-me@example.com", "password": "pw12345678"})
    token = mock_email[0]["html"].split("token=")[1].split('"')[0]

    res = client.get(f"/auth/verify-email?token={token}", follow_redirects=False)
    assert res.status_code in (302, 307)
    assert res.headers["location"] == "http://testserver/verify-email?status=success"

    from app.models.user import User

    user = db_session.query(User).filter(User.email == "verify-me@example.com").first()
    assert user.email_verified is True


def test_verify_email_with_garbage_token_redirects_invalid(client):
    res = client.get("/auth/verify-email?token=not-a-real-token", follow_redirects=False)
    assert res.headers["location"] == "http://testserver/verify-email?status=invalid"


def test_verify_email_token_cannot_be_a_session_token(client, make_user):
    # The two token types share a signing key and algorithm — the "purpose"
    # claim is the only thing stopping a session token from doubling as a
    # verification link (or vice versa). Prove that guard actually holds.
    from app.core.security import create_session_token

    user = make_user()
    session_token = create_session_token(str(user.id), user.session_version)

    res = client.get(f"/auth/verify-email?token={session_token}", follow_redirects=False)
    assert res.headers["location"] == "http://testserver/verify-email?status=invalid"


def test_resend_verification_email(client, make_user, login_as, mock_email):
    user = make_user(email_verified=False)
    login_as(user)

    res = client.post("/auth/send-verification-email")
    assert res.status_code == 204
    assert len(mock_email) == 1
    assert mock_email[0]["to"] == user.email


def test_resend_verification_email_noops_if_already_verified(client, make_user, login_as, mock_email):
    user = make_user(email_verified=True)
    login_as(user)

    res = client.post("/auth/send-verification-email")
    assert res.status_code == 204
    assert mock_email == []
