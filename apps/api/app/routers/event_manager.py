from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user
from app.models.event import Event
from app.models.event_manager import EventManager, EventManagerStatus
from app.models.event_registration import EventRegistration
from app.models.user import User
from app.schemas.event import AdminRegistrationRow
from app.schemas.event_manager import (
    AcceptInviteResponse,
    EventManagerRow,
    InviteManagerRequest,
    InvitePreviewResponse,
    WalkInRegisterRequest,
)
from app.services import event as event_service
from app.services import event_manager as event_manager_service

router = APIRouter(prefix="/events", tags=["event-manager"])
invites_router = APIRouter(prefix="/event-invites", tags=["event-manager"])


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


def _event_access(slug: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> tuple[Event, User]:
    try:
        event = event_service.get_event(db, slug)
    except event_service.EventError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    if not event_manager_service.can_manage(db, event, user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You don't manage this event")
    return event, user


def _get_registration_in_event(db: Session, event: Event, registration_id: str) -> EventRegistration:
    reg = db.get(EventRegistration, registration_id)
    if not reg or reg.event_id != event.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Registration not found")
    return reg


@router.get("/{slug}/manage/registrations", response_model=list[AdminRegistrationRow])
def list_registrations(access: tuple[Event, User] = Depends(_event_access), db: Session = Depends(get_db)):
    event, _ = access
    registrations = (
        db.query(EventRegistration)
        .filter(EventRegistration.event_id == event.id)
        .order_by(EventRegistration.created_at.asc())
        .all()
    )
    return [AdminRegistrationRow(**event_service.registration_admin_row(db, r)) for r in registrations]


@router.post("/{slug}/manage/registrations", response_model=AdminRegistrationRow, status_code=status.HTTP_201_CREATED)
def add_walk_in(
    payload: WalkInRegisterRequest, access: tuple[Event, User] = Depends(_event_access), db: Session = Depends(get_db)
):
    event, user = access
    try:
        registration = event_service.admin_register(
            db,
            user,
            event,
            name=payload.name,
            email=payload.email,
            payment=payload.payment,
            phone=payload.phone,
            mpesa_receipt=payload.mpesa_receipt,
            amount_kes=payload.amount_kes,
        )
    except event_service.EventError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return AdminRegistrationRow(**event_service.registration_admin_row(db, registration))


@router.post("/{slug}/manage/registrations/{registration_id}/approve", status_code=status.HTTP_204_NO_CONTENT)
def approve_registration(
    registration_id: str, access: tuple[Event, User] = Depends(_event_access), db: Session = Depends(get_db)
):
    event, user = access
    reg = _get_registration_in_event(db, event, registration_id)
    try:
        event_service.approve(db, user, reg)
    except event_service.EventError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.post("/{slug}/manage/registrations/{registration_id}/reject", status_code=status.HTTP_204_NO_CONTENT)
def reject_registration(
    registration_id: str, access: tuple[Event, User] = Depends(_event_access), db: Session = Depends(get_db)
):
    event, user = access
    reg = _get_registration_in_event(db, event, registration_id)
    try:
        event_service.reject(db, user, reg)
    except event_service.EventError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.post("/{slug}/manage/registrations/{registration_id}/waitlist", status_code=status.HTTP_204_NO_CONTENT)
def waitlist_registration(
    registration_id: str, access: tuple[Event, User] = Depends(_event_access), db: Session = Depends(get_db)
):
    event, user = access
    reg = _get_registration_in_event(db, event, registration_id)
    try:
        event_service.waitlist(db, user, reg)
    except event_service.EventError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.post("/{slug}/manage/registrations/{registration_id}/attend", status_code=status.HTTP_204_NO_CONTENT)
def attend_registration(
    registration_id: str, access: tuple[Event, User] = Depends(_event_access), db: Session = Depends(get_db)
):
    event, user = access
    reg = _get_registration_in_event(db, event, registration_id)
    try:
        event_service.mark_attended(db, user, reg)
    except event_service.EventError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.get("/{slug}/manage/managers", response_model=list[EventManagerRow])
def list_event_managers(access: tuple[Event, User] = Depends(_event_access), db: Session = Depends(get_db)):
    event, _ = access
    return [_manager_row(m) for m in event_manager_service.list_for_event(db, event)]


@router.post("/{slug}/manage/managers/invite", response_model=EventManagerRow, status_code=status.HTTP_201_CREATED)
def invite_event_manager(
    payload: InviteManagerRequest, access: tuple[Event, User] = Depends(_event_access), db: Session = Depends(get_db)
):
    event, user = access
    try:
        manager = event_manager_service.invite_manager(db, user, event, payload.email)
    except event_manager_service.EventManagerError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return _manager_row(manager)


@router.post("/{slug}/manage/managers/{manager_id}/revoke", status_code=status.HTTP_204_NO_CONTENT)
def revoke_event_manager(
    manager_id: str, access: tuple[Event, User] = Depends(_event_access), db: Session = Depends(get_db)
):
    event, user = access
    try:
        manager = event_manager_service.get_by_id(db, manager_id)
    except event_manager_service.EventManagerError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    if manager.event_id != event.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown event manager")
    event_manager_service.revoke_manager(db, user, manager)


@router.get("/my-managed", response_model=list[str])
def my_managed_events(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Slugs of events this user actively manages (not counting is_staff/
    is_admin, who reach every event via /admin instead) — powers the
    "events you manage" links shown on their dashboard."""
    rows = (
        db.query(Event.slug)
        .join(EventManager, EventManager.event_id == Event.id)
        .filter(EventManager.user_id == user.id, EventManager.status == EventManagerStatus.active)
        .all()
    )
    return [r[0] for r in rows]


# ── invite accept flow (token-based, works before the invitee has an account) ──


@invites_router.get("/{token}", response_model=InvitePreviewResponse)
def preview_invite(token: str, db: Session = Depends(get_db)):
    try:
        manager = event_manager_service.get_by_token(db, token)
    except event_manager_service.EventManagerError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    return InvitePreviewResponse(
        event_title=manager.event.title,
        event_slug=manager.event.slug,
        invited_email=manager.invited_email,
        invited_by=_display_name(manager.invited_by),
        status=manager.status.value,
    )


@invites_router.post("/{token}/accept", response_model=AcceptInviteResponse)
def accept_invite(token: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        manager = event_manager_service.accept_invite(db, user, token)
    except event_manager_service.EventManagerError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return AcceptInviteResponse(event_slug=manager.event.slug)
