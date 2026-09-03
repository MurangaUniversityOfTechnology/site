from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.arm import Arm
from app.models.course import Course
from app.models.course_arm import CourseArm
from app.models.user import User
from app.services import audit


class ArmError(Exception):
    pass


def list_arms(db: Session) -> list[Arm]:
    # Deliberate order (e.g. "Others" stays last), not alphabetical — the
    # one way this differs from Tag.
    return db.query(Arm).order_by(Arm.position.asc()).all()


def get_arm(db: Session, arm_id) -> Arm:
    arm = db.get(Arm, arm_id)
    if not arm:
        raise ArmError("Unknown arm")
    return arm


def _slugify(name: str) -> str:
    return "-".join(name.lower().replace("&", "and").replace("/", " ").split())


def create_arm(db: Session, admin: User, name: str) -> Arm:
    name = name.strip()
    if not name:
        raise ArmError("Arm name is required")
    if db.query(Arm).filter(Arm.name.ilike(name)).first():
        raise ArmError(f"Arm '{name}' already exists")

    max_pos = db.query(func.max(Arm.position)).scalar() or 0
    arm = Arm(name=name, slug=_slugify(name), position=max_pos + 1)
    db.add(arm)
    audit.log(db, admin, "arms", f"Created arm '{name}'")
    db.commit()
    db.refresh(arm)
    return arm


def rename_arm(db: Session, admin: User, arm: Arm, new_name: str) -> Arm:
    new_name = new_name.strip()
    if not new_name:
        raise ArmError("Arm name is required")
    existing = db.query(Arm).filter(Arm.name.ilike(new_name), Arm.id != arm.id).first()
    if existing:
        raise ArmError(f"Arm '{new_name}' already exists")

    old_name = arm.name
    arm.name = new_name
    arm.slug = _slugify(new_name)
    audit.log(db, admin, "arms", f"Renamed arm '{old_name}' to '{new_name}'")
    db.commit()
    db.refresh(arm)
    return arm


def delete_arm(db: Session, admin: User, arm: Arm) -> None:
    audit.log(db, admin, "arms", f"Deleted arm '{arm.name}'")
    db.delete(arm)
    db.commit()


def reorder_arm(db: Session, admin: User, arm: Arm, direction: str) -> Arm:
    siblings = list_arms(db)
    idx = next(i for i, a in enumerate(siblings) if a.id == arm.id)
    swap_idx = idx - 1 if direction == "up" else idx + 1
    if swap_idx < 0 or swap_idx >= len(siblings):
        raise ArmError("Can't move further in that direction")
    other = siblings[swap_idx]

    # Same park-at-a-temporary-value technique as services/course.py's
    # _swap_positions — Postgres checks UniqueConstraint-backed ordering
    # per-statement, so a direct two-way swap isn't safe here (arms.position
    # has no unique constraint, but keeping the same defensive pattern costs
    # nothing and matches the sibling code exactly).
    arm_pos, other_pos = arm.position, other.position
    arm.position = -1
    db.flush()
    other.position = arm_pos
    db.flush()
    arm.position = other_pos

    audit.log(db, admin, "arms", f"Reordered arm '{arm.name}'")
    db.commit()
    db.refresh(arm)
    return arm


def list_course_arms(db: Session, course: Course) -> list[Arm]:
    return (
        db.query(Arm)
        .join(CourseArm, CourseArm.arm_id == Arm.id)
        .filter(CourseArm.course_id == course.id)
        .order_by(Arm.position.asc())
        .all()
    )


def assign_arm(db: Session, admin: User, course: Course, arm: Arm) -> None:
    existing = db.query(CourseArm).filter(CourseArm.course_id == course.id, CourseArm.arm_id == arm.id).first()
    if existing:
        return
    db.add(CourseArm(course_id=course.id, arm_id=arm.id))
    audit.log(db, admin, "arms", f"Added '{arm.name}' to course {course.title}")
    db.commit()


def unassign_arm(db: Session, admin: User, course: Course, arm: Arm) -> None:
    link = db.query(CourseArm).filter(CourseArm.course_id == course.id, CourseArm.arm_id == arm.id).first()
    if not link:
        return
    db.delete(link)
    audit.log(db, admin, "arms", f"Removed '{arm.name}' from course {course.title}")
    db.commit()
