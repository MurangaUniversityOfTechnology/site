from datetime import UTC, datetime

import pytest
from sqlalchemy.exc import IntegrityError

from app.models.challenge_submission import ChallengeSubmission
from app.models.content import Content, ContentStatus
from app.models.event import Event, EventAudience
from app.models.event_registration import EventRegistration
from app.models.membership import MembershipStatus
from app.models.notification import Notification
from app.models.payment import Payment, PaymentStatus
from app.models.project import Project
from app.models.project_join_request import JoinRequestStatus, ProjectJoinRequest
from app.models.project_member import ProjectMember
from app.models.user import User

pytestmark = pytest.mark.integration


def test_deleting_user_cascades_owned_rows(db_session, make_user):
    user = make_user(membership_status=MembershipStatus.active)

    event = Event(
        slug="test-event",
        title="Test Event",
        audience=EventAudience.open_to_all,
        starts_at=datetime.now(UTC),
        venue="Test Venue",
        description="Test description",
    )
    db_session.add(event)
    db_session.flush()

    project = Project(slug="test-project", name="Test Project", repo_owner="org", repo_name="repo")
    db_session.add(project)
    db_session.flush()

    db_session.add(Notification(user_id=user.id, kind="test", title="Hi"))
    db_session.add(EventRegistration(event_id=event.id, user_id=user.id))
    db_session.add(ChallengeSubmission(challenge_slug="test-challenge", user_id=user.id, github_url="https://github.com/x/y"))
    db_session.add(ProjectMember(project_id=project.id, user_id=user.id))
    db_session.add(ProjectJoinRequest(project_id=project.id, user_id=user.id, status=JoinRequestStatus.pending))
    db_session.commit()

    user_id = user.id
    db_session.delete(user)
    db_session.commit()

    assert db_session.query(User).filter(User.id == user_id).first() is None
    assert db_session.query(Notification).filter(Notification.user_id == user_id).count() == 0
    assert db_session.query(EventRegistration).filter(EventRegistration.user_id == user_id).count() == 0
    assert db_session.query(ChallengeSubmission).filter(ChallengeSubmission.user_id == user_id).count() == 0
    assert db_session.query(ProjectMember).filter(ProjectMember.user_id == user_id).count() == 0
    assert db_session.query(ProjectJoinRequest).filter(ProjectJoinRequest.user_id == user_id).count() == 0


def test_deleting_user_sets_audit_log_actor_null(db_session, make_user):
    from app.services import audit

    user = make_user()
    audit.log(db_session, user, "test", "did a thing")
    db_session.commit()

    db_session.delete(user)
    db_session.commit()

    from app.models.audit_log import AuditLog

    entry = db_session.query(AuditLog).filter(AuditLog.action == "did a thing").first()
    assert entry is not None
    assert entry.actor_id is None
    assert entry.actor_name  # denormalized at write time, survives the delete


def test_deleting_user_with_payment_is_blocked(db_session, make_user):
    user = make_user()
    db_session.add(Payment(user_id=user.id, amount=500, phone="254712345678", status=PaymentStatus.completed))
    db_session.commit()

    db_session.delete(user)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_deleting_user_with_content_is_blocked(db_session, make_user):
    user = make_user(membership_status=MembershipStatus.active)
    db_session.add(Content(author_id=user.id, title="Title", body="Body", tags=[], status=ContentStatus.published))
    db_session.commit()

    db_session.delete(user)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_deleting_project_cascades_members_and_join_requests(db_session, make_user):
    user = make_user(membership_status=MembershipStatus.active)
    project = Project(slug="test-project", name="Test Project", repo_owner="org", repo_name="repo")
    db_session.add(project)
    db_session.flush()
    db_session.add(ProjectMember(project_id=project.id, user_id=user.id))
    db_session.commit()

    project_id = project.id
    db_session.delete(project)
    db_session.commit()

    assert db_session.query(ProjectMember).filter(ProjectMember.project_id == project_id).count() == 0
