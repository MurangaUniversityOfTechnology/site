import pytest

from app.models.membership import MembershipStatus

pytestmark = pytest.mark.integration

# A mix of routes that individually declare Depends(require_admin) and ones
# that rely purely on the router-level dependencies=[Depends(require_admin)]
# gate (overview/list_memberships/list_admins have no per-route admin dep at
# all) — proves the blanket gate actually works standalone, not just the
# routes that also happen to annotate it themselves.
ADMIN_GET_ROUTES = ["/admin/overview", "/admin/memberships", "/admin/audit", "/admin/admins"]


@pytest.mark.parametrize("path", ADMIN_GET_ROUTES)
def test_admin_routes_reject_non_admin(client, make_user, login_as, path):
    user = make_user(membership_status=MembershipStatus.active)
    login_as(user)
    res = client.get(path)
    assert res.status_code == 403


@pytest.mark.parametrize("path", ADMIN_GET_ROUTES)
def test_admin_routes_reject_unauthenticated(client, path):
    res = client.get(path)
    assert res.status_code == 401


def test_individually_annotated_route_rejects_non_admin(client, make_user, login_as):
    user = make_user(membership_status=MembershipStatus.active)
    login_as(user)
    res = client.post(f"/admin/users/{user.id}/make-admin")
    assert res.status_code == 403


def test_make_admin(client, db_session, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    target = make_user(email="target@example.com")
    login_as(admin)

    res = client.post(f"/admin/users/{target.id}/make-admin")
    assert res.status_code == 204
    db_session.refresh(target)
    assert target.is_admin is True

    from app.models.audit_log import AuditLog

    assert db_session.query(AuditLog).filter(AuditLog.actor_id == admin.id).count() == 1


def test_make_admin_emails_the_promoted_member(client, make_user, login_as, mock_email):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    target = make_user(email="target@example.com")
    login_as(admin)

    res = client.post(f"/admin/users/{target.id}/make-admin")
    assert res.status_code == 204
    assert len(mock_email) == 1
    assert mock_email[0]["to"] == "target@example.com"
    assert "admin" in mock_email[0]["subject"].lower()


def test_remove_admin_succeeds_when_another_admin_remains(client, db_session, make_user, login_as):
    admin = make_user(is_admin=True, email="admin1@example.com", membership_status=MembershipStatus.active)
    other_admin = make_user(is_admin=True, email="admin2@example.com")
    login_as(admin)

    res = client.post(f"/admin/users/{other_admin.id}/remove-admin")
    assert res.status_code == 204
    db_session.refresh(other_admin)
    assert other_admin.is_admin is False


def test_cannot_remove_last_admin(client, db_session, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)

    res = client.post(f"/admin/users/{admin.id}/remove-admin")
    assert res.status_code == 400
    db_session.refresh(admin)
    assert admin.is_admin is True


def test_can_remove_self_while_another_admin_exists(client, db_session, make_user, login_as):
    # The guard is specifically "last admin", not "can't remove self".
    admin = make_user(is_admin=True, email="admin1@example.com", membership_status=MembershipStatus.active)
    make_user(is_admin=True, email="admin2@example.com")
    login_as(admin)

    res = client.post(f"/admin/users/{admin.id}/remove-admin")
    assert res.status_code == 204
    db_session.refresh(admin)
    assert admin.is_admin is False


def test_search_user_by_email(client, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    make_user(email="findme@example.com")
    login_as(admin)

    res = client.get("/admin/users/search", params={"query": "findme@example.com"})
    assert res.status_code == 200
    assert [u["email"] for u in res.json()] == ["findme@example.com"]

    res = client.get("/admin/users/search", params={"query": "nobody@example.com"})
    assert res.status_code == 200
    assert res.json() == []


def test_search_user_by_partial_name_or_github_login(client, db_session, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    target = make_user(email="jane@example.com")
    target.profile.first_name = "Jane"
    target.profile.last_name = "Wanjiru"
    target.github_login = "janew"
    db_session.commit()
    login_as(admin)

    res = client.get("/admin/users/search", params={"query": "wanjiru"})
    assert res.status_code == 200
    assert [u["email"] for u in res.json()] == ["jane@example.com"]

    res = client.get("/admin/users/search", params={"query": "janew"})
    assert res.status_code == 200
    assert [u["email"] for u in res.json()] == ["jane@example.com"]
