import re
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.models.membership import MembershipStatus
from app.models.project import Project
from app.models.project_join_request import JoinRequestStatus, ProjectJoinRequest
from app.models.project_member import ProjectMember
from app.models.user import User
from app.services import audit, notification
from app.services import github as github_service


class ProjectError(Exception):
    pass


def get_by_slug(db: Session, slug: str) -> Project | None:
    return db.query(Project).filter(Project.slug == slug).first()


def list_tracked_projects(db: Session, archived: bool = False) -> list[Project]:
    query = db.query(Project).filter(Project.archived_at.isnot(None) if archived else Project.archived_at.is_(None))
    return query.order_by(Project.name.asc()).all()


def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def add_project(db: Session, admin: User, repo_name: str, display_name: str | None) -> Project:
    repo_name = repo_name.strip()
    if not repo_name:
        raise ProjectError("Repo name is required")
    if db.query(Project).filter(Project.repo_name == repo_name).first():
        raise ProjectError(f"'{repo_name}' is already tracked")

    name = (display_name or "").strip() or repo_name
    slug = _slugify(name)
    if not slug:
        raise ProjectError("Couldn't derive a slug from that name")
    if db.query(Project).filter(Project.slug == slug).first():
        raise ProjectError(f"A project with slug '{slug}' already exists")

    try:
        github_service.fetch_repo(repo_name)
    except github_service.GithubError as exc:
        raise ProjectError(str(exc)) from exc

    settings = github_service.settings
    project = Project(slug=slug, name=name, repo_owner=settings.github_org, repo_name=repo_name)
    db.add(project)
    db.flush()
    github_service.sync_project(db, project)
    audit.log(db, admin, "project", f"Added tracked project {name} ({repo_name})")
    db.commit()
    db.refresh(project)
    return project


def remove_project(db: Session, admin: User, project: Project) -> None:
    audit.log(db, admin, "project", f"Removed tracked project {project.name}")
    db.delete(project)
    db.commit()


def mark_completed(db: Session, admin: User, project: Project) -> Project:
    if project.completed_at is not None:
        raise ProjectError("Project is already marked completed")
    project.completed_at = datetime.now(UTC)
    audit.log(db, admin, "project", f"Marked {project.name} as completed")
    db.commit()
    db.refresh(project)
    return project


def mark_active(db: Session, admin: User, project: Project) -> Project:
    if project.archived_at is not None:
        raise ProjectError("Unarchive the project before marking it active again")
    if project.completed_at is None:
        raise ProjectError("Project is not marked completed")
    project.completed_at = None
    audit.log(db, admin, "project", f"Marked {project.name} active again")
    db.commit()
    db.refresh(project)
    return project


def archive_project(db: Session, admin: User, project: Project) -> Project:
    if project.archived_at is not None:
        raise ProjectError("Project is already archived")
    if project.completed_at is None:
        raise ProjectError("Mark the project completed before archiving it")
    project.archived_at = datetime.now(UTC)
    audit.log(db, admin, "project", f"Archived project {project.name}")
    db.commit()
    db.refresh(project)
    return project


def unarchive_project(db: Session, admin: User, project: Project) -> Project:
    if project.archived_at is None:
        raise ProjectError("Project is not archived")
    project.archived_at = None
    audit.log(db, admin, "project", f"Unarchived project {project.name}")
    db.commit()
    db.refresh(project)
    return project


def list_members(db: Session, project: Project) -> list[ProjectMember]:
    return db.query(ProjectMember).filter(ProjectMember.project_id == project.id).all()


def is_member(db: Session, project: Project, user: User) -> bool:
    return (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project.id, ProjectMember.user_id == user.id)
        .first()
        is not None
    )


def my_request(db: Session, project: Project, user: User) -> ProjectJoinRequest | None:
    return (
        db.query(ProjectJoinRequest)
        .filter(ProjectJoinRequest.project_id == project.id, ProjectJoinRequest.user_id == user.id)
        .first()
    )


def request_join(
    db: Session, project: Project, user: User, contribution_areas: list[str], message: str | None
) -> ProjectJoinRequest:
    if project.completed_at is not None:
        raise ProjectError("This project is marked completed and isn't accepting new members")
    if not user.is_admin and not user.email_verified:
        raise ProjectError("Verify your email before joining a project")
    if not user.is_admin and (not user.membership or user.membership.status != MembershipStatus.active):
        raise ProjectError("Only active members can join a project")
    if is_member(db, project, user):
        raise ProjectError("Already a member of this project")
    if my_request(db, project, user):
        raise ProjectError("You've already requested to join this project")

    req = ProjectJoinRequest(
        project_id=project.id, user_id=user.id, contribution_areas=contribution_areas, message=message
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


def pending_queue(db: Session) -> list[ProjectJoinRequest]:
    return (
        db.query(ProjectJoinRequest)
        .filter(ProjectJoinRequest.status == JoinRequestStatus.pending)
        .order_by(ProjectJoinRequest.created_at.asc())
        .all()
    )


def approve_join(db: Session, admin: User, req: ProjectJoinRequest) -> None:
    if req.status != JoinRequestStatus.pending:
        raise ProjectError(f"Cannot approve from status '{req.status.value}'")

    req.status = JoinRequestStatus.approved
    db.add(ProjectMember(project_id=req.project_id, user_id=req.user_id))
    audit.log(db, admin, "project", f"Approved {req.user.email} joining {req.project.name}")
    notification.notify(db, req.user, "project", f"You're in on {req.project.name}", "Your join request was approved.")
    db.commit()


def reject_join(db: Session, admin: User, req: ProjectJoinRequest) -> None:
    if req.status != JoinRequestStatus.pending:
        raise ProjectError(f"Cannot reject from status '{req.status.value}'")

    req.status = JoinRequestStatus.rejected
    audit.log(db, admin, "project", f"Rejected {req.user.email} joining {req.project.name}")
    notification.notify(db, req.user, "project", f"Join request for {req.project.name} not approved", None)
    db.commit()
