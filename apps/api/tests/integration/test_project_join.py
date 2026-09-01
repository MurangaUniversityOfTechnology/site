import pytest

from app.models.membership import MembershipStatus
from app.models.project import Project
from app.services import project as project_service

pytestmark = pytest.mark.integration


@pytest.fixture
def make_project(db_session):
    counter = {"n": 0}

    def _make():
        counter["n"] += 1
        project = Project(
            slug=f"project-{counter['n']}",
            name=f"Project {counter['n']}",
            repo_owner="test-org",
            repo_name=f"repo-{counter['n']}",
        )
        db_session.add(project)
        db_session.commit()
        db_session.refresh(project)
        return project

    return _make


def test_request_join_requires_active_membership(db_session, make_user, make_project):
    project = make_project()
    user = make_user(membership_status=MembershipStatus.none)
    with pytest.raises(project_service.ProjectError):
        project_service.request_join(db_session, project, user, ["Backend"], "Interested")


def test_request_join_succeeds_for_active_member(db_session, make_user, make_project):
    project = make_project()
    user = make_user(membership_status=MembershipStatus.active)
    req = project_service.request_join(db_session, project, user, ["Backend"], "Interested")
    assert req.status.value == "pending"


def test_request_join_succeeds_for_admin_without_active_membership(db_session, make_user, make_project):
    project = make_project()
    admin = make_user(is_admin=True, membership_status=MembershipStatus.none)
    req = project_service.request_join(db_session, project, admin, ["Backend"], "Interested")
    assert req.status.value == "pending"


def test_request_join_blocked_if_project_completed(db_session, make_user, make_project):
    project = make_project()
    admin = make_user(is_admin=True, email="admin@example.com")
    project_service.mark_completed(db_session, admin, project)
    user = make_user(membership_status=MembershipStatus.active)
    with pytest.raises(project_service.ProjectError):
        project_service.request_join(db_session, project, user, ["Backend"], "Interested")


def test_request_join_blocked_if_already_a_member(db_session, make_user, make_project):
    from app.models.project_member import ProjectMember

    project = make_project()
    user = make_user(membership_status=MembershipStatus.active)
    db_session.add(ProjectMember(project_id=project.id, user_id=user.id))
    db_session.commit()

    with pytest.raises(project_service.ProjectError):
        project_service.request_join(db_session, project, user, ["Backend"], None)


def test_request_join_blocked_if_request_already_exists(db_session, make_user, make_project):
    project = make_project()
    user = make_user(membership_status=MembershipStatus.active)
    project_service.request_join(db_session, project, user, ["Backend"], None)

    with pytest.raises(project_service.ProjectError):
        project_service.request_join(db_session, project, user, ["Frontend"], None)


def test_request_join_blocked_even_after_rejection(db_session, make_user, make_project):
    # Documents current behavior, not a spec we're enforcing here:
    # my_request() doesn't filter by status, so a rejected applicant has no
    # path to re-request through this code today. Worth a product decision,
    # not something to silently "fix" inside a test.
    project = make_project()
    admin = make_user(is_admin=True, email="admin@example.com")
    user = make_user(membership_status=MembershipStatus.active)
    req = project_service.request_join(db_session, project, user, ["Backend"], None)
    project_service.reject_join(db_session, admin, req)

    with pytest.raises(project_service.ProjectError):
        project_service.request_join(db_session, project, user, ["Backend"], None)


def test_approve_join_creates_member(db_session, make_user, make_project):
    project = make_project()
    admin = make_user(is_admin=True, email="admin@example.com")
    user = make_user(membership_status=MembershipStatus.active)
    req = project_service.request_join(db_session, project, user, ["Backend"], None)

    project_service.approve_join(db_session, admin, req)
    assert req.status.value == "approved"
    assert project_service.is_member(db_session, project, user) is True


@pytest.mark.parametrize("status", ["approved", "rejected"])
def test_approve_join_blocked_from_non_pending(db_session, make_user, make_project, status):
    from app.models.project_join_request import JoinRequestStatus

    project = make_project()
    admin = make_user(is_admin=True, email="admin@example.com")
    user = make_user(membership_status=MembershipStatus.active)
    req = project_service.request_join(db_session, project, user, ["Backend"], None)
    req.status = JoinRequestStatus(status)
    db_session.commit()

    with pytest.raises(project_service.ProjectError):
        project_service.approve_join(db_session, admin, req)


def test_reject_join_does_not_create_member(db_session, make_user, make_project):
    project = make_project()
    admin = make_user(is_admin=True, email="admin@example.com")
    user = make_user(membership_status=MembershipStatus.active)
    req = project_service.request_join(db_session, project, user, ["Backend"], None)

    project_service.reject_join(db_session, admin, req)
    assert req.status.value == "rejected"
    assert project_service.is_member(db_session, project, user) is False


def test_reject_join_blocked_from_non_pending(db_session, make_user, make_project):
    project = make_project()
    admin = make_user(is_admin=True, email="admin@example.com")
    user = make_user(membership_status=MembershipStatus.active)
    req = project_service.request_join(db_session, project, user, ["Backend"], None)
    project_service.approve_join(db_session, admin, req)

    with pytest.raises(project_service.ProjectError):
        project_service.reject_join(db_session, admin, req)


# ── HTTP layer ───────────────────────────────────────────────────────────


def test_join_endpoint(client, make_user, make_project, login_as):
    project = make_project()
    user = make_user(membership_status=MembershipStatus.active)
    login_as(user)

    res = client.post(f"/projects/{project.slug}/join", json={"contribution_areas": ["Backend"], "message": "Hi"})
    assert res.status_code == 201


def test_admin_approve_join_request_endpoint(client, db_session, make_user, make_project, login_as):
    project = make_project()
    admin = make_user(is_admin=True)
    user = make_user(membership_status=MembershipStatus.active)
    req = project_service.request_join(db_session, project, user, ["Backend"], None)
    login_as(admin)

    res = client.post(f"/admin/projects/join-requests/{req.id}/approve")
    assert res.status_code == 204
