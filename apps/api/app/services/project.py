import re

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
    if not user.membership or user.membership.status != MembershipStatus.active:
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
