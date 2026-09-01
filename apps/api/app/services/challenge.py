from sqlalchemy.orm import Session

from app.models.challenge_submission import ChallengeSubmission
from app.models.membership import MembershipStatus
from app.models.user import User


class ChallengeError(Exception):
    pass


def submit(db: Session, slug: str, user: User, github_url: str, demo_url: str | None, learned: str | None) -> ChallengeSubmission:
    if not user.is_admin and user.membership.status != MembershipStatus.active:
        raise ChallengeError("Active club membership is required to submit a build")

    existing = (
        db.query(ChallengeSubmission)
        .filter(ChallengeSubmission.challenge_slug == slug, ChallengeSubmission.user_id == user.id)
        .first()
    )
    if existing:
        raise ChallengeError("You've already submitted a build for this challenge")

    submission = ChallengeSubmission(
        challenge_slug=slug,
        user_id=user.id,
        github_url=github_url,
        demo_url=demo_url,
        learned=learned,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return submission


def my_submission(db: Session, slug: str, user: User) -> ChallengeSubmission | None:
    return (
        db.query(ChallengeSubmission)
        .filter(ChallengeSubmission.challenge_slug == slug, ChallengeSubmission.user_id == user.id)
        .first()
    )


def recent_for_challenge(db: Session, slug: str, limit: int = 10) -> list[ChallengeSubmission]:
    return (
        db.query(ChallengeSubmission)
        .filter(ChallengeSubmission.challenge_slug == slug)
        .order_by(ChallengeSubmission.created_at.desc())
        .limit(limit)
        .all()
    )


def total_shipped(db: Session, user: User) -> int:
    return db.query(ChallengeSubmission).filter(ChallengeSubmission.user_id == user.id).count()
