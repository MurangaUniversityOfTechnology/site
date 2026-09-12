from datetime import UTC, datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.arm import Arm
from app.models.roadmap import Roadmap
from app.models.roadmap_milestone import MilestoneStatus, RoadmapMilestone
from app.models.user import User
from app.services import audit


class RoadmapError(Exception):
    pass


# ── roadmaps ─────────────────────────────────────────────────────────────


def list_published_roadmaps(db: Session, arm_slug: str | None = None) -> list[Roadmap]:
    query = db.query(Roadmap).join(Arm, Roadmap.arm_id == Arm.id).filter(Roadmap.published_at.isnot(None))
    if arm_slug:
        query = query.filter(Arm.slug == arm_slug)
    return query.order_by(Arm.position.asc(), Roadmap.position.asc()).all()


def list_admin_roadmaps(db: Session) -> list[Roadmap]:
    return db.query(Roadmap).join(Arm, Roadmap.arm_id == Arm.id).order_by(Arm.position.asc(), Roadmap.position.asc()).all()


def get_roadmap(db: Session, roadmap_id) -> Roadmap:
    roadmap = db.get(Roadmap, roadmap_id)
    if not roadmap:
        raise RoadmapError("Unknown roadmap")
    return roadmap


def get_published_roadmap(db: Session, roadmap_id) -> Roadmap:
    roadmap = db.get(Roadmap, roadmap_id)
    if not roadmap or roadmap.published_at is None:
        raise RoadmapError("Unknown roadmap")
    return roadmap


def create_roadmap(db: Session, admin: User, fields: dict) -> Roadmap:
    arm_id = fields["arm_id"]
    max_pos = db.query(func.max(Roadmap.position)).filter(Roadmap.arm_id == arm_id).scalar() or 0
    roadmap = Roadmap(**fields, position=max_pos + 1, created_by_id=admin.id)
    db.add(roadmap)
    audit.log(db, admin, "roadmap", f"Created roadmap '{roadmap.title}'")
    db.commit()
    db.refresh(roadmap)
    return roadmap


def update_roadmap(db: Session, admin: User, roadmap: Roadmap, fields: dict) -> Roadmap:
    for key, value in fields.items():
        setattr(roadmap, key, value)
    audit.log(db, admin, "roadmap", f"Updated roadmap '{roadmap.title}'")
    db.commit()
    db.refresh(roadmap)
    return roadmap


def delete_roadmap(db: Session, admin: User, roadmap: Roadmap) -> None:
    audit.log(db, admin, "roadmap", f"Deleted roadmap '{roadmap.title}'")
    db.delete(roadmap)
    db.commit()


def publish_roadmap(db: Session, admin: User, roadmap: Roadmap) -> Roadmap:
    if roadmap.published_at is not None:
        raise RoadmapError("Roadmap is already published")
    roadmap.published_at = datetime.now(UTC)
    audit.log(db, admin, "roadmap", f"Published roadmap '{roadmap.title}'")
    db.commit()
    db.refresh(roadmap)
    return roadmap


def unpublish_roadmap(db: Session, admin: User, roadmap: Roadmap) -> Roadmap:
    if roadmap.published_at is None:
        raise RoadmapError("Roadmap is not published")
    roadmap.published_at = None
    audit.log(db, admin, "roadmap", f"Unpublished roadmap '{roadmap.title}'")
    db.commit()
    db.refresh(roadmap)
    return roadmap


# ── positions (shared by roadmaps / milestones) ─────────────────────────


def _swap_positions(db: Session, item, other) -> None:
    """Same park-at-a-temporary-value technique as services/course.py's
    _swap_positions — a direct two-way swap isn't safe under a per-statement
    UniqueConstraint on position."""
    item_pos, other_pos = item.position, other.position
    item.position = -1
    db.flush()
    other.position = item_pos
    db.flush()
    item.position = other_pos


def _reorder(db: Session, siblings: list, item, direction: str) -> None:
    idx = next(i for i, s in enumerate(siblings) if s.id == item.id)
    swap_idx = idx - 1 if direction == "up" else idx + 1
    if swap_idx < 0 or swap_idx >= len(siblings):
        raise RoadmapError("Can't move further in that direction")
    _swap_positions(db, item, siblings[swap_idx])


def _list_roadmaps_in_arm(db: Session, arm_id) -> list[Roadmap]:
    return db.query(Roadmap).filter(Roadmap.arm_id == arm_id).order_by(Roadmap.position.asc()).all()


def reorder_roadmap(db: Session, admin: User, roadmap: Roadmap, direction: str) -> Roadmap:
    _reorder(db, _list_roadmaps_in_arm(db, roadmap.arm_id), roadmap, direction)
    audit.log(db, admin, "roadmap", f"Reordered roadmap '{roadmap.title}'")
    db.commit()
    db.refresh(roadmap)
    return roadmap


# ── milestones ───────────────────────────────────────────────────────────


def list_milestones(db: Session, roadmap: Roadmap) -> list[RoadmapMilestone]:
    return (
        db.query(RoadmapMilestone)
        .filter(RoadmapMilestone.roadmap_id == roadmap.id)
        .order_by(RoadmapMilestone.position.asc())
        .all()
    )


def get_milestone(db: Session, milestone_id) -> RoadmapMilestone:
    milestone = db.get(RoadmapMilestone, milestone_id)
    if not milestone:
        raise RoadmapError("Unknown milestone")
    return milestone


def create_milestone(db: Session, admin: User, roadmap: Roadmap, fields: dict) -> RoadmapMilestone:
    max_pos = (
        db.query(func.max(RoadmapMilestone.position)).filter(RoadmapMilestone.roadmap_id == roadmap.id).scalar() or 0
    )
    milestone = RoadmapMilestone(roadmap_id=roadmap.id, position=max_pos + 1, **fields)
    db.add(milestone)
    audit.log(db, admin, "roadmap", f"Added milestone '{milestone.title}' to '{roadmap.title}'")
    db.commit()
    db.refresh(milestone)
    return milestone


def update_milestone(db: Session, admin: User, milestone: RoadmapMilestone, fields: dict) -> RoadmapMilestone:
    for key, value in fields.items():
        setattr(milestone, key, value)
    audit.log(db, admin, "roadmap", f"Updated milestone '{milestone.title}'")
    db.commit()
    db.refresh(milestone)
    return milestone


def set_milestone_status(db: Session, admin: User, milestone: RoadmapMilestone, status: str) -> RoadmapMilestone:
    milestone.status = MilestoneStatus(status)
    audit.log(db, admin, "roadmap", f"Marked milestone '{milestone.title}' as {status}")
    db.commit()
    db.refresh(milestone)
    return milestone


def delete_milestone(db: Session, admin: User, milestone: RoadmapMilestone) -> None:
    audit.log(db, admin, "roadmap", f"Deleted milestone '{milestone.title}'")
    db.delete(milestone)
    db.commit()


def reorder_milestone(db: Session, admin: User, milestone: RoadmapMilestone, direction: str) -> RoadmapMilestone:
    _reorder(db, list_milestones(db, milestone.roadmap), milestone, direction)
    audit.log(db, admin, "roadmap", f"Reordered milestone '{milestone.title}'")
    db.commit()
    db.refresh(milestone)
    return milestone
