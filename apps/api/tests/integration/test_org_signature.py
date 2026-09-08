import pytest

from app.models.audit_log import AuditLog
from app.models.membership import MembershipStatus
from app.models.org_signature import OrgSignature
from app.models.tag import Tag
from app.services.tags import assign_tag, create_tag

pytestmark = pytest.mark.integration

# A tiny (2x2, transparent) real PNG, base64-encoded — enough to exercise the
# PNG-signature check and a real encrypt/decrypt round trip.
TINY_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAC0lEQVR4nGNgQAcAABIAAXfx+gAAAAAASUVORK5CYII="
)


def _make_chairperson(db_session, make_user, tag_name="Chairperson"):
    user = make_user(membership_status=MembershipStatus.active)
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    tag = db_session.query(Tag).filter(Tag.name.ilike(tag_name)).first()
    if not tag:
        tag = create_tag(db_session, admin, tag_name)
    assign_tag(db_session, admin, user, tag)
    return user


def test_org_signature_routes_reject_unauthenticated(client):
    assert client.get("/org-signature").status_code == 401
    assert client.put("/org-signature", json={"image_base64": TINY_PNG_B64}).status_code == 401


def test_org_signature_routes_reject_non_chairperson(client, make_user, login_as):
    user = make_user(membership_status=MembershipStatus.active)
    login_as(user)

    assert client.get("/org-signature").status_code == 403
    assert client.put("/org-signature", json={"image_base64": TINY_PNG_B64}).status_code == 403
    assert client.get("/org-signature/image").status_code == 403
    assert client.delete("/org-signature").status_code == 403


def test_chairperson_tag_matched_case_insensitively(client, db_session, make_user, login_as):
    user = _make_chairperson(db_session, make_user, tag_name="chairperson")
    login_as(user)

    res = client.get("/org-signature")
    assert res.status_code == 200
    assert res.json() == {"has_signature": False, "updated_at": None}


def test_admin_can_access_without_the_tag(client, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)

    assert client.get("/org-signature").status_code == 200


def test_chairperson_can_save_and_fetch_org_signature(client, db_session, make_user, login_as):
    user = _make_chairperson(db_session, make_user)
    login_as(user)

    res = client.put("/org-signature", json={"image_base64": TINY_PNG_B64})
    assert res.status_code == 200
    body = res.json()
    assert body["has_signature"] is True
    assert body["updated_at"] is not None

    # stored encrypted at rest, and tracks who last updated it
    row = db_session.query(OrgSignature).first()
    assert row is not None
    assert row.ciphertext != TINY_PNG_B64.encode()
    assert row.updated_by_id == user.id

    res = client.get("/org-signature/image")
    assert res.status_code == 200
    assert res.json()["image_base64"] == TINY_PNG_B64

    assert (
        db_session.query(AuditLog).filter(AuditLog.actor_id == user.id, AuditLog.kind == "settings").count() == 1
    )


def test_org_signature_is_shared_across_chairpersons(client, db_session, make_user, login_as):
    """It belongs to the org, not to whoever captured it — a later
    chairperson should see the same signature, and replacing it re-attributes
    updated_by_id without creating a second row."""
    first = _make_chairperson(db_session, make_user)
    login_as(first)
    client.put("/org-signature", json={"image_base64": TINY_PNG_B64})

    second = _make_chairperson(db_session, make_user)
    login_as(second)

    res = client.get("/org-signature/image")
    assert res.status_code == 200
    assert res.json()["image_base64"] == TINY_PNG_B64

    client.put("/org-signature", json={"image_base64": TINY_PNG_B64})
    assert db_session.query(OrgSignature).count() == 1
    row = db_session.query(OrgSignature).first()
    assert row.updated_by_id == second.id


def test_delete_org_signature(client, db_session, make_user, login_as):
    user = _make_chairperson(db_session, make_user)
    login_as(user)

    client.put("/org-signature", json={"image_base64": TINY_PNG_B64})
    res = client.delete("/org-signature")
    assert res.status_code == 204

    assert db_session.query(OrgSignature).count() == 0
    assert client.get("/org-signature").json()["has_signature"] is False


def test_rejects_non_png_payload(client, db_session, make_user, login_as):
    user = _make_chairperson(db_session, make_user)
    login_as(user)

    res = client.put("/org-signature", json={"image_base64": "not-a-real-image"})
    assert res.status_code == 400
