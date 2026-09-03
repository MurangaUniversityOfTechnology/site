from app.models.membership import MembershipStatus
from app.models.user import User


def is_active_member(user: User | None) -> bool:
    """Shared membership gate — admins always pass (same bypass as events'
    EventAudience.members_only check), everyone else needs an active
    membership. Accepts None so call sites with an optional/anonymous
    viewer (e.g. the member directory) don't need their own null check."""
    return bool(user and (user.is_admin or user.membership.status == MembershipStatus.active))
