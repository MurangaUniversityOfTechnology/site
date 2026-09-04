import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user_optional, require_mpesa_ip
from app.core.rate_limit import limiter
from app.models.event import Event
from app.models.event_registration import EventRegistration
from app.models.user import User
from app.schemas.event import (
    EventDetail,
    EventPaymentStatusResponse,
    EventSummary,
    RegisterRequest,
    RegistrationResponse,
)
from app.services import event as event_service
from app.services import event_payment

router = APIRouter(prefix="/events", tags=["events"])


def _registration_response(db: Session, registration: EventRegistration) -> RegistrationResponse:
    payment = event_payment.latest_payment_for(db, registration.id)
    if payment:
        event_payment.sync_pending_event_payment(db, payment)
    return RegistrationResponse(
        id=registration.id,
        status=registration.status.value,
        created_at=registration.created_at,
        payment=EventPaymentStatusResponse.model_validate(payment) if payment else None,
    )


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


@router.get("/archived", response_model=list[EventSummary])
def list_archived_events(db: Session = Depends(get_db)):
    return [_summary(db, e) for e in event_service.list_events(db, archived=True)]


@router.get("/registrations/{registration_id}", response_model=RegistrationResponse)
def registration_status(registration_id: uuid.UUID, db: Session = Depends(get_db)):
    """Public status lookup by (unguessable) registration id — lets a guest
    who registered for a paid event poll their payment without an account,
    the same way /donations/{id} does for donations. Declared ahead of the
    generic /{slug} route below, same convention as /archived — a literal
    first segment must be matched before the catch-all param."""
    registration = db.get(EventRegistration, registration_id)
    if not registration:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Registration not found")
    return _registration_response(db, registration)


@router.post("/mpesa/callback", status_code=status.HTTP_200_OK, dependencies=[Depends(require_mpesa_ip)])
async def mpesa_event_callback(request: Request, db: Session = Depends(get_db)):
    payload = await request.json()
    event_payment.apply_stk_callback(db, payload)
    # Safaricom expects this exact envelope to consider the callback acknowledged.
    return {"ResultCode": 0, "ResultDesc": "Accepted"}


@router.get("/{slug}", response_model=EventDetail)
def get_event_detail(slug: str, db: Session = Depends(get_db)):
    try:
        event = event_service.get_event(db, slug)
    except event_service.EventError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    return _detail(db, event)


@router.post("/{slug}/register", response_model=RegistrationResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/hour")
def register(
    request: Request,
    slug: str,
    payload: RegisterRequest,
    user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    try:
        registration = event_service.register(
            db, slug, user, payload.guest_name, payload.guest_email, payload.phone
        )
    except event_service.EventError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return _registration_response(db, registration)


@router.get("/{slug}/registration", response_model=RegistrationResponse | None)
def my_registration(slug: str, user: User | None = Depends(get_current_user_optional), db: Session = Depends(get_db)):
    if not user:
        return None
    registration = event_service.my_registration(db, slug, user)
    if not registration:
        return None
    return _registration_response(db, registration)
