import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_db
from app.core.deps import require_admin, require_staff
from app.models.profile import Profile
from app.models.user import User
from app.schemas.admin import AdminRow
from app.services import audit
from app.services import email as email_service
from app.services import tags as tag_service
from app.services.email_templates import render_email

router = APIRouter(prefix="/admin", tags=["admin-roles"])
settings = get_settings()
logger = logging.getLogger(__name__)


def _to_admin_row(db: Session, u: User) -> AdminRow:
    return AdminRow(
        user_id=u.id,
        name=(u.profile.display_name if u.profile and u.profile.display_name else u.email),
        email=u.email,
        is_admin=u.is_admin,
        is_staff=u.is_staff,
        tags=tag_service.list_member_tags(db, u),
    )


@router.get("/admins", response_model=list[AdminRow])
def list_admins(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    admins = db.query(User).filter(User.is_admin.is_(True)).all()
    return [_to_admin_row(db, u) for u in admins]


@router.get("/staff", response_model=list[AdminRow])
def list_staff(staff: User = Depends(require_staff), db: Session = Depends(get_db)):
    members = db.query(User).filter(User.is_staff.is_(True)).all()
    return [_to_admin_row(db, u) for u in members]


SEARCH_RESULT_LIMIT = 10


@router.get("/users/search", response_model=list[AdminRow])
def search_users(query: str, staff: User = Depends(require_staff), db: Session = Depends(get_db)):
    """Matches on full name, display name, email, or GitHub username —
    whichever the caller typed. Any of these can be a partial, case-insensitive
    match; results are capped since this is meant to feed a live dropdown,
    not a full roster browse (that's what the members list is for)."""
    q = query.strip()
    if not q:
        return []
    like = f"%{q.lower()}%"
    full_name = func.lower(func.concat_ws(" ", Profile.first_name, Profile.last_name))
    users = (
        db.query(User)
        .outerjoin(Profile, Profile.user_id == User.id)
        .filter(
            or_(
                func.lower(User.email).like(like),
                func.lower(func.coalesce(User.github_login, "")).like(like),
                func.lower(func.coalesce(Profile.display_name, "")).like(like),
                full_name.like(like),
            )
        )
        .order_by(User.email)
        .limit(SEARCH_RESULT_LIMIT)
        .all()
    )
    return [_to_admin_row(db, u) for u in users]


def _send_admin_granted_email(user: User) -> None:
    # Promotion is a single click with no confirmation from the target's
    # side — this is the only way the newly-admin'd member finds out, short
    # of noticing new links in the nav, so a mistaken or unauthorized grant
    # doesn't go unnoticed by the one person best placed to flag it.
    html = render_email(
        eyebrow="account update",
        heading="You've been made an admin.",
        body_html=(
            "Another admin just granted your MUT Tech Community account admin access. "
            "If that doesn't sound right, let a fellow admin know."
        ),
        cta_label="Open admin panel",
        cta_url=f"{settings.web_origin}/admin",
    )
    try:
        email_service.send_email(to=user.email, subject="You've been made an admin — MUT Tech Community", html=html)
    except Exception:
        logger.warning("Failed to send admin-granted email to %s", user.email, exc_info=True)


@router.post("/users/{user_id}/make-admin", status_code=status.HTTP_204_NO_CONTENT)
def make_admin(user_id: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    target.is_admin = True
    audit.log(db, admin, "settings", f"Granted admin access to {target.email}")
    db.commit()
    _send_admin_granted_email(target)


@router.post("/users/{user_id}/remove-admin", status_code=status.HTTP_204_NO_CONTENT)
def remove_admin(user_id: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if target.id == admin.id and db.query(User).filter(User.is_admin.is_(True)).count() <= 1:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Can't remove the last admin")
    target.is_admin = False
    audit.log(db, admin, "settings", f"Removed admin access from {target.email}")
    db.commit()


@router.post("/users/{user_id}/make-staff", status_code=status.HTTP_204_NO_CONTENT)
def make_staff(user_id: str, staff: User = Depends(require_staff), db: Session = Depends(get_db)):
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    target.is_staff = True
    audit.log(db, staff, "roles", f"Granted staff access to {target.email}")
    db.commit()


@router.post("/users/{user_id}/remove-staff", status_code=status.HTTP_204_NO_CONTENT)
def remove_staff(user_id: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    target.is_staff = False
    audit.log(db, admin, "roles", f"Removed staff access from {target.email}")
    db.commit()
