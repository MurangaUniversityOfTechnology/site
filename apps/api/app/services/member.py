from sqlalchemy.orm import Session

from app.models.membership import MembershipStatus
from app.models.profile import Profile, ProfileVisibility
from app.models.user import User


class MemberError(Exception):
    pass


def _viewer_is_active_member(viewer: User | None) -> bool:
    return bool(viewer and (viewer.is_admin or viewer.membership.status == MembershipStatus.active))


def directory(db: Session, viewer: User | None) -> list[Profile]:
    visible = [ProfileVisibility.public]
    if _viewer_is_active_member(viewer):
        visible.append(ProfileVisibility.members)

    return (
        db.query(Profile)
        .filter(Profile.visibility.in_(visible), Profile.display_name.isnot(None))
        .order_by(Profile.display_name.asc())
        .all()
    )


def get_profile(db: Session, user_id: str, viewer: User | None) -> Profile:
    profile = db.get(Profile, user_id)
    if not profile or not profile.display_name:
        raise MemberError("Member not found")

    is_owner = bool(viewer and str(viewer.id) == str(user_id))
    if is_owner:
        return profile

    if profile.visibility == ProfileVisibility.private:
        raise MemberError("This profile is private")
    if profile.visibility == ProfileVisibility.members and not _viewer_is_active_member(viewer):
        raise MemberError("Sign in with an active membership to view this profile")

    return profile
