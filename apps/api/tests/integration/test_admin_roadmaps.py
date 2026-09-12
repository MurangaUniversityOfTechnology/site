import pytest

from app.models.audit_log import AuditLog
from app.models.membership import MembershipStatus

pytestmark = pytest.mark.integration


def _make_arm(client, name="Web Development"):
    res = client.post("/admin/arms", json={"name": name})
    assert res.status_code == 201, res.text
    return res.json()


def _make_roadmap(client, arm_id, title="Semester 1, 2026", goal_summary="Ship a portfolio site"):
    res = client.post("/admin/roadmaps", json={"arm_id": arm_id, "title": title, "goal_summary": goal_summary})
    assert res.status_code == 201, res.text
    return res.json()


@pytest.fixture
def admin(make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)
    return admin


# ── access control ───────────────────────────────────────────────────────


def test_roadmap_routes_reject_non_staff(client, make_user, login_as):
    user = make_user(membership_status=MembershipStatus.active)
    login_as(user)
    assert client.get("/admin/roadmaps").status_code == 403
    assert client.post("/admin/roadmaps", json={"arm_id": "00000000-0000-0000-0000-000000000000", "title": "x"}).status_code == 403


def test_roadmap_routes_reject_unauthenticated(client):
    assert client.get("/admin/roadmaps").status_code == 401


# ── roadmap CRUD ─────────────────────────────────────────────────────────


def test_create_roadmap(client, admin, db_session):
    arm = _make_arm(client)
    roadmap = _make_roadmap(client, arm["id"])

    assert roadmap["position"] == 1
    assert roadmap["published_at"] is None
    assert roadmap["arm"]["id"] == arm["id"]
    assert roadmap["milestone_count"] == 0
    assert db_session.query(AuditLog).filter(AuditLog.actor_id == admin.id, AuditLog.kind == "roadmap").count() == 1


def test_create_second_roadmap_in_same_arm_appends_position(client, admin):
    arm = _make_arm(client)
    _make_roadmap(client, arm["id"], title="Semester 1, 2026")
    second = _make_roadmap(client, arm["id"], title="Semester 2, 2026")
    assert second["position"] == 2


def test_roadmaps_in_different_arms_position_independently(client, admin):
    arm_a = _make_arm(client, "Arm A")
    arm_b = _make_arm(client, "Arm B")
    _make_roadmap(client, arm_a["id"], title="A Sem 1")
    roadmap_b = _make_roadmap(client, arm_b["id"], title="B Sem 1")
    assert roadmap_b["position"] == 1


def test_update_roadmap(client, admin):
    arm = _make_arm(client)
    roadmap = _make_roadmap(client, arm["id"])
    res = client.patch(f"/admin/roadmaps/{roadmap['id']}", json={"title": "Semester 1, 2027"})
    assert res.status_code == 200
    assert res.json()["title"] == "Semester 1, 2027"


def test_update_missing_roadmap_404(client, admin):
    res = client.patch("/admin/roadmaps/00000000-0000-0000-0000-000000000000", json={"title": "x"})
    assert res.status_code == 404


def test_delete_roadmap(client, admin):
    arm = _make_arm(client)
    roadmap = _make_roadmap(client, arm["id"])
    res = client.delete(f"/admin/roadmaps/{roadmap['id']}")
    assert res.status_code == 204

    res = client.get("/admin/roadmaps")
    assert roadmap["id"] not in [r["id"] for r in res.json()]


# ── publish / unpublish ──────────────────────────────────────────────────


def test_publish_and_unpublish_roadmap(client, admin):
    arm = _make_arm(client)
    roadmap = _make_roadmap(client, arm["id"])

    res = client.post(f"/admin/roadmaps/{roadmap['id']}/publish")
    assert res.status_code == 200
    assert res.json()["published_at"] is not None

    res = client.post(f"/admin/roadmaps/{roadmap['id']}/publish")
    assert res.status_code == 400

    res = client.post(f"/admin/roadmaps/{roadmap['id']}/unpublish")
    assert res.status_code == 200
    assert res.json()["published_at"] is None

    res = client.post(f"/admin/roadmaps/{roadmap['id']}/unpublish")
    assert res.status_code == 400


# ── reordering roadmaps within an arm ────────────────────────────────────


def test_reorder_roadmap_swaps_positions(client, admin):
    arm = _make_arm(client)
    first = _make_roadmap(client, arm["id"], title="Sem 1")
    second = _make_roadmap(client, arm["id"], title="Sem 2")

    res = client.post(f"/admin/roadmaps/{second['id']}/reorder", json={"direction": "up"})
    assert res.status_code == 200

    rows = client.get("/admin/roadmaps").json()
    order = [r["title"] for r in rows if r["arm"]["id"] == arm["id"]]
    assert order == ["Sem 2", "Sem 1"]

    res = client.post(f"/admin/roadmaps/{first['id']}/reorder", json={"direction": "down"})
    assert res.status_code == 400


# ── milestones ───────────────────────────────────────────────────────────


def test_milestone_crud_and_reorder(client, admin):
    arm = _make_arm(client)
    roadmap = _make_roadmap(client, arm["id"])

    res = client.post(f"/admin/roadmaps/{roadmap['id']}/milestones", json={"title": "Onboard members", "description": None})
    assert res.status_code == 201
    m1 = res.json()
    assert m1["position"] == 1
    assert m1["status"] == "planned"

    res = client.post(f"/admin/roadmaps/{roadmap['id']}/milestones", json={"title": "Ship demo day"})
    m2 = res.json()
    assert m2["position"] == 2

    res = client.get(f"/admin/roadmaps/{roadmap['id']}/milestones")
    assert [m["title"] for m in res.json()] == ["Onboard members", "Ship demo day"]

    res = client.patch(f"/admin/roadmaps/milestones/{m1['id']}", json={"title": "Onboard new members"})
    assert res.status_code == 200
    assert res.json()["title"] == "Onboard new members"

    res = client.post(f"/admin/roadmaps/milestones/{m1['id']}/status", json={"status": "done"})
    assert res.status_code == 200
    assert res.json()["status"] == "done"

    res = client.post(f"/admin/roadmaps/milestones/{m2['id']}/reorder", json={"direction": "up"})
    assert res.status_code == 200
    order = [m["title"] for m in client.get(f"/admin/roadmaps/{roadmap['id']}/milestones").json()]
    assert order == ["Ship demo day", "Onboard new members"]

    res = client.delete(f"/admin/roadmaps/milestones/{m1['id']}")
    assert res.status_code == 204
    remaining = client.get(f"/admin/roadmaps/{roadmap['id']}/milestones").json()
    assert [m["title"] for m in remaining] == ["Ship demo day"]

    updated_roadmap = next(r for r in client.get("/admin/roadmaps").json() if r["id"] == roadmap["id"])
    assert updated_roadmap["milestone_count"] == 1


def test_milestone_status_rejects_invalid_value(client, admin):
    arm = _make_arm(client)
    roadmap = _make_roadmap(client, arm["id"])
    milestone = client.post(f"/admin/roadmaps/{roadmap['id']}/milestones", json={"title": "X"}).json()

    res = client.post(f"/admin/roadmaps/milestones/{milestone['id']}/status", json={"status": "bogus"})
    assert res.status_code == 422


# ── public surface ───────────────────────────────────────────────────────


def test_public_roadmaps_only_show_published(client, admin):
    arm = _make_arm(client)
    draft = _make_roadmap(client, arm["id"], title="Draft Semester")
    published = _make_roadmap(client, arm["id"], title="Published Semester")
    client.post(f"/admin/roadmaps/{published['id']}/publish")
    client.post(f"/admin/roadmaps/{published['id']}/milestones", json={"title": "Kickoff"})

    res = client.get("/roadmaps")
    assert res.status_code == 200
    titles = [r["title"] for r in res.json()]
    assert "Published Semester" in titles
    assert "Draft Semester" not in titles

    body = next(r for r in res.json() if r["id"] == published["id"])
    assert body["arm"]["id"] == arm["id"]
    assert [m["title"] for m in body["milestones"]] == ["Kickoff"]

    res = client.get("/roadmaps", params={"arm": arm["slug"]})
    assert any(r["id"] == published["id"] for r in res.json())

    other_arm = _make_arm(client, "Other Arm")
    res = client.get("/roadmaps", params={"arm": other_arm["slug"]})
    assert res.json() == []
    assert draft["id"] not in [r["id"] for r in client.get("/roadmaps").json()]
