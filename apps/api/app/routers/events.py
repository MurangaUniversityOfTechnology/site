from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user_optional
from app.models.event import Event
from app.models.user import User
from app.schemas.event import (
    EventDetail,
    EventSummary,
    RegisterRequest,
    RegistrationResponse,
)
from app.services import event as event_service

router = APIRouter(prefix="/events", tags=["events"])


def _summary(db: Session, event: Event) -> EventSummary:
    return EventSummary(
        slug=event.slug,
        title=event.title,
        starts_at=event.starts_at,
        venue=event.venue,
        description=event.description,
        audience=event.audience,
        fee_kes=event.fee_kes,
        capacity=event.capacity,
        seats_left=event_service.seats_left(db, event),
    )


def _detail(db: Session, event: Event) -> EventDetail:
    return EventDetail(
        **_summary(db, event).model_dump(),
        what_youll_build=event.what_youll_build,
        schedule=event.schedule,
        speaker_name=event.speaker_name,
        speaker_meta=event.speaker_meta,
        requirements=event.requirements,
        who_should_attend=event.who_should_attend,
    )


@router.get("", response_model=list[EventSummary])
def list_events(db: Session = Depends(get_db)):
    return [_summary(db, e) for e in event_service.list_events(db)]


@router.get("/{slug}", response_model=EventDetail)
def get_event_detail(slug: str, db: Session = Depends(get_db)):
    try:
        event = event_service.get_event(db, slug)
    except event_service.EventError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    return _detail(db, event)


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
