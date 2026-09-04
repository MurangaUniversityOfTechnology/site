import pytest

from app.models.membership import MembershipStatus
from app.services import audit

pytestmark = pytest.mark.integration

# Staff (forms/courses/events only) must reach these — router-level
# dependencies=[Depends(require_staff)] replaced require_admin on all three.
STAFF_ALLOWED_GET_ROUTES = ["/admin/forms", "/admin/courses", "/admin/events"]

# Staff must never reach these — funds, member management, tags, roles, audit.
STAFF_FORBIDDEN_GET_ROUTES = [
    "/admin/overview",
    "/admin/memberships",
    "/admin/payments",
    "/admin/donations",
    "/admin/audit",
    "/admin/admins",
    "/admin/tags",
]


@pytest.mark.parametrize("path", STAFF_ALLOWED_GET_ROUTES)
def test_staff_can_reach_forms_courses_events(client, make_user, login_as, path):
    staff = make_user(is_staff=True, membership_status=MembershipStatus.active)
    login_as(staff)
    res = client.get(path)
    assert res.status_code == 200, res.text


@pytest.mark.parametrize("path", STAFF_FORBIDDEN_GET_ROUTES)
def test_staff_cannot_reach_funds_or_member_routes(client, make_user, login_as, path):
    staff = make_user(is_staff=True, membership_status=MembershipStatus.active)
    login_as(staff)
    res = client.get(path)
    assert res.status_code == 403


@pytest.mark.parametrize("path", STAFF_ALLOWED_GET_ROUTES)
def test_plain_member_cannot_reach_staff_routes(client, make_user, login_as, path):
    member = make_user(membership_status=MembershipStatus.active)
    login_as(member)
    res = client.get(path)
    assert res.status_code == 403


def test_admin_can_still_reach_staff_routes(client, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)
    for path in STAFF_ALLOWED_GET_ROUTES:
        res = client.get(path)
        assert res.status_code == 200, res.text


def test_staff_can_upload_files(client, make_user, login_as):
    staff = make_user(is_staff=True, membership_status=MembershipStatus.active)
    login_as(staff)
    res = client.post("/admin/uploads", files={"file": ("x.txt", b"hello", "text/plain")})
    # Not asserting 200 (depends on the upload backend being configured in
    # tests) — the point is it's not blocked by the permission gate.
    assert res.status_code != 403


def test_staff_can_search_users(client, make_user, login_as):
    staff = make_user(is_staff=True, membership_status=MembershipStatus.active)
    make_user(email="findme@example.com")
    login_as(staff)

    res = client.get("/admin/users/search", params={"query": "findme@example.com"})
    assert res.status_code == 200
    assert [u["email"] for u in res.json()] == ["findme@example.com"]


def test_staff_can_grant_staff_to_another_member(client, db_session, make_user, login_as):
    staff = make_user(is_staff=True, email="staff1@example.com", membership_status=MembershipStatus.active)
    target = make_user(email="target@example.com")
    login_as(staff)

    res = client.post(f"/admin/users/{target.id}/make-staff")
    assert res.status_code == 204
    db_session.refresh(target)
    assert target.is_staff is True

    from app.models.audit_log import AuditLog

    entry = db_session.query(AuditLog).filter(AuditLog.actor_id == staff.id).one()
    assert entry.kind == "roles"


def test_staff_cannot_revoke_staff(client, make_user, login_as):
    staff = make_user(is_staff=True, email="staff1@example.com", membership_status=MembershipStatus.active)
    other_staff = make_user(is_staff=True, email="staff2@example.com")
    login_as(staff)

    res = client.post(f"/admin/users/{other_staff.id}/remove-staff")
    assert res.status_code == 403


def test_admin_can_revoke_staff(client, db_session, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    staff = make_user(is_staff=True, email="staff1@example.com")
    login_as(admin)

    res = client.post(f"/admin/users/{staff.id}/remove-staff")
    assert res.status_code == 204
    db_session.refresh(staff)
    assert staff.is_staff is False


def test_list_staff(client, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    make_user(is_staff=True, email="staff1@example.com")
    login_as(admin)

    res = client.get("/admin/staff")
    assert res.status_code == 200
    assert [u["email"] for u in res.json()] == ["staff1@example.com"]


def test_plain_member_cannot_make_staff(client, make_user, login_as):
    member = make_user(membership_status=MembershipStatus.active)
    target = make_user(email="target@example.com")
    login_as(member)

    res = client.post(f"/admin/users/{target.id}/make-staff")
    assert res.status_code == 403


def test_audit_log_filters_by_kind(client, db_session, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    audit.log(db_session, admin, "form", "Created form Test Form")
    audit.log(db_session, admin, "course", "Created course Test Course")
    db_session.commit()
    login_as(admin)

    res = client.get("/admin/audit", params={"kind": "form"})
    assert res.status_code == 200
    kinds = {e["kind"] for e in res.json()}
    assert kinds == {"form"}


def test_audit_log_filters_by_query_text(client, db_session, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    audit.log(db_session, admin, "form", "Created form Quantum Widget")
    audit.log(db_session, admin, "course", "Created course Intro to Rust")
    db_session.commit()
    login_as(admin)

    res = client.get("/admin/audit", params={"q": "quantum"})
    assert res.status_code == 200
    assert len(res.json()) == 1
    assert "Quantum Widget" in res.json()[0]["what"]


def test_staff_cannot_read_audit_log(client, make_user, login_as):
    staff = make_user(is_staff=True, membership_status=MembershipStatus.active)
    login_as(staff)
    res = client.get("/admin/audit")
    assert res.status_code == 403
