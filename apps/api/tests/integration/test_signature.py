import pytest

from app.models.membership import MembershipStatus
from app.models.signature import Signature

pytestmark = pytest.mark.integration

# A tiny (2x2, transparent) real PNG, base64-encoded — enough to exercise the
# PNG-signature check and a real encrypt/decrypt round trip.
TINY_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAC0lEQVR4nGNgQAcAABIAAXfx+gAAAAAASUVORK5CYII="
)


def test_signature_routes_reject_unauthenticated(client):
    assert client.get("/profile/me/signature").status_code == 401
    assert client.put("/profile/me/signature", json={"image_base64": TINY_PNG_B64}).status_code == 401


def test_no_signature_by_default(client, make_user, login_as):
    user = make_user(membership_status=MembershipStatus.active)
    login_as(user)

    res = client.get("/profile/me/signature")
    assert res.status_code == 200
    assert res.json() == {"has_signature": False, "updated_at": None}

    res = client.get("/profile/me/signature/image")
    assert res.status_code == 404


def test_save_and_fetch_signature(client, db_session, make_user, login_as):
    user = make_user(membership_status=MembershipStatus.active)
    login_as(user)

    res = client.put("/profile/me/signature", json={"image_base64": TINY_PNG_B64})
    assert res.status_code == 200
    body = res.json()
    assert body["has_signature"] is True
    assert body["updated_at"] is not None

    # stored encrypted at rest, not as the plaintext PNG bytes
    row = db_session.get(Signature, user.id)
    assert row is not None
    assert row.ciphertext != TINY_PNG_B64.encode()

    res = client.get("/profile/me/signature")
    assert res.status_code == 200
    assert res.json()["has_signature"] is True

    res = client.get("/profile/me/signature/image")
    assert res.status_code == 200
    assert res.json()["image_base64"] == TINY_PNG_B64


def test_data_url_prefix_accepted(client, make_user, login_as):
    user = make_user(membership_status=MembershipStatus.active)
    login_as(user)

    res = client.put(
        "/profile/me/signature", json={"image_base64": f"data:image/png;base64,{TINY_PNG_B64}"}
    )
    assert res.status_code == 200

    res = client.get("/profile/me/signature/image")
    assert res.json()["image_base64"] == TINY_PNG_B64


def test_re_saving_replaces_existing_signature(client, db_session, make_user, login_as):
    user = make_user(membership_status=MembershipStatus.active)
    login_as(user)

    client.put("/profile/me/signature", json={"image_base64": TINY_PNG_B64})
    assert db_session.query(Signature).filter(Signature.user_id == user.id).count() == 1

    client.put("/profile/me/signature", json={"image_base64": TINY_PNG_B64})
    assert db_session.query(Signature).filter(Signature.user_id == user.id).count() == 1


def test_rejects_non_png_payload(client, make_user, login_as):
    user = make_user(membership_status=MembershipStatus.active)
    login_as(user)

    res = client.put("/profile/me/signature", json={"image_base64": "not-a-real-image"})
    assert res.status_code == 400


def test_rejects_invalid_base64(client, make_user, login_as):
    user = make_user(membership_status=MembershipStatus.active)
    login_as(user)

    res = client.put("/profile/me/signature", json={"image_base64": "!!!not-base64!!!"})
    assert res.status_code == 400


def test_delete_signature(client, db_session, make_user, login_as):
    user = make_user(membership_status=MembershipStatus.active)
    login_as(user)

    client.put("/profile/me/signature", json={"image_base64": TINY_PNG_B64})
    res = client.delete("/profile/me/signature")
    assert res.status_code == 204

    assert db_session.query(Signature).filter(Signature.user_id == user.id).count() == 0
    res = client.get("/profile/me/signature")
    assert res.json()["has_signature"] is False


def test_delete_signature_is_a_noop_when_none_exists(client, make_user, login_as):
    user = make_user(membership_status=MembershipStatus.active)
    login_as(user)

    res = client.delete("/profile/me/signature")
    assert res.status_code == 204


def test_one_users_signature_is_not_another_users(client, db_session, make_user, login_as):
    user_a = make_user(email="a@example.com", membership_status=MembershipStatus.active)
    user_b = make_user(email="b@example.com", membership_status=MembershipStatus.active)

    login_as(user_a)
    client.put("/profile/me/signature", json={"image_base64": TINY_PNG_B64})

    login_as(user_b)
    res = client.get("/profile/me/signature")
    assert res.json()["has_signature"] is False
    assert client.get("/profile/me/signature/image").status_code == 404
