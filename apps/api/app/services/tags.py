from sqlalchemy.orm import Session

from app.models.tag import Tag
from app.models.user import User
from app.models.user_tag import UserTag
from app.services import audit


class TagError(Exception):
    pass


def list_tags(db: Session) -> list[Tag]:
    return db.query(Tag).order_by(Tag.name.asc()).all()


def create_tag(db: Session, admin: User, name: str) -> Tag:
    name = name.strip()
    if not name:
        raise TagError("Tag name is required")
    if db.query(Tag).filter(Tag.name.ilike(name)).first():
        raise TagError(f"Tag '{name}' already exists")

    tag = Tag(name=name)
    db.add(tag)
    audit.log(db, admin, "tags", f"Created tag '{name}'")
    db.commit()
    db.refresh(tag)
    return tag


def rename_tag(db: Session, admin: User, tag: Tag, new_name: str) -> Tag:
    new_name = new_name.strip()
    if not new_name:
        raise TagError("Tag name is required")
    existing = db.query(Tag).filter(Tag.name.ilike(new_name), Tag.id != tag.id).first()
    if existing:
        raise TagError(f"Tag '{new_name}' already exists")

    old_name = tag.name
    tag.name = new_name
    audit.log(db, admin, "tags", f"Renamed tag '{old_name}' to '{new_name}'")
    db.commit()
    db.refresh(tag)
    return tag


def delete_tag(db: Session, admin: User, tag: Tag) -> None:
    audit.log(db, admin, "tags", f"Deleted tag '{tag.name}'")
    db.delete(tag)
    db.commit()


def list_member_tags(db: Session, user: User) -> list[Tag]:
    return (
        db.query(Tag)
        .join(UserTag, UserTag.tag_id == Tag.id)
        .filter(UserTag.user_id == user.id)
        .order_by(Tag.name.asc())
        .all()
    )


def assign_tag(db: Session, admin: User, user: User, tag: Tag) -> None:
    existing = db.query(UserTag).filter(UserTag.user_id == user.id, UserTag.tag_id == tag.id).first()
    if existing:
        return
    db.add(UserTag(user_id=user.id, tag_id=tag.id))
    audit.log(db, admin, "tags", f"Tagged {user.email} as '{tag.name}'")
    db.commit()


def unassign_tag(db: Session, admin: User, user: User, tag: Tag) -> None:
    link = db.query(UserTag).filter(UserTag.user_id == user.id, UserTag.tag_id == tag.id).first()
    if not link:
        return
    db.delete(link)
    audit.log(db, admin, "tags", f"Removed '{tag.name}' tag from {user.email}")
    db.commit()
