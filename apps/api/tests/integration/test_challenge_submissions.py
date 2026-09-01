import pytest

from app.models.membership import MembershipStatus
from app.services import challenge as challenge_service

pytestmark = pytest.mark.integration


def test_submit_requires_verified_email(db_session, make_user):
    user = make_user(membership_status=MembershipStatus.active, email_verified=False)
    with pytest.raises(challenge_service.ChallengeError):
        challenge_service.submit(db_session, "build-a-url-shortener", user, "https://github.com/x/y", None, None)


def test_submit_requires_active_membership(db_session, make_user):
    user = make_user(membership_status=MembershipStatus.none)
    with pytest.raises(challenge_service.ChallengeError):
        challenge_service.submit(db_session, "build-a-url-shortener", user, "https://github.com/x/y", None, None)


def test_submit_succeeds_for_active_verified_member(db_session, make_user):
    user = make_user(membership_status=MembershipStatus.active)
    submission = challenge_service.submit(db_session, "build-a-url-shortener", user, "https://github.com/x/y", None, None)
    assert submission.challenge_slug == "build-a-url-shortener"


def test_submit_succeeds_for_admin_without_active_membership_or_verification(db_session, make_user):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.none, email_verified=False)
    submission = challenge_service.submit(db_session, "build-a-url-shortener", admin, "https://github.com/x/y", None, None)
    assert submission.challenge_slug == "build-a-url-shortener"
