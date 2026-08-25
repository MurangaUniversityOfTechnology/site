from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user_optional
from app.models.user import User
from app.schemas.member import MemberProfile, MemberSummary
from app.services import member as member_service

router = APIRouter(prefix="/members", tags=["members"])


@router.get("", response_model=list[MemberSummary])
def list_members(viewer: User | None = Depends(get_current_user_optional), db: Session = Depends(get_db)):
    profiles = member_service.directory(db, viewer)
    return [
        MemberSummary(
            user_id=p.user_id,
            display_name=p.display_name,
            interests=p.interests,
            experience_level=p.experience_level,
        )
        for p in profiles
    ]


@router.get("/{user_id}", response_model=MemberProfile)
def get_member(user_id: str, viewer: User | None = Depends(get_current_user_optional), db: Session = Depends(get_db)):
    try:
        profile = member_service.get_profile(db, user_id, viewer)
    except member_service.MemberError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc

    return MemberProfile(
        user_id=profile.user_id,
        display_name=profile.display_name,
        bio=profile.bio,
        interests=profile.interests,
        experience_level=profile.experience_level,
        goals=profile.goals,
        github_url=profile.github_url,
        linkedin_url=profile.linkedin_url,
        photo_url=profile.photo_url,
    )
