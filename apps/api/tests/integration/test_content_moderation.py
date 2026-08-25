import pytest

from app.models.content import ContentStatus
from app.models.membership import MembershipStatus
from app.services import content as content_service

pytestmark = pytest.mark.integration


def test_submit_requires_active_membership(db_session, make_user):
    user = make_user(membership_status=MembershipStatus.none)
    with pytest.raises(content_service.ContentError):
        content_service.submit(db_session, user, "Title", "Body", [])


def test_submit_succeeds_for_active_member(db_session, make_user):
    user = make_user(membership_status=MembershipStatus.active)
    content = content_service.submit(db_session, user, "Title", "Body", ["backend"])
    assert content.status == ContentStatus.pending_review


def test_publish_from_pending_review(db_session, make_user):
    admin = make_user(is_admin=True, email="admin@example.com")
    author = make_user(membership_status=MembershipStatus.active, email="author@example.com")
    content = content_service.submit(db_session, author, "Title", "Body", [])

    content_service.publish(db_session, admin, content)
    assert content.status == ContentStatus.published


@pytest.mark.parametrize("action_name", ["publish", "reject", "request_changes"])
def test_moderation_actions_blocked_outside_pending_review(db_session, make_user, action_name):
    admin = make_user(is_admin=True, email="admin@example.com")
    author = make_user(membership_status=MembershipStatus.active, email="author@example.com")
    content = content_service.submit(db_session, author, "Title", "Body", [])
    content.status = ContentStatus.published
    db_session.commit()

    action = getattr(content_service, action_name)
    with pytest.raises(content_service.ContentError):
        action(db_session, admin, content)


def test_reject_from_pending_review(db_session, make_user):
    admin = make_user(is_admin=True, email="admin@example.com")
    author = make_user(membership_status=MembershipStatus.active, email="author@example.com")
    content = content_service.submit(db_session, author, "Title", "Body", [])

    content_service.reject(db_session, admin, content)
    assert content.status == ContentStatus.rejected


def test_request_changes_moves_to_draft_with_no_path_back_to_review(db_session, make_user):
    # Documents current behavior: request_changes() -> draft, and the only
    # code path that could move a Content row back to pending_review is
    # submit(), which always creates a brand-new row rather than
    # resubmitting this one. There is no "resubmit this draft" endpoint in
    # routers/content.py — draft is a practical dead end today.
    admin = make_user(is_admin=True, email="admin@example.com")
    author = make_user(membership_status=MembershipStatus.active, email="author@example.com")
    content = content_service.submit(db_session, author, "Title", "Body", [])

    content_service.request_changes(db_session, admin, content)
    assert content.status == ContentStatus.draft

    with pytest.raises(content_service.ContentError):
        content_service.publish(db_session, admin, content)


def test_get_published_only_returns_published_content(db_session, make_user):
    author = make_user(membership_status=MembershipStatus.active, email="author@example.com")
    content = content_service.submit(db_session, author, "Title", "Body", [])

    assert content_service.get_published(db_session, str(content.id)) is None

    admin = make_user(is_admin=True, email="admin@example.com")
    content_service.publish(db_session, admin, content)
    assert content_service.get_published(db_session, str(content.id)) is not None


# ── HTTP layer ───────────────────────────────────────────────────────────


def test_submit_endpoint(client, make_user, login_as):
    user = make_user(membership_status=MembershipStatus.active)
    login_as(user)

    res = client.post("/content", json={"title": "Title", "body": "Body", "tags": []})
    assert res.status_code == 201


def test_admin_publish_endpoint(client, db_session, make_user, login_as):
    admin = make_user(is_admin=True)
    author = make_user(membership_status=MembershipStatus.active, email="author@example.com")
    content = content_service.submit(db_session, author, "Title", "Body", [])
    login_as(admin)

    res = client.post(f"/admin/content/{content.id}/publish")
    assert res.status_code == 204


def test_get_published_endpoint_has_no_ownership_check(client, db_session, make_user):
    # Any caller — signed in or not — can read a published article once
    # it's public; publishing has no per-viewer restriction.
    admin = make_user(is_admin=True)
    author = make_user(membership_status=MembershipStatus.active, email="author@example.com")
    content = content_service.submit(db_session, author, "Title", "Body", [])
    content_service.publish(db_session, admin, content)

    res = client.get(f"/content/published/{content.id}")
    assert res.status_code == 200
