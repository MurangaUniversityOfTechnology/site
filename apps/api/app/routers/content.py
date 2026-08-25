from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.content import ContentResponse, ContentSummary, SubmitContentRequest
from app.services import content as content_service

router = APIRouter(prefix="/content", tags=["content"])


@router.post("", response_model=ContentResponse, status_code=status.HTTP_201_CREATED)
def submit(payload: SubmitContentRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        content = content_service.submit(db, user, payload.title, payload.body, payload.tags)
    except content_service.ContentError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return content


@router.get("/mine", response_model=list[ContentResponse])
def my_content(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return content_service.my_content(db, user)


@router.get("/published", response_model=list[ContentSummary])
def published(db: Session = Depends(get_db)):
    rows = content_service.published(db)
    return [
        ContentSummary(
            id=c.id,
            title=c.title,
            excerpt=c.body[:220],
            author=(c.author.profile.display_name if c.author.profile and c.author.profile.display_name else c.author.email),
            created_at=c.created_at,
        )
        for c in rows
    ]


@router.get("/published/{content_id}", response_model=ContentResponse)
def get_published(content_id: str, db: Session = Depends(get_db)):
    content = content_service.get_published(db, content_id)
    if not content:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Article not found")
    return content
