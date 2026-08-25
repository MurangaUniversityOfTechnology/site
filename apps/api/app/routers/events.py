from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user_optional
from app.models.user import User
from app.schemas.event import RegisterRequest, RegistrationResponse
from app.services import event as event_service

router = APIRouter(prefix="/events", tags=["events"])


@router.post("/{slug}/register", response_model=RegistrationResponse, status_code=status.HTTP_201_CREATED)
def register(
    slug: str,
    payload: RegisterRequest,
    user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    try:
        registration = event_service.register(db, slug, user, payload.guest_name, payload.guest_email)
    except event_service.EventError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return registration


@router.get("/{slug}/registration", response_model=RegistrationResponse | None)
def my_registration(slug: str, user: User | None = Depends(get_current_user_optional), db: Session = Depends(get_db)):
    if not user:
        return None
    return event_service.my_registration(db, slug, user)
