import httpx
import pytest
import respx

from app.routers import auth as auth_router

pytestmark = pytest.mark.integration


@pytest.fixture
def mock_google_config(monkeypatch):
    monkeypatch.setattr(auth_router.settings, "google_client_id", "test-client-id")
    monkeypatch.setattr(auth_router.settings, "google_client_secret", "test-client-secret")
    monkeypatch.setattr(auth_router.settings, "google_redirect_uri", "http://testserver/auth/google/callback")


def _mock_token_exchange(m, *, sub, email):
    m.post(auth_router.GOOGLE_TOKEN_URL).mock(return_value=httpx.Response(200, json={"access_token": "test-token"}))
    m.get(auth_router.GOOGLE_USERINFO_URL).mock(return_value=httpx.Response(200, json={"sub": sub, "email": email}))


def test_google_start_sets_next_cookie_for_safe_path(client, mock_google_config):
    res = client.get("/auth/google/start", params={"next": "/events/demo-day"}, follow_redirects=False)
    # httpx.Cookies doesn't unquote a cookie value containing "/" — the
    # server-side Cookie() dependency does, which the callback tests below
    # verify end-to-end.
    assert res.cookies.get("oauth_next", "").strip('"') == "/events/demo-day"


@pytest.mark.parametrize("unsafe", ["//evil.com", "/\\evil.com", "https://evil.com"])
def test_google_start_ignores_unsafe_next(client, mock_google_config, unsafe):
    res = client.get("/auth/google/start", params={"next": unsafe}, follow_redirects=False)
    assert "oauth_next" not in res.cookies


def test_google_start_with_no_next_sets_no_cookie(client, mock_google_config):
    res = client.get("/auth/google/start", follow_redirects=False)
    assert "oauth_next" not in res.cookies


def test_google_callback_sends_onboarded_member_back_to_next(client, db_session, make_user, mock_google_config):
    """The actual bug this fixes: a member whose session lapsed mid-visit
    (say, on an event registration page) signs back in with Google and
    should land back where they were instead of on the dashboard."""
    user = make_user(email="member@example.com")
    user.google_sub = "google-sub-42"
    user.profile.onboarded = True
    db_session.commit()

    start_res = client.get("/auth/google/start", params={"next": "/events/demo-day"}, follow_redirects=False)
    state = start_res.cookies.get("oauth_state")

    with respx.mock(assert_all_called=False) as m:
        _mock_token_exchange(m, sub="google-sub-42", email="member@example.com")
        callback_res = client.get(
            "/auth/google/callback", params={"code": "abc", "state": state}, follow_redirects=False
        )

    assert callback_res.headers["location"] == "http://testserver/events/demo-day"
    assert "oauth_next" not in callback_res.cookies or callback_res.cookies.get("oauth_next") == ""


def test_google_callback_ignores_next_for_brand_new_signup(client, mock_google_config):
    """New signups always go through onboarding first — `next` only applies
    once someone is already an onboarded member."""
    start_res = client.get("/auth/google/start", params={"next": "/events/demo-day"}, follow_redirects=False)
    state = start_res.cookies.get("oauth_state")

    with respx.mock(assert_all_called=False) as m:
        _mock_token_exchange(m, sub="google-sub-new", email="brandnew@example.com")
        callback_res = client.get(
            "/auth/google/callback", params={"code": "abc", "state": state}, follow_redirects=False
        )

    assert callback_res.headers["location"] == "http://testserver/onboarding"


def test_google_callback_falls_back_to_dashboard_without_next(client, db_session, make_user, mock_google_config):
    user = make_user(email="member2@example.com")
    user.google_sub = "google-sub-99"
    user.profile.onboarded = True
    db_session.commit()

    start_res = client.get("/auth/google/start", follow_redirects=False)
    state = start_res.cookies.get("oauth_state")

    with respx.mock(assert_all_called=False) as m:
        _mock_token_exchange(m, sub="google-sub-99", email="member2@example.com")
        callback_res = client.get(
            "/auth/google/callback", params={"code": "abc", "state": state}, follow_redirects=False
        )

    assert callback_res.headers["location"] == "http://testserver/dashboard"
