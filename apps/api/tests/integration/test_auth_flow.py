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
