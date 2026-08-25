from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.challenge import RecentSubmission, SubmissionResponse, SubmitBuildRequest
from app.services import challenge as challenge_service

router = APIRouter(prefix="/challenges", tags=["challenges"])


@router.post("/{slug}/submit", response_model=SubmissionResponse, status_code=status.HTTP_201_CREATED)
def submit_build(
    slug: str,
    payload: SubmitBuildRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        submission = challenge_service.submit(db, slug, user, payload.github_url, payload.demo_url, payload.learned)
    except challenge_service.ChallengeError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

    return SubmissionResponse(
        id=submission.id,
        challenge_slug=submission.challenge_slug,
        github_url=submission.github_url,
        demo_url=submission.demo_url,
        created_at=submission.created_at,
        total_shipped=challenge_service.total_shipped(db, user),
    )


@router.get("/{slug}/my-submission", response_model=SubmissionResponse | None)
def my_submission(slug: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    submission = challenge_service.my_submission(db, slug, user)
    if not submission:
        return None
    return SubmissionResponse(
        id=submission.id,
        challenge_slug=submission.challenge_slug,
        github_url=submission.github_url,
        demo_url=submission.demo_url,
        created_at=submission.created_at,
        total_shipped=challenge_service.total_shipped(db, user),
    )


@router.get("/{slug}/submissions", response_model=list[RecentSubmission])
def recent_submissions(slug: str, db: Session = Depends(get_db)):
    rows = challenge_service.recent_for_challenge(db, slug)
    out = []
    for r in rows:
        profile = r.user.profile
        name = (profile.display_name or profile.first_name) if profile else None
        out.append(RecentSubmission(name=name or r.user.email.split("@")[0], when=r.created_at))
    return out
