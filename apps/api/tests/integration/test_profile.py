import pytest

pytestmark = pytest.mark.integration


def _onboarding_payload(**overrides):
    payload = {
        "first_name": "Jane",
        "last_name": "Doe",
        "display_name": "Jane",
        "registration_number": None,
        "phone": None,
        "course": None,
        "year_of_study": None,
        "interests": [],
        "experience_level": None,
        "goals": [],
        "bio": None,
        "github_url": None,
        "linkedin_url": None,
        "visibility": "public",
    }
    payload.update(overrides)
    return payload


def test_onboarding_saves_phone_number(client, make_user, login_as):
    user = make_user()
    login_as(user)

    res = client.patch("/profile/me", json=_onboarding_payload(phone="0712345678"))
    assert res.status_code == 200
    assert res.json()["phone"] == "0712345678"


def test_get_profile_returns_saved_phone(client, make_user, login_as):
    user = make_user()
    login_as(user)
    client.patch("/profile/me", json=_onboarding_payload(phone="0712345678"))

    res = client.get("/profile/me")
    assert res.status_code == 200
    assert res.json()["phone"] == "0712345678"


def test_onboarding_phone_is_optional(client, make_user, login_as):
    user = make_user()
    login_as(user)

    res = client.patch("/profile/me", json=_onboarding_payload(phone=None))
    assert res.status_code == 200
    assert res.json()["phone"] is None
