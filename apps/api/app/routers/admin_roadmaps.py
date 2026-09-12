import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import require_staff
from app.models.roadmap import Roadmap
from app.models.roadmap_milestone import RoadmapMilestone
from app.models.user import User
from app.schemas.arm import ArmRow
from app.schemas.roadmap import (
    AdminMilestoneRow,
    AdminRoadmapRow,
    MilestoneStatusRequest,
    MilestoneUpdateRequest,
    MilestoneWriteRequest,
    ReorderRequest,
    RoadmapUpdateRequest,
    RoadmapWriteRequest,
)
from app.services import roadmap as roadmap_service

router = APIRouter(prefix="/admin/roadmaps", tags=["admin-roadmaps"], dependencies=[Depends(require_staff)])


# ── row shaping ──────────────────────────────────────────────────────────


def _display_name(user: User) -> str:
    return user.profile.display_name if user.profile and user.profile.display_name else user.email


def _admin_roadmap_row(db: Session, roadmap: Roadmap) -> AdminRoadmapRow:
    return AdminRoadmapRow(
        id=roadmap.id,
        title=roadmap.title,
        goal_summary=roadmap.goal_summary,
        position=roadmap.position,
        published_at=roadmap.published_at,
        arm=ArmRow.model_validate(roadmap.arm),
        milestone_count=len(roadmap_service.list_milestones(db, roadmap)),
        created_by=_display_name(roadmap.created_by),
    )


def _admin_milestone_row(milestone: RoadmapMilestone) -> AdminMilestoneRow:
    return AdminMilestoneRow(
        id=milestone.id,
        roadmap_id=milestone.roadmap_id,
        title=milestone.title,
        description=milestone.description,
        status=milestone.status.value,
        position=milestone.position,
    )


# ── 404 helpers ──────────────────────────────────────────────────────────


def _get_roadmap_or_404(db: Session, roadmap_id: uuid.UUID) -> Roadmap:
    try:
        return roadmap_service.get_roadmap(db, roadmap_id)
    except roadmap_service.RoadmapError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


def _get_milestone_or_404(db: Session, milestone_id: uuid.UUID) -> RoadmapMilestone:
    try:
        return roadmap_service.get_milestone(db, milestone_id)
    except roadmap_service.RoadmapError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


# ── roadmaps ─────────────────────────────────────────────────────────────


@router.get("", response_model=list[AdminRoadmapRow])
def list_admin_roadmaps(db: Session = Depends(get_db)):
    return [_admin_roadmap_row(db, r) for r in roadmap_service.list_admin_roadmaps(db)]


@router.post("", response_model=AdminRoadmapRow, status_code=status.HTTP_201_CREATED)
def create_roadmap(payload: RoadmapWriteRequest, admin: User = Depends(require_staff), db: Session = Depends(get_db)):
    roadmap = roadmap_service.create_roadmap(db, admin, payload.model_dump())
    return _admin_roadmap_row(db, roadmap)


@router.patch("/{roadmap_id}", response_model=AdminRoadmapRow)
def update_roadmap(
    roadmap_id: uuid.UUID,
    payload: RoadmapUpdateRequest,
    admin: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    roadmap = _get_roadmap_or_404(db, roadmap_id)
    roadmap = roadmap_service.update_roadmap(db, admin, roadmap, payload.model_dump(exclude_unset=True))
    return _admin_roadmap_row(db, roadmap)


@router.delete("/{roadmap_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_roadmap(roadmap_id: uuid.UUID, admin: User = Depends(require_staff), db: Session = Depends(get_db)):
    roadmap = _get_roadmap_or_404(db, roadmap_id)
    roadmap_service.delete_roadmap(db, admin, roadmap)


@router.post("/{roadmap_id}/publish", response_model=AdminRoadmapRow)
def publish_roadmap(roadmap_id: uuid.UUID, admin: User = Depends(require_staff), db: Session = Depends(get_db)):
    roadmap = _get_roadmap_or_404(db, roadmap_id)
    try:
        roadmap = roadmap_service.publish_roadmap(db, admin, roadmap)
    except roadmap_service.RoadmapError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return _admin_roadmap_row(db, roadmap)


@router.post("/{roadmap_id}/unpublish", response_model=AdminRoadmapRow)
def unpublish_roadmap(roadmap_id: uuid.UUID, admin: User = Depends(require_staff), db: Session = Depends(get_db)):
    roadmap = _get_roadmap_or_404(db, roadmap_id)
    try:
        roadmap = roadmap_service.unpublish_roadmap(db, admin, roadmap)
    except roadmap_service.RoadmapError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return _admin_roadmap_row(db, roadmap)


@router.post("/{roadmap_id}/reorder", response_model=AdminRoadmapRow)
def reorder_roadmap(
    roadmap_id: uuid.UUID, payload: ReorderRequest, admin: User = Depends(require_staff), db: Session = Depends(get_db)
):
    roadmap = _get_roadmap_or_404(db, roadmap_id)
    try:
        roadmap = roadmap_service.reorder_roadmap(db, admin, roadmap, payload.direction)
    except roadmap_service.RoadmapError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return _admin_roadmap_row(db, roadmap)


# ── milestones ───────────────────────────────────────────────────────────


@router.get("/{roadmap_id}/milestones", response_model=list[AdminMilestoneRow])
def list_admin_milestones(roadmap_id: uuid.UUID, db: Session = Depends(get_db)):
    roadmap = _get_roadmap_or_404(db, roadmap_id)
    return [_admin_milestone_row(m) for m in roadmap_service.list_milestones(db, roadmap)]


@router.post("/{roadmap_id}/milestones", response_model=AdminMilestoneRow, status_code=status.HTTP_201_CREATED)
def create_milestone(
    roadmap_id: uuid.UUID,
    payload: MilestoneWriteRequest,
    admin: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    roadmap = _get_roadmap_or_404(db, roadmap_id)
    milestone = roadmap_service.create_milestone(db, admin, roadmap, payload.model_dump())
    return _admin_milestone_row(milestone)


@router.patch("/milestones/{milestone_id}", response_model=AdminMilestoneRow)
def update_milestone(
    milestone_id: uuid.UUID,
    payload: MilestoneUpdateRequest,
    admin: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    milestone = _get_milestone_or_404(db, milestone_id)
    milestone = roadmap_service.update_milestone(db, admin, milestone, payload.model_dump(exclude_unset=True))
    return _admin_milestone_row(milestone)


@router.post("/milestones/{milestone_id}/status", response_model=AdminMilestoneRow)
def set_milestone_status(
    milestone_id: uuid.UUID,
    payload: MilestoneStatusRequest,
    admin: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    milestone = _get_milestone_or_404(db, milestone_id)
    milestone = roadmap_service.set_milestone_status(db, admin, milestone, payload.status)
    return _admin_milestone_row(milestone)


@router.delete("/milestones/{milestone_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_milestone(milestone_id: uuid.UUID, admin: User = Depends(require_staff), db: Session = Depends(get_db)):
    milestone = _get_milestone_or_404(db, milestone_id)
    roadmap_service.delete_milestone(db, admin, milestone)


@router.post("/milestones/{milestone_id}/reorder", response_model=AdminMilestoneRow)
def reorder_milestone(
    milestone_id: uuid.UUID,
    payload: ReorderRequest,
    admin: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    milestone = _get_milestone_or_404(db, milestone_id)
    try:
        milestone = roadmap_service.reorder_milestone(db, admin, milestone, payload.direction)
    except roadmap_service.RoadmapError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return _admin_milestone_row(milestone)
