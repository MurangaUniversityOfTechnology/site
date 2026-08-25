import logging
from datetime import UTC, datetime, timedelta

import httpx
import pytest
import respx

from app.models.membership import MembershipStatus
from app.models.user import GithubOrgInviteStatus
from app.services import github as github_service

pytestmark = pytest.mark.integration


def _link_github(user, github_id=123456):
    user.github_id = github_id
    user.github_login = "test-gh-user"


# ── maybe_invite_to_org ──────────────────────────────────────────────────


def test_no_invite_when_org_not_configured(db_session, make_user, monkeypatch):
    user = make_user(membership_status=MembershipStatus.active)
    _link_github(user)
    db_session.commit()
    monkeypatch.setattr(github_service.settings, "github_org", "")

    with respx.mock(assert_all_called=False) as m:
        route = m.post(url__regex=r".*/orgs/.*/invitations").mock(return_value=httpx.Response(201))
        github_service.maybe_invite_to_org(db_session, user)
        assert route.call_count == 0
    assert user.github_org_invite_status == GithubOrgInviteStatus.none


def test_no_invite_without_linked_github(db_session, make_user):
    user = make_user(membership_status=MembershipStatus.active)
    with respx.mock(assert_all_called=False) as m:
        route = m.post(url__regex=r".*/orgs/.*/invitations").mock(return_value=httpx.Response(201))
        github_service.maybe_invite_to_org(db_session, user)
        assert route.call_count == 0


def test_no_invite_without_active_membership(db_session, make_user):
    user = make_user(membership_status=MembershipStatus.none)
    _link_github(user)
    db_session.commit()
    with respx.mock(assert_all_called=False) as m:
        route = m.post(url__regex=r".*/orgs/.*/invitations").mock(return_value=httpx.Response(201))
        github_service.maybe_invite_to_org(db_session, user)
        assert route.call_count == 0


@pytest.mark.parametrize(
    "status", [GithubOrgInviteStatus.invited, GithubOrgInviteStatus.accepted, GithubOrgInviteStatus.expired]
)
def test_no_invite_when_already_processed(db_session, make_user, status):
    user = make_user(membership_status=MembershipStatus.active)
    _link_github(user)
    user.github_org_invite_status = status
    db_session.commit()

    with respx.mock(assert_all_called=False) as m:
        route = m.post(url__regex=r".*/orgs/.*/invitations").mock(return_value=httpx.Response(201))
        github_service.maybe_invite_to_org(db_session, user)
        assert route.call_count == 0
    assert user.github_org_invite_status == status  # untouched


def test_invite_fires_when_all_conditions_met(db_session, make_user, mock_github_invite_success):
    user = make_user(membership_status=MembershipStatus.active)
    _link_github(user)
    db_session.commit()

    github_service.maybe_invite_to_org(db_session, user)

    assert mock_github_invite_success.routes[0].call_count == 1
    assert user.github_org_invite_status == GithubOrgInviteStatus.invited
    assert user.github_org_invited_at is not None

    from app.models.notification import Notification

    assert db_session.query(Notification).filter(Notification.user_id == user.id).count() == 1


def test_invite_failure_is_logged_and_leaves_status_none(db_session, make_user, caplog):
    user = make_user(membership_status=MembershipStatus.active)
    _link_github(user)
    db_session.commit()

    with respx.mock(assert_all_called=False) as m:
        m.post(url__regex=r".*/orgs/.*/invitations").mock(
            return_value=httpx.Response(403, json={"message": "Resource not accessible by personal access token"})
        )
        with caplog.at_level(logging.WARNING):
            github_service.maybe_invite_to_org(db_session, user)

    assert user.github_org_invite_status == GithubOrgInviteStatus.none
    assert any("403" in record.message for record in caplog.records)


# ── refresh_invite_status ────────────────────────────────────────────────


def test_refresh_marks_accepted_on_active_state(db_session, make_user):
    user = make_user()
    _link_github(user)
    user.github_org_invite_status = GithubOrgInviteStatus.invited
    db_session.commit()

    with respx.mock(assert_all_called=False) as m:
        m.get(url__regex=r".*/orgs/.*/memberships/.*").mock(return_value=httpx.Response(200, json={"state": "active"}))
        github_service.refresh_invite_status(db_session, user)

    assert user.github_org_invite_status == GithubOrgInviteStatus.accepted


def test_refresh_keeps_invited_on_pending_state(db_session, make_user):
    user = make_user()
    _link_github(user)
    user.github_org_invite_status = GithubOrgInviteStatus.invited
    db_session.commit()

    with respx.mock(assert_all_called=False) as m:
        m.get(url__regex=r".*/orgs/.*/memberships/.*").mock(return_value=httpx.Response(200, json={"state": "pending"}))
        github_service.refresh_invite_status(db_session, user)

    assert user.github_org_invite_status == GithubOrgInviteStatus.invited


def test_refresh_expires_after_seven_days_of_404(db_session, make_user):
    user = make_user()
    _link_github(user)
    user.github_org_invite_status = GithubOrgInviteStatus.invited
    user.github_org_invited_at = datetime.now(UTC) - timedelta(days=8)
    db_session.commit()

    with respx.mock(assert_all_called=False) as m:
        m.get(url__regex=r".*/orgs/.*/memberships/.*").mock(return_value=httpx.Response(404))
        github_service.refresh_invite_status(db_session, user)

    assert user.github_org_invite_status == GithubOrgInviteStatus.expired


def test_refresh_stays_invited_within_seven_days_of_404(db_session, make_user):
    user = make_user()
    _link_github(user)
    user.github_org_invite_status = GithubOrgInviteStatus.invited
    user.github_org_invited_at = datetime.now(UTC) - timedelta(days=3)
    db_session.commit()

    with respx.mock(assert_all_called=False) as m:
        m.get(url__regex=r".*/orgs/.*/memberships/.*").mock(return_value=httpx.Response(404))
        github_service.refresh_invite_status(db_session, user)

    assert user.github_org_invite_status == GithubOrgInviteStatus.invited


@pytest.mark.parametrize("status", [GithubOrgInviteStatus.none, GithubOrgInviteStatus.accepted])
def test_refresh_404_ignored_when_not_currently_invited(db_session, make_user, status):
    user = make_user()
    _link_github(user)
    user.github_org_invite_status = status
    user.github_org_invited_at = datetime.now(UTC) - timedelta(days=30)
    db_session.commit()

    with respx.mock(assert_all_called=False) as m:
        m.get(url__regex=r".*/orgs/.*/memberships/.*").mock(return_value=httpx.Response(404))
        github_service.refresh_invite_status(db_session, user)

    assert user.github_org_invite_status == status


# ── resend_invite ────────────────────────────────────────────────────────


def test_resend_invite_requires_linked_github(db_session, make_user):
    user = make_user(membership_status=MembershipStatus.active)
    with pytest.raises(github_service.GithubError):
        github_service.resend_invite(db_session, user)


def test_resend_invite_resets_and_reinvites(db_session, make_user, mock_github_invite_success):
    user = make_user(membership_status=MembershipStatus.active)
    _link_github(user)
    user.github_org_invite_status = GithubOrgInviteStatus.expired
    db_session.commit()

    github_service.resend_invite(db_session, user)

    assert mock_github_invite_success.routes[0].call_count == 1
    assert user.github_org_invite_status == GithubOrgInviteStatus.invited
