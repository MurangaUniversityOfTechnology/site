import pytest

from app.models.audit_log import AuditLog
from app.models.membership import MembershipStatus

pytestmark = pytest.mark.integration


def _make_tag(client, name="Dean"):
    res = client.post("/admin/tags", json={"name": name})
    assert res.status_code == 201
    return res.json()


def test_tag_routes_reject_non_admin(client, make_user, login_as):
    user = make_user(membership_status=MembershipStatus.active)
    login_as(user)
    assert client.get("/admin/tags").status_code == 403
    assert client.post("/admin/tags", json={"name": "Guest"}).status_code == 403


def test_tag_routes_reject_unauthenticated(client):
    assert client.get("/admin/tags").status_code == 401
    assert client.post("/admin/tags", json={"name": "Guest"}).status_code == 401


def test_create_and_list_tags(client, make_user, login_as, db_session):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)

    tag = _make_tag(client, "Dean")
    assert tag["name"] == "Dean"

    res = client.get("/admin/tags")
    assert res.status_code == 200
    names = [t["name"] for t in res.json()]
    assert names == ["Dean"]

    assert db_session.query(AuditLog).filter(AuditLog.actor_id == admin.id, AuditLog.kind == "tags").count() == 1


def test_create_tag_rejects_duplicate_case_insensitive(client, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)

    _make_tag(client, "Chairperson")
    res = client.post("/admin/tags", json={"name": "chairperson"})
    assert res.status_code == 400


def test_create_tag_rejects_blank_name(client, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)

    res = client.post("/admin/tags", json={"name": "   "})
    assert res.status_code == 400


def test_rename_tag(client, make_user, login_as, db_session):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)

    tag = _make_tag(client, "Treasurer")
    res = client.patch(f"/admin/tags/{tag['id']}", json={"name": "Finance Lead"})
    assert res.status_code == 200
    assert res.json()["name"] == "Finance Lead"


def test_rename_tag_rejects_duplicate(client, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)

    _make_tag(client, "Secretary")
    tag2 = _make_tag(client, "Guest")
    res = client.patch(f"/admin/tags/{tag2['id']}", json={"name": "secretary"})
    assert res.status_code == 400


def test_rename_missing_tag_404(client, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)

    res = client.patch("/admin/tags/00000000-0000-0000-0000-000000000000", json={"name": "X"})
    assert res.status_code == 404


def test_delete_tag(client, make_user, login_as, db_session):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)

    tag = _make_tag(client, "Guest")
    res = client.delete(f"/admin/tags/{tag['id']}")
    assert res.status_code == 204

    res = client.get("/admin/tags")
    assert res.json() == []


def test_delete_missing_tag_404(client, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)

    res = client.delete("/admin/tags/00000000-0000-0000-0000-000000000000")
    assert res.status_code == 404


def test_assign_and_unassign_tag_to_member(client, make_user, login_as, db_session):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    target = make_user(email="member@example.com", membership_status=MembershipStatus.active)
    login_as(admin)

    tag = _make_tag(client, "Dean")

    res = client.post(f"/admin/users/{target.id}/tags", json={"tag_id": tag["id"]})
    assert res.status_code == 200
    body = res.json()
    assert body["user_id"] == str(target.id)
    assert [t["name"] for t in body["tags"]] == ["Dean"]

    # assigning again is idempotent, not an error
    res = client.post(f"/admin/users/{target.id}/tags", json={"tag_id": tag["id"]})
    assert res.status_code == 200
    assert [t["name"] for t in res.json()["tags"]] == ["Dean"]

    res = client.delete(f"/admin/users/{target.id}/tags/{tag['id']}")
    assert res.status_code == 200
    assert res.json()["tags"] == []

    # unassigning again is a no-op, not an error
    res = client.delete(f"/admin/users/{target.id}/tags/{tag['id']}")
    assert res.status_code == 200


def test_assign_tag_missing_user_404(client, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)

    tag = _make_tag(client, "Dean")
    res = client.post("/admin/users/00000000-0000-0000-0000-000000000000/tags", json={"tag_id": tag["id"]})
    assert res.status_code == 404


def test_assign_missing_tag_404(client, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    target = make_user(email="member2@example.com")
    login_as(admin)

    res = client.post(f"/admin/users/{target.id}/tags", json={"tag_id": "00000000-0000-0000-0000-000000000000"})
    assert res.status_code == 404


def test_admins_list_and_search_include_tags(client, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)

    tag = _make_tag(client, "Chairperson")
    client.post(f"/admin/users/{admin.id}/tags", json={"tag_id": tag["id"]})

    res = client.get("/admin/admins")
    assert res.status_code == 200
    row = next(r for r in res.json() if r["user_id"] == str(admin.id))
    assert [t["name"] for t in row["tags"]] == ["Chairperson"]

    res = client.get("/admin/users/search", params={"query": admin.email})
    assert res.status_code == 200
    assert [t["name"] for t in res.json()[0]["tags"]] == ["Chairperson"]
