from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import require_staff
from app.models.event import Event
from app.models.event_manager import EventManager
from app.models.event_registration import EventRegistration
from app.models.user import User
from app.schemas.event import (
    AdminEventRow,
    AdminRegistrationRow,
    EventUpdateRequest,
    EventWriteRequest,
)
from app.schemas.event_manager import EventManagerRow, InviteManagerRequest
from app.services import event as event_service
from app.services import event_manager as event_manager_service

router = APIRouter(prefix="/admin", tags=["admin-events"], dependencies=[Depends(require_staff)])


# ── events (admin CRUD) ──────────────────────────────────────────────


def _admin_event_row(db: Session, event: Event) -> AdminEventRow:
    count = db.query(EventRegistration).filter(EventRegistration.event_id == event.id).count()
    return AdminEventRow(
        id=event.id,
        slug=event.slug,
        title=event.title,
        starts_at=event.starts_at,
        venue=event.venue,
        description=event.description,
        audience=event.audience,
        fee_kes=event.fee_kes,
        capacity=event.capacity,
        seats_left=event_service.seats_left(db, event),
        what_youll_build=event.what_youll_build,
        schedule=event.schedule,
        speaker_name=event.speaker_name,
        speaker_meta=event.speaker_meta,
        requirements=event.requirements,
        who_should_attend=event.who_should_attend,
        registration_count=count,
        archived_at=event.archived_at,
    )


@router.get("/events", response_model=list[AdminEventRow])
def list_admin_events(archived: bool = False, db: Session = Depends(get_db)):
    return [_admin_event_row(db, e) for e in event_service.list_events(db, archived=archived)]


@router.post("/events", response_model=AdminEventRow, status_code=status.HTTP_201_CREATED)
def create_event(payload: EventWriteRequest, admin: User = Depends(require_staff), db: Session = Depends(get_db)):
    try:
        event = event_service.create_event(db, admin, payload.model_dump())
    except event_service.EventError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return _admin_event_row(db, event)


def _get_event_or_404(db: Session, slug: str) -> Event:
    try:
        return event_service.get_event(db, slug)
    except event_service.EventError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


@router.patch("/events/{slug}", response_model=AdminEventRow)
def update_event(
    slug: str, payload: EventUpdateRequest, admin: User = Depends(require_staff), db: Session = Depends(get_db)
):
    event = _get_event_or_404(db, slug)
    try:
        event = event_service.update_event(db, admin, event, payload.model_dump(exclude_unset=True))
    except event_service.EventError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return _admin_event_row(db, event)


@router.delete("/events/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(slug: str, admin: User = Depends(require_staff), db: Session = Depends(get_db)):
    event = _get_event_or_404(db, slug)
    try:
        event_service.delete_event(db, admin, event)
    except event_service.EventError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.post("/events/{slug}/archive", response_model=AdminEventRow)
def archive_event(slug: str, admin: User = Depends(require_staff), db: Session = Depends(get_db)):
    event = _get_event_or_404(db, slug)
    try:
        event = event_service.archive_event(db, admin, event)
    except event_service.EventError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return _admin_event_row(db, event)


@router.post("/events/{slug}/unarchive", response_model=AdminEventRow)
def unarchive_event(slug: str, admin: User = Depends(require_staff), db: Session = Depends(get_db)):
    event = _get_event_or_404(db, slug)
    try:
        event = event_service.unarchive_event(db, admin, event)
    except event_service.EventError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return _admin_event_row(db, event)


@router.get("/events/{slug}/registrations", response_model=list[AdminRegistrationRow])
def list_registrations(slug: str, db: Session = Depends(get_db)):
    try:
        registrations = event_service.list_for_event(db, slug)
    except event_service.EventError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    return [AdminRegistrationRow(**event_service.registration_admin_row(db, r)) for r in registrations]


def _get_registration(db: Session, registration_id: str) -> EventRegistration:
    reg = db.get(EventRegistration, registration_id)
    if not reg:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Registration not found")
    return reg


@router.post("/registrations/{registration_id}/approve", status_code=status.HTTP_204_NO_CONTENT)
def approve_registration(registration_id: str, admin: User = Depends(require_staff), db: Session = Depends(get_db)):
    reg = _get_registration(db, registration_id)
    try:
        event_service.approve(db, admin, reg)
    except event_service.EventError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.post("/registrations/{registration_id}/reject", status_code=status.HTTP_204_NO_CONTENT)
def reject_registration(registration_id: str, admin: User = Depends(require_staff), db: Session = Depends(get_db)):
    reg = _get_registration(db, registration_id)
    try:
        event_service.reject(db, admin, reg)
    except event_service.EventError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.post("/registrations/{registration_id}/waitlist", status_code=status.HTTP_204_NO_CONTENT)
def waitlist_registration(registration_id: str, admin: User = Depends(require_staff), db: Session = Depends(get_db)):
    reg = _get_registration(db, registration_id)
    try:
        event_service.waitlist(db, admin, reg)
    except event_service.EventError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.post("/registrations/{registration_id}/attend", status_code=status.HTTP_204_NO_CONTENT)
def attend_registration(registration_id: str, admin: User = Depends(require_staff), db: Session = Depends(get_db)):
    reg = _get_registration(db, registration_id)
    try:
        event_service.mark_attended(db, admin, reg)
    except event_service.EventError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


# ── event managers (scoped, per-event admin access) ─────────────────────


def _display_name(user: User) -> str:
    return user.profile.display_name if user.profile and user.profile.display_name else user.email


def _manager_row(m: EventManager) -> EventManagerRow:
    return EventManagerRow(
        id=m.id,
        invited_email=m.invited_email,
        status=m.status.value,
        invited_by=_display_name(m.invited_by),
        created_at=m.created_at,
        accepted_at=m.accepted_at,
    )


@router.get("/events/{slug}/managers", response_model=list[EventManagerRow])
def list_event_managers(slug: str, db: Session = Depends(get_db)):
    event = _get_event_or_404(db, slug)
    return [_manager_row(m) for m in event_manager_service.list_for_event(db, event)]


@router.post("/events/{slug}/managers/invite", response_model=EventManagerRow, status_code=status.HTTP_201_CREATED)
def invite_event_manager(
    slug: str, payload: InviteManagerRequest, admin: User = Depends(require_staff), db: Session = Depends(get_db)
):
    event = _get_event_or_404(db, slug)
    try:
        manager = event_manager_service.invite_manager(db, admin, event, payload.email)
    except event_manager_service.EventManagerError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return _manager_row(manager)


@router.post("/events/managers/{manager_id}/revoke", status_code=status.HTTP_204_NO_CONTENT)
def revoke_event_manager(manager_id: str, admin: User = Depends(require_staff), db: Session = Depends(get_db)):
    try:
        manager = event_manager_service.get_by_id(db, manager_id)
    except event_manager_service.EventManagerError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    event_manager_service.revoke_manager(db, admin, manager)
