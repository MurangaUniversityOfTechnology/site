import httpx
import pytest
import respx

from app.models.project import Project

pytestmark = pytest.mark.integration


def _mock_repo_found(m, repo_name="new-repo"):
    return m.get(url__regex=rf".*/repos/.*/{repo_name}$").mock(
        return_value=httpx.Response(200, json={"description": "A repo", "language": "Python", "topics": []})
    )


def _mock_issues(m):
    return m.get(url__regex=r".*/issues").mock(return_value=httpx.Response(200, json=[]))


def test_add_project_creates_and_syncs(client, db_session, make_user, login_as):
    admin = make_user(is_admin=True)
    login_as(admin)

    with respx.mock(assert_all_called=False) as m:
        _mock_repo_found(m)
        _mock_issues(m)
        res = client.post("/admin/projects", json={"repo_name": "new-repo", "display_name": "New Repo"})

    assert res.status_code == 201, res.text
    body = res.json()
    assert body["slug"] == "new-repo"
    assert body["repo_name"] == "new-repo"
    assert body["language"] == "Python"
    assert db_session.query(Project).filter(Project.repo_name == "new-repo").first() is not None


def test_add_project_defaults_display_name_to_repo_name(client, make_user, login_as):
    admin = make_user(is_admin=True)
    login_as(admin)

    with respx.mock(assert_all_called=False) as m:
        _mock_repo_found(m)
        _mock_issues(m)
        res = client.post("/admin/projects", json={"repo_name": "new-repo"})

    assert res.status_code == 201, res.text
    assert res.json()["name"] == "new-repo"


def test_add_project_rejects_unknown_repo(client, make_user, login_as):
    admin = make_user(is_admin=True)
    login_as(admin)

    with respx.mock(assert_all_called=False) as m:
        m.get(url__regex=r".*/repos/.*/missing-repo$").mock(return_value=httpx.Response(404))
        res = client.post("/admin/projects", json={"repo_name": "missing-repo"})

    assert res.status_code == 400
    assert "missing-repo" in res.json()["detail"]


def test_add_project_rejects_already_tracked_repo(client, db_session, make_user, login_as):
    admin = make_user(is_admin=True)
    login_as(admin)
    db_session.add(Project(slug="existing", name="Existing", repo_owner="mut-tech-test-org", repo_name="existing-repo"))
    db_session.commit()

    res = client.post("/admin/projects", json={"repo_name": "existing-repo"})
    assert res.status_code == 400


def test_add_project_requires_admin(client, make_user, login_as):
    user = make_user()
    login_as(user)
    res = client.post("/admin/projects", json={"repo_name": "new-repo"})
    assert res.status_code == 403


def test_remove_project_deletes_row(client, db_session, make_user, login_as):
    admin = make_user(is_admin=True)
    login_as(admin)
    db_session.add(Project(slug="to-remove", name="To Remove", repo_owner="mut-tech-test-org", repo_name="to-remove"))
    db_session.commit()

    res = client.delete("/admin/projects/to-remove")
    assert res.status_code == 204
    assert db_session.query(Project).filter(Project.slug == "to-remove").first() is None


def test_remove_project_404_for_unknown_slug(client, make_user, login_as):
    admin = make_user(is_admin=True)
    login_as(admin)
    res = client.delete("/admin/projects/unknown-slug")
    assert res.status_code == 404


def test_list_tracked_projects(client, db_session, make_user, login_as):
    admin = make_user(is_admin=True)
    login_as(admin)
    db_session.add(Project(slug="p1", name="P1", repo_owner="mut-tech-test-org", repo_name="p1"))
    db_session.commit()

    res = client.get("/admin/projects")
    assert res.status_code == 200
    assert any(row["slug"] == "p1" for row in res.json())


def _project(db_session, **overrides):
    fields = {"slug": "test-project", "name": "Test Project", "repo_owner": "mut-tech-test-org", "repo_name": "test-project"}
    fields.update(overrides)
    project = Project(**fields)
    db_session.add(project)
    db_session.commit()
    return project


def test_complete_project(client, db_session, make_user, login_as):
    _project(db_session)
    admin = make_user(is_admin=True)
    login_as(admin)

    res = client.post("/admin/projects/test-project/complete")
    assert res.status_code == 200, res.text
    assert res.json()["completed_at"] is not None


def test_cannot_complete_already_completed_project(client, db_session, make_user, login_as):
    _project(db_session)
    admin = make_user(is_admin=True)
    login_as(admin)
    client.post("/admin/projects/test-project/complete")

    res = client.post("/admin/projects/test-project/complete")
    assert res.status_code == 400


def test_activate_reverses_completion(client, db_session, make_user, login_as):
    _project(db_session)
    admin = make_user(is_admin=True)
    login_as(admin)
    client.post("/admin/projects/test-project/complete")

    res = client.post("/admin/projects/test-project/activate")
    assert res.status_code == 200, res.text
    assert res.json()["completed_at"] is None


def test_cannot_activate_project_that_isnt_completed(client, db_session, make_user, login_as):
    _project(db_session)
    admin = make_user(is_admin=True)
    login_as(admin)

    res = client.post("/admin/projects/test-project/activate")
    assert res.status_code == 400


def test_cannot_archive_project_that_isnt_completed(client, db_session, make_user, login_as):
    _project(db_session)
    admin = make_user(is_admin=True)
    login_as(admin)

    res = client.post("/admin/projects/test-project/archive")
    assert res.status_code == 400


def test_archive_completed_project(client, db_session, make_user, login_as):
    _project(db_session)
    admin = make_user(is_admin=True)
    login_as(admin)
    client.post("/admin/projects/test-project/complete")

    res = client.post("/admin/projects/test-project/archive")
    assert res.status_code == 200, res.text
    assert res.json()["archived_at"] is not None


def test_cannot_activate_archived_project(client, db_session, make_user, login_as):
    _project(db_session)
    admin = make_user(is_admin=True)
    login_as(admin)
    client.post("/admin/projects/test-project/complete")
    client.post("/admin/projects/test-project/archive")

    res = client.post("/admin/projects/test-project/activate")
    assert res.status_code == 400


def test_unarchive_project(client, db_session, make_user, login_as):
    _project(db_session)
    admin = make_user(is_admin=True)
    login_as(admin)
    client.post("/admin/projects/test-project/complete")
    client.post("/admin/projects/test-project/archive")

    res = client.post("/admin/projects/test-project/unarchive")
    assert res.status_code == 200, res.text
    assert res.json()["archived_at"] is None
    assert res.json()["completed_at"] is not None


def test_admin_projects_list_excludes_archived_by_default(client, db_session, make_user, login_as):
    _project(db_session)
    admin = make_user(is_admin=True)
    login_as(admin)
    client.post("/admin/projects/test-project/complete")
    client.post("/admin/projects/test-project/archive")

    res = client.get("/admin/projects")
    assert res.json() == []

    res = client.get("/admin/projects", params={"archived": "true"})
    assert [p["slug"] for p in res.json()] == ["test-project"]


def test_public_projects_list_excludes_archived(client, db_session, make_user, login_as):
    _project(db_session)
    admin = make_user(is_admin=True)
    login_as(admin)
    client.post("/admin/projects/test-project/complete")
    client.post("/admin/projects/test-project/archive")

    res = client.get("/projects")
    assert res.json() == []

    res = client.get("/projects/archived")
    assert [p["slug"] for p in res.json()] == ["test-project"]


def test_archived_project_still_reachable_by_direct_slug(client, db_session, make_user, login_as):
    _project(db_session)
    admin = make_user(is_admin=True)
    login_as(admin)
    client.post("/admin/projects/test-project/complete")
    client.post("/admin/projects/test-project/archive")

    res = client.get("/projects/test-project")
    assert res.status_code == 200
    assert res.json()["slug"] == "test-project"
