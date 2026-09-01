import re

import pytest

pytestmark = pytest.mark.integration


def _extract_token(html: str) -> str:
    match = re.search(r"reset-password\?token=([^\"&\s]+)", html)
    assert match, html
    return match.group(1)


def test_forgot_password_sends_reset_link(client, make_user, mock_email):
    make_user(email="member@example.com", password="pw12345678")

    res = client.post("/auth/forgot-password", json={"email": "member@example.com"})
    assert res.status_code == 204
    assert len(mock_email) == 1
    assert mock_email[0]["to"] == "member@example.com"
    assert "reset-password?token=" in mock_email[0]["html"]


def test_forgot_password_on_unknown_email_still_204_and_sends_nothing(client, mock_email):
    # No account-enumeration oracle: same response either way, no email sent
    # when there's nobody to send it to.
    res = client.post("/auth/forgot-password", json={"email": "nobody@example.com"})
    assert res.status_code == 204
    assert len(mock_email) == 0


def test_reset_password_with_valid_token_works(client, db_session, make_user, mock_email):
    user = make_user(email="member@example.com", password="pw12345678")
    client.post("/auth/forgot-password", json={"email": "member@example.com"})
    token = _extract_token(mock_email[0]["html"])

    res = client.post("/auth/reset-password", json={"token": token, "new_password": "brandnewpassword1"})
    assert res.status_code == 204

    from app.core.security import verify_password

    db_session.refresh(user)
    assert verify_password("brandnewpassword1", user.password_hash) is True

    login_res = client.post("/auth/login", json={"email": "member@example.com", "password": "brandnewpassword1"})
    assert login_res.status_code == 200


def test_reset_password_token_is_single_use(client, make_user, mock_email):
    make_user(email="member@example.com", password="pw12345678")
    client.post("/auth/forgot-password", json={"email": "member@example.com"})
    token = _extract_token(mock_email[0]["html"])

    first = client.post("/auth/reset-password", json={"token": token, "new_password": "brandnewpassword1"})
    assert first.status_code == 204

    replay = client.post("/auth/reset-password", json={"token": token, "new_password": "anotherpassword2"})
    assert replay.status_code == 400


def test_reset_password_rejects_garbage_token(client):
    res = client.post("/auth/reset-password", json={"token": "not-a-real-token", "new_password": "pw12345678"})
    assert res.status_code == 400


def test_reset_password_invalidates_existing_sessions(client, make_user, login_as, mock_email):
    from fastapi.testclient import TestClient

    from app.main import app

    user = make_user(email="member@example.com", password="pw12345678")
    login_as(user)
    assert client.get("/auth/me").status_code == 200

    other_client = TestClient(app)
    other_client.cookies.set("session", client.cookies["session"])

    client.post("/auth/forgot-password", json={"email": "member@example.com"})
    token = _extract_token(mock_email[0]["html"])
    res = client.post("/auth/reset-password", json={"token": token, "new_password": "brandnewpassword1"})
    assert res.status_code == 204

    # reset-password isn't authenticated, so it never reissues a cookie for
    # `client` either — every session for the account, old or "current",
    # dies, and both have to sign in again with the new password.
    assert client.get("/auth/me").status_code == 401
    assert other_client.get("/auth/me").status_code == 401
