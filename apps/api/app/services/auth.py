from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.membership import Membership, MembershipStatus
from app.models.profile import Profile
from app.models.user import User


def create_user(db: Session, email: str, password: str | None, google_sub: str | None = None) -> User:
    user = User(
        email=email.strip().lower(),
        password_hash=hash_password(password) if password else None,
        google_sub=google_sub,
        email_verified=google_sub is not None,
    )
    db.add(user)
    db.flush()

    db.add(Profile(user_id=user.id))
    db.add(Membership(user_id=user.id, status=MembershipStatus.none))
    db.commit()
    db.refresh(user)
    return user


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email.strip().lower()).first()


def get_user_by_google_sub(db: Session, google_sub: str) -> User | None:
    return db.query(User).filter(User.google_sub == google_sub).first()


def get_user_by_github_id(db: Session, github_id: int) -> User | None:
    return db.query(User).filter(User.github_id == github_id).first()
