from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.schemas.arm import ArmRow
from app.schemas.roadmap import MilestonePublic, RoadmapSummary
from app.services import roadmap as roadmap_service

router = APIRouter(prefix="/roadmaps", tags=["roadmaps"])


def _summary(db: Session, r) -> RoadmapSummary:
    return RoadmapSummary(
        id=r.id,
        title=r.title,
        goal_summary=r.goal_summary,
        position=r.position,
        arm=ArmRow.model_validate(r.arm),
        milestones=[MilestonePublic.model_validate(m) for m in roadmap_service.list_milestones(db, r)],
    )


@router.get("", response_model=list[RoadmapSummary])
def list_roadmaps(arm: str | None = None, db: Session = Depends(get_db)):
    return [_summary(db, r) for r in roadmap_service.list_published_roadmaps(db, arm_slug=arm)]
