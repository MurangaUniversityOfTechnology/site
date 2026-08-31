from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user, get_current_user_optional
from app.models.project import Project
from app.models.user import User
from app.schemas.project import (
    IssueSummary,
    JoinProjectRequest,
    JoinRequestResponse,
    ProjectDetail,
    ProjectSummary,
)
from app.services import project as project_service

router = APIRouter(prefix="/projects", tags=["projects"])


def _name(u: User) -> str:
    return u.profile.display_name if u.profile and u.profile.display_name else u.email


@router.get("", response_model=list[ProjectSummary])
def list_projects(db: Session = Depends(get_db)):
    return db.query(Project).filter(Project.archived_at.is_(None)).order_by(Project.name.asc()).all()


@router.get("/archived", response_model=list[ProjectSummary])
def list_archived_projects(db: Session = Depends(get_db)):
    return db.query(Project).filter(Project.archived_at.isnot(None)).order_by(Project.name.asc()).all()


@router.get("/{slug}", response_model=ProjectDetail)
def get_project(slug: str, user: User | None = Depends(get_current_user_optional), db: Session = Depends(get_db)):
    project = project_service.get_by_slug(db, slug)
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")

    members = project_service.list_members(db, project)
    my_request = project_service.my_request(db, project, user) if user else None

    return ProjectDetail(
        slug=project.slug,
        name=project.name,
        description=project.description,
        language=project.language,
        topics=project.topics,
        stars=project.stars,
        open_issues_count=project.open_issues_count,
        completed_at=project.completed_at,
        github_url=project.github_url,
        synced_at=project.synced_at,
        issues=[IssueSummary(**i) for i in project.cached_issues],
        members=[_name(m.user) for m in members],
        member_count=len(members),
        is_member=any(m.user_id == user.id for m in members) if user else False,
        my_request_status=my_request.status.value if my_request else None,
    )


@router.post("/{slug}/join", response_model=JoinRequestResponse, status_code=status.HTTP_201_CREATED)
def join_project(
    slug: str, payload: JoinProjectRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    project = project_service.get_by_slug(db, slug)
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")

    try:
        req = project_service.request_join(db, project, user, payload.contribution_areas, payload.message)
    except project_service.ProjectError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return req
