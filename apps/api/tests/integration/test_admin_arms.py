import pytest

from app.models.audit_log import AuditLog
from app.models.membership import MembershipStatus
from app.services import course as course_service

pytestmark = pytest.mark.integration

SEEDED_ARM_NAMES = [
    "Web Development & UI/UX Design",
    "Artificial Intelligence & Robotics",
    "IoT / Network / Hardware",
    "Cybersecurity & Digital Forensics",
    "Mobile Application Development",
    "Augmented & Virtual Reality",
    "Blockchain",
    "Others",
]


@pytest.fixture
def make_course(db_session, make_user):
    counter = {"n": 0}

    def _make(admin=None):
        counter["n"] += 1
        admin = admin or make_user(is_admin=True, email=f"arm-course-admin-{counter['n']}@example.com")
        course = course_service.create_course(
            db_session,
            admin,
            {
                "slug": f"arm-course-{counter['n']}",
                "title": f"Arm Course {counter['n']}",
                "short_description": "short",
                "description": "full",
                "cover_image_url": None,
                "price_kes": 0,
            },
        )
        return course, admin

    return _make


def _make_arm(client, name="New Arm"):
    res = client.post("/admin/arms", json={"name": name})
    assert res.status_code == 201, res.text
    return res.json()


# ── admin access ─────────────────────────────────────────────────────────


def test_arm_routes_reject_non_admin(client, make_user, login_as):
    user = make_user(membership_status=MembershipStatus.active)
    login_as(user)
    assert client.get("/admin/arms").status_code == 403
    assert client.post("/admin/arms", json={"name": "X"}).status_code == 403


def test_arm_routes_reject_unauthenticated(client):
    assert client.get("/admin/arms").status_code == 401


# ── seed data ────────────────────────────────────────────────────────────


def test_seed_arms_present_in_order(client, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)

    res = client.get("/admin/arms")
    assert res.status_code == 200
    body = res.json()
    assert [a["name"] for a in body] == SEEDED_ARM_NAMES
    assert [a["position"] for a in body] == list(range(1, 9))
    assert body[-1]["slug"] == "others"


# ── create / rename / delete ─────────────────────────────────────────────


def test_create_arm_appends_after_seeded(client, make_user, login_as, db_session):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)

    arm = _make_arm(client, "Game Development")
    assert arm["position"] == 9
    assert arm["slug"] == "game-development"

    res = client.get("/admin/arms")
    assert res.json()[-1]["name"] == "Game Development"
    assert db_session.query(AuditLog).filter(AuditLog.actor_id == admin.id, AuditLog.kind == "arms").count() == 1


def test_create_arm_rejects_duplicate_case_insensitive(client, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)

    res = client.post("/admin/arms", json={"name": "blockchain"})
    assert res.status_code == 400


def test_create_arm_rejects_blank_name(client, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)

    res = client.post("/admin/arms", json={"name": "   "})
    assert res.status_code == 400


def test_rename_arm_updates_slug(client, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)

    arm = _make_arm(client, "Robotics")
    res = client.patch(f"/admin/arms/{arm['id']}", json={"name": "Robotics & Automation"})
    assert res.status_code == 200
    assert res.json()["name"] == "Robotics & Automation"
    assert res.json()["slug"] == "robotics-and-automation"


def test_rename_arm_rejects_duplicate(client, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)

    arm = _make_arm(client, "Something")
    res = client.patch(f"/admin/arms/{arm['id']}", json={"name": "blockchain"})
    assert res.status_code == 400


def test_rename_missing_arm_404(client, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)

    res = client.patch("/admin/arms/00000000-0000-0000-0000-000000000000", json={"name": "X"})
    assert res.status_code == 404


def test_delete_arm(client, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)

    arm = _make_arm(client, "Deletable")
    res = client.delete(f"/admin/arms/{arm['id']}")
    assert res.status_code == 204

    res = client.get("/admin/arms")
    assert arm["id"] not in [a["id"] for a in res.json()]


def test_delete_missing_arm_404(client, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)

    res = client.delete("/admin/arms/00000000-0000-0000-0000-000000000000")
    assert res.status_code == 404


# ── reordering ───────────────────────────────────────────────────────────


def test_reorder_arm_swaps_positions(client, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)

    before = client.get("/admin/arms").json()
    blockchain = next(a for a in before if a["name"] == "Blockchain")

    res = client.post(f"/admin/arms/{blockchain['id']}/reorder", json={"direction": "up"})
    assert res.status_code == 200

    after = client.get("/admin/arms").json()
    names_in_order = [a["name"] for a in after]
    assert names_in_order.index("Blockchain") < names_in_order.index("Augmented & Virtual Reality")


def test_reorder_first_arm_up_fails(client, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)

    first = client.get("/admin/arms").json()[0]
    res = client.post(f"/admin/arms/{first['id']}/reorder", json={"direction": "up"})
    assert res.status_code == 400


def test_reorder_last_arm_down_fails(client, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)

    last = client.get("/admin/arms").json()[-1]
    res = client.post(f"/admin/arms/{last['id']}/reorder", json={"direction": "down"})
    assert res.status_code == 400


# ── assign / unassign to a course ────────────────────────────────────────


def test_assign_and_unassign_arm_to_course(client, make_course, login_as):
    course, admin = make_course()
    login_as(admin)

    arm = _make_arm(client, "Course Track")

    res = client.post(f"/admin/courses/{course.slug}/arms", json={"arm_id": arm["id"]})
    assert res.status_code == 200
    assert [a["name"] for a in res.json()["arms"]] == ["Course Track"]

    # assigning again is idempotent, not an error
    res = client.post(f"/admin/courses/{course.slug}/arms", json={"arm_id": arm["id"]})
    assert res.status_code == 200
    assert [a["name"] for a in res.json()["arms"]] == ["Course Track"]

    res = client.delete(f"/admin/courses/{course.slug}/arms/{arm['id']}")
    assert res.status_code == 200
    assert res.json()["arms"] == []

    # unassigning again is a no-op, not an error
    res = client.delete(f"/admin/courses/{course.slug}/arms/{arm['id']}")
    assert res.status_code == 200


def test_assign_arm_missing_course_404(client, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)

    arm = _make_arm(client, "Orphan Track")
    res = client.post("/admin/courses/unknown-slug/arms", json={"arm_id": arm["id"]})
    assert res.status_code == 404


def test_assign_missing_arm_404(client, make_course, login_as):
    course, admin = make_course()
    login_as(admin)

    res = client.post(
        f"/admin/courses/{course.slug}/arms", json={"arm_id": "00000000-0000-0000-0000-000000000000"}
    )
    assert res.status_code == 404


def test_course_can_belong_to_multiple_arms(client, make_course, login_as):
    course, admin = make_course()
    login_as(admin)

    arm_a = _make_arm(client, "Track A")
    arm_b = _make_arm(client, "Track B")
    client.post(f"/admin/courses/{course.slug}/arms", json={"arm_id": arm_a["id"]})
    res = client.post(f"/admin/courses/{course.slug}/arms", json={"arm_id": arm_b["id"]})

    assert sorted(a["name"] for a in res.json()["arms"]) == ["Track A", "Track B"]


# ── public surface ───────────────────────────────────────────────────────


def test_public_arms_endpoint(client):
    res = client.get("/courses/arms")
    assert res.status_code == 200
    assert [a["name"] for a in res.json()] == SEEDED_ARM_NAMES


def test_published_course_detail_includes_arms(client, db_session, make_course, login_as):
    course, admin = make_course()
    login_as(admin)
    arm = _make_arm(client, "Public Track")
    client.post(f"/admin/courses/{course.slug}/arms", json={"arm_id": arm["id"]})

    # publish requires a full structure — build the minimum via the service directly
    module = course_service.create_module(db_session, admin, course, {"title": "M1", "summary": None})
    quiz = course_service.create_module_quiz(
        db_session, admin, module, {"title": "Quiz", "intro_text": None, "pass_threshold_pct": 80}
    )
    course_service.create_question(
        db_session,
        admin,
        quiz,
        {"prompt": "?", "choices": [{"id": "a", "text": "x"}, {"id": "b", "text": "y"}], "correct_choice_ids": ["a"], "explanation": None},
    )
    final_exam = course_service.create_final_exam(
        db_session, admin, course, {"title": "Final", "intro_text": None, "pass_threshold_pct": 70}
    )
    course_service.create_question(
        db_session,
        admin,
        final_exam,
        {"prompt": "?", "choices": [{"id": "a", "text": "x"}, {"id": "b", "text": "y"}], "correct_choice_ids": ["a"], "explanation": None},
    )
    course_service.publish_course(db_session, admin, course)

    res = client.get(f"/courses/{course.slug}")
    assert res.status_code == 200
    assert [a["name"] for a in res.json()["arms"]] == ["Public Track"]

    res = client.get("/courses", params={"arm": arm["slug"]})
    assert res.status_code == 200
    assert any(c["slug"] == course.slug for c in res.json())

    res = client.get("/courses", params={"arm": "others"})
    assert all(c["slug"] != course.slug for c in res.json())
