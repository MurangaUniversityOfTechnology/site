from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.user import User


def log(db: Session, actor: User, kind: str, action: str) -> None:
    actor_name = actor.profile.display_name if actor.profile and actor.profile.display_name else actor.email
    db.add(AuditLog(actor_id=actor.id, actor_name=actor_name, kind=kind, action=action))
