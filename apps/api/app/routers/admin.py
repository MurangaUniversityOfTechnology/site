from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import require_admin
from app.models.audit_log import AuditLog
from app.models.content import Content
from app.models.event import Event
from app.models.event_registration import EventRegistration
from app.models.membership import Membership, MembershipStatus
from app.models.payment import Payment, PaymentStatus
from app.models.project import Project
from app.models.project_join_request import ProjectJoinRequest
from app.models.tag import Tag
from app.models.user import User
from app.schemas.admin import (
    AddMemberRequest,
    AddMemberResponse,
    AdminOverview,
    AdminRow,
    AuditEntry,
    ImportMemberResult,
    ImportMembersRequest,
    ImportMembersResponse,
    MembershipApplication,
    PaymentRow,
    PaymentsOverview,
    PaymentTotal,
)
from app.schemas.content import AdminContentRow
from app.schemas.event import (
    AdminEventRow,
    AdminRegistrationRow,
    EventUpdateRequest,
    EventWriteRequest,
)
from app.schemas.github import RosterRow
from app.schemas.project import AddProjectRequest, AdminJoinRequestRow, AdminProjectRow
from app.schemas.tag import AssignTagRequest, CreateTagRequest, RenameTagRequest, TagRow
from app.services import audit
from app.services import content as content_service
from app.services import event as event_service
from app.services import github as github_service
from app.services import membership as membership_service
from app.services import project as project_service
from app.services import tags as tag_service

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])

STATUS_FILTERS = {
    "active": [MembershipStatus.active],
    "all": None,
}


@router.get("/overview", response_model=AdminOverview)
def overview(db: Session = Depends(get_db)):
    week_ago = (datetime.now(UTC) - timedelta(days=7)).date()
    return AdminOverview(
        total_members=db.query(Membership).filter(Membership.status == MembershipStatus.active).count(),
        new_this_week=db.query(Membership)
        .filter(Membership.status == MembershipStatus.active, Membership.period_start >= week_ago)
        .count(),
        unmatched_payments=db.query(Payment)
        .filter(Payment.status.in_([PaymentStatus.pending, PaymentStatus.failed]))
        .count(),
    )


@router.get("/memberships", response_model=list[MembershipApplication])
def list_memberships(status_filter: str = "active", db: Session = Depends(get_db)):
    statuses = STATUS_FILTERS.get(status_filter, STATUS_FILTERS["active"])
    query = db.query(Membership)
    if statuses is not None:
        query = query.filter(Membership.status.in_(statuses))

    out = []
    for m in query.all():
        user = m.user
        profile = user.profile
        payment = membership_service.latest_payment(db, user)
        name = " ".join(part for part in [profile.first_name, profile.last_name] if part) if profile else ""
        out.append(
            MembershipApplication(
                user_id=user.id,
                name=name or user.email,
                email=user.email,
                course=profile.course if profile else None,
                year_of_study=profile.year_of_study if profile else None,
                registration_number=profile.registration_number if profile else None,
                payment_amount=float(payment.amount) if payment else None,
                payment_receipt=payment.mpesa_receipt if payment else None,
                payment_status=payment.status.value if payment else None,
                membership_status=m.status.value,
            )
        )
    return out


@router.get("/payments", response_model=PaymentsOverview)
def payments_overview(db: Session = Depends(get_db)):
    def total_for(*statuses: PaymentStatus) -> PaymentTotal:
        rows = db.query(Payment).filter(Payment.status.in_(statuses)).all()
        return PaymentTotal(
            label=statuses[0].value,
            amount_kes=float(sum(p.amount for p in rows)),
            count=len(rows),
        )

    totals = [
        total_for(PaymentStatus.completed),
        total_for(PaymentStatus.pending, PaymentStatus.initiated),
        total_for(PaymentStatus.failed, PaymentStatus.cancelled),
    ]

    rows = db.query(Payment).order_by(Payment.created_at.desc()).limit(50).all()
    payment_rows = [
        PaymentRow(
            receipt=p.mpesa_receipt,
            member=p.user.email,
            amount=float(p.amount),
            status=p.status.value,
        )
        for p in rows
    ]
    return PaymentsOverview(totals=totals, rows=payment_rows)


@router.get("/audit", response_model=list[AuditEntry])
def audit_log(db: Session = Depends(get_db)):
    entries = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(100).all()
    return [AuditEntry(at=e.created_at, who=e.actor_name, what=e.action, kind=e.kind) for e in entries]


# ── events (admin CRUD) ──────────────────────────────────────────────


def _admin_event_row(db: Session, event: Event) -> AdminEventRow:
    count = db.query(EventRegistration).filter(EventRegistration.event_id == event.id).count()
    return AdminEventRow(
        id=event.id,
        slug=event.slug,
        title=event.title,
        starts_at=event.starts_at,
        venue=event.venue,
        description=event.description,
        audience=event.audience,
        fee_kes=event.fee_kes,
        capacity=event.capacity,
        seats_left=event_service.seats_left(db, event),
        what_youll_build=event.what_youll_build,
        schedule=event.schedule,
        speaker_name=event.speaker_name,
        speaker_meta=event.speaker_meta,
        requirements=event.requirements,
        who_should_attend=event.who_should_attend,
        registration_count=count,
        archived_at=event.archived_at,
    )


@router.get("/events", response_model=list[AdminEventRow])
def list_admin_events(archived: bool = False, db: Session = Depends(get_db)):
    return [_admin_event_row(db, e) for e in event_service.list_events(db, archived=archived)]


@router.post("/events", response_model=AdminEventRow, status_code=status.HTTP_201_CREATED)
def create_event(payload: EventWriteRequest, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    try:
        event = event_service.create_event(db, admin, payload.model_dump())
    except event_service.EventError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return _admin_event_row(db, event)


def _get_event_or_404(db: Session, slug: str) -> Event:
    try:
        return event_service.get_event(db, slug)
    except event_service.EventError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


@router.patch("/events/{slug}", response_model=AdminEventRow)
def update_event(
    slug: str, payload: EventUpdateRequest, admin: User = Depends(require_admin), db: Session = Depends(get_db)
):
    event = _get_event_or_404(db, slug)
    try:
        event = event_service.update_event(db, admin, event, payload.model_dump(exclude_unset=True))
    except event_service.EventError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return _admin_event_row(db, event)


@router.delete("/events/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(slug: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    event = _get_event_or_404(db, slug)
    try:
        event_service.delete_event(db, admin, event)
    except event_service.EventError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.post("/events/{slug}/archive", response_model=AdminEventRow)
def archive_event(slug: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    event = _get_event_or_404(db, slug)
    try:
        event = event_service.archive_event(db, admin, event)
    except event_service.EventError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return _admin_event_row(db, event)


@router.post("/events/{slug}/unarchive", response_model=AdminEventRow)
def unarchive_event(slug: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    event = _get_event_or_404(db, slug)
    try:
        event = event_service.unarchive_event(db, admin, event)
    except event_service.EventError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return _admin_event_row(db, event)


@router.get("/events/{slug}/registrations", response_model=list[AdminRegistrationRow])
def list_registrations(slug: str, db: Session = Depends(get_db)):
    try:
        registrations = event_service.list_for_event(db, slug)
    except event_service.EventError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc

    rows = []
    for r in registrations:
        if r.user:
            profile = r.user.profile
            name = " ".join(part for part in [profile.first_name, profile.last_name] if part) if profile else r.user.email
            detail = f"registered {r.created_at:%d %b %H:%M}"
            member = True
        else:
            name = r.guest_name or "Guest"
            detail = r.guest_email or ""
            member = False
        rows.append(AdminRegistrationRow(id=r.id, name=name or r.user.email, detail=detail, member=member, status=r.status.value))
    return rows


def _get_registration(db: Session, registration_id: str) -> EventRegistration:
    reg = db.get(EventRegistration, registration_id)
    if not reg:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Registration not found")
    return reg


@router.post("/registrations/{registration_id}/approve", status_code=status.HTTP_204_NO_CONTENT)
def approve_registration(registration_id: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    reg = _get_registration(db, registration_id)
    try:
        event_service.approve(db, admin, reg)
    except event_service.EventError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.post("/registrations/{registration_id}/reject", status_code=status.HTTP_204_NO_CONTENT)
def reject_registration(registration_id: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    reg = _get_registration(db, registration_id)
    try:
        event_service.reject(db, admin, reg)
    except event_service.EventError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.post("/registrations/{registration_id}/waitlist", status_code=status.HTTP_204_NO_CONTENT)
def waitlist_registration(registration_id: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    reg = _get_registration(db, registration_id)
    try:
        event_service.waitlist(db, admin, reg)
    except event_service.EventError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.post("/registrations/{registration_id}/attend", status_code=status.HTTP_204_NO_CONTENT)
def attend_registration(registration_id: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    reg = _get_registration(db, registration_id)
    try:
        event_service.mark_attended(db, admin, reg)
    except event_service.EventError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


# ── content moderation ──────────────────────────────────────────────


def _content_row(c: Content) -> AdminContentRow:
    profile = c.author.profile
    author = (profile.display_name if profile and profile.display_name else c.author.email)
    return AdminContentRow(id=c.id, title=c.title, body=c.body, author=author, when=c.created_at)


@router.get("/content", response_model=list[AdminContentRow])
def content_queue(db: Session = Depends(get_db)):
    return [_content_row(c) for c in content_service.pending_queue(db)]


def _get_content(db: Session, content_id: str) -> Content:
    c = db.get(Content, content_id)
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Article not found")
    return c


@router.post("/content/{content_id}/publish", status_code=status.HTTP_204_NO_CONTENT)
def publish_content(content_id: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    c = _get_content(db, content_id)
    try:
        content_service.publish(db, admin, c)
    except content_service.ContentError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.post("/content/{content_id}/reject", status_code=status.HTTP_204_NO_CONTENT)
def reject_content(content_id: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    c = _get_content(db, content_id)
    try:
        content_service.reject(db, admin, c)
    except content_service.ContentError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.post("/content/{content_id}/request-changes", status_code=status.HTTP_204_NO_CONTENT)
def request_content_changes(content_id: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    c = _get_content(db, content_id)
    try:
        content_service.request_changes(db, admin, c)
    except content_service.ContentError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


# ── roles ────────────────────────────────────────────────────────────


def _to_admin_row(db: Session, u: User) -> AdminRow:
    return AdminRow(
        user_id=u.id,
        name=(u.profile.display_name if u.profile and u.profile.display_name else u.email),
        email=u.email,
        is_admin=u.is_admin,
        tags=tag_service.list_member_tags(db, u),
    )


@router.get("/admins", response_model=list[AdminRow])
def list_admins(db: Session = Depends(get_db)):
    admins = db.query(User).filter(User.is_admin.is_(True)).all()
    return [_to_admin_row(db, u) for u in admins]


@router.get("/users/search", response_model=AdminRow | None)
def search_user(email: str, db: Session = Depends(get_db)):
    u = db.query(User).filter(User.email == email.lower()).first()
    if not u:
        return None
    return _to_admin_row(db, u)


@router.post("/users/{user_id}/make-admin", status_code=status.HTTP_204_NO_CONTENT)
def make_admin(user_id: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    target.is_admin = True
    audit.log(db, admin, "settings", f"Granted admin access to {target.email}")
    db.commit()


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


# ── tags ─────────────────────────────────────────────────────────────


@router.get("/tags", response_model=list[TagRow])
def list_tags(db: Session = Depends(get_db)):
    return tag_service.list_tags(db)


@router.post("/tags", response_model=TagRow, status_code=status.HTTP_201_CREATED)
def create_tag(payload: CreateTagRequest, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    try:
        return tag_service.create_tag(db, admin, payload.name)
    except tag_service.TagError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


def _get_tag_or_404(db: Session, tag_id: str) -> Tag:
    tag = db.get(Tag, tag_id)
    if not tag:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tag not found")
    return tag


@router.patch("/tags/{tag_id}", response_model=TagRow)
def rename_tag(
    tag_id: str, payload: RenameTagRequest, admin: User = Depends(require_admin), db: Session = Depends(get_db)
):
    tag = _get_tag_or_404(db, tag_id)
    try:
        return tag_service.rename_tag(db, admin, tag, payload.name)
    except tag_service.TagError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.delete("/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tag(tag_id: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    tag = _get_tag_or_404(db, tag_id)
    tag_service.delete_tag(db, admin, tag)


@router.post("/users/{user_id}/tags", response_model=AdminRow)
def assign_tag(
    user_id: str, payload: AssignTagRequest, admin: User = Depends(require_admin), db: Session = Depends(get_db)
):
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    tag = _get_tag_or_404(db, str(payload.tag_id))
    tag_service.assign_tag(db, admin, target, tag)
    return _to_admin_row(db, target)


@router.delete("/users/{user_id}/tags/{tag_id}", response_model=AdminRow)
def unassign_tag(user_id: str, tag_id: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    tag = _get_tag_or_404(db, tag_id)
    tag_service.unassign_tag(db, admin, target, tag)
    return _to_admin_row(db, target)


# ── add member without payment ──────────────────────────────────────


@router.post("/members/add", response_model=AddMemberResponse, status_code=status.HTTP_201_CREATED)
def add_member(payload: AddMemberRequest, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    try:
        user, temp_password = membership_service.admin_add_member(
            db,
            admin,
            payload.email,
            payload.display_name,
            payload.registration_number,
            payload.github_handle,
            payload.reason,
            payload.password,
            payload.activation,
            payload.phone,
            payload.mpesa_receipt,
            payload.amount_kes,
        )
    except membership_service.MembershipError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

    return AddMemberResponse(
        user_id=user.id,
        email=user.email,
        temp_password=temp_password,
        membership_status=user.membership.status.value,
    )


@router.post("/members/import", response_model=ImportMembersResponse)
def import_members(payload: ImportMembersRequest, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    results = []
    for row in payload.rows:
        try:
            membership_service.admin_add_member(
                db,
                admin,
                row.email,
                row.display_name,
                row.registration_number,
                None,
                "Migrated from legacy list",
                None,
                "active",
                None,
            )
            results.append(ImportMemberResult(email=row.email, status="created"))
        except membership_service.MembershipError as exc:
            db.rollback()
            results.append(ImportMemberResult(email=row.email, status="error", error=str(exc)))
    return ImportMembersResponse(results=results)


# ── tracked projects (admin CRUD) ─────────────────────────────────────


def _admin_project_row(db: Session, project: Project) -> AdminProjectRow:
    return AdminProjectRow(
        slug=project.slug,
        name=project.name,
        repo_name=project.repo_name,
        github_url=project.github_url,
        language=project.language,
        stars=project.stars,
        member_count=len(project_service.list_members(db, project)),
        synced_at=project.synced_at,
        completed_at=project.completed_at,
        archived_at=project.archived_at,
    )


@router.get("/projects", response_model=list[AdminProjectRow])
def list_tracked_projects(archived: bool = False, db: Session = Depends(get_db)):
    projects = project_service.list_tracked_projects(db, archived=archived)
    return [_admin_project_row(db, p) for p in projects]


@router.post("/projects", response_model=AdminProjectRow, status_code=status.HTTP_201_CREATED)
def add_project(payload: AddProjectRequest, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    try:
        project = project_service.add_project(db, admin, payload.repo_name, payload.display_name)
    except project_service.ProjectError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return _admin_project_row(db, project)


def _get_project_or_404(db: Session, slug: str) -> Project:
    project = project_service.get_by_slug(db, slug)
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    return project


@router.delete("/projects/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def remove_project(slug: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    project = _get_project_or_404(db, slug)
    project_service.remove_project(db, admin, project)


@router.post("/projects/{slug}/complete", response_model=AdminProjectRow)
def complete_project(slug: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    project = _get_project_or_404(db, slug)
    try:
        project = project_service.mark_completed(db, admin, project)
    except project_service.ProjectError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return _admin_project_row(db, project)


@router.post("/projects/{slug}/activate", response_model=AdminProjectRow)
def activate_project(slug: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    project = _get_project_or_404(db, slug)
    try:
        project = project_service.mark_active(db, admin, project)
    except project_service.ProjectError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return _admin_project_row(db, project)


@router.post("/projects/{slug}/archive", response_model=AdminProjectRow)
def archive_project(slug: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    project = _get_project_or_404(db, slug)
    try:
        project = project_service.archive_project(db, admin, project)
    except project_service.ProjectError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return _admin_project_row(db, project)


@router.post("/projects/{slug}/unarchive", response_model=AdminProjectRow)
def unarchive_project(slug: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    project = _get_project_or_404(db, slug)
    try:
        project = project_service.unarchive_project(db, admin, project)
    except project_service.ProjectError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return _admin_project_row(db, project)


# ── project join requests ───────────────────────────────────────────


@router.get("/projects/join-requests", response_model=list[AdminJoinRequestRow])
def project_join_requests(db: Session = Depends(get_db)):
    return [
        AdminJoinRequestRow(
            id=r.id,
            project_slug=r.project.slug,
            project_name=r.project.name,
            user_email=r.user.email,
            user_name=(r.user.profile.display_name if r.user.profile and r.user.profile.display_name else r.user.email),
            contribution_areas=r.contribution_areas,
            message=r.message,
            created_at=r.created_at,
        )
        for r in project_service.pending_queue(db)
    ]


def _get_join_request(db: Session, request_id: str) -> ProjectJoinRequest:
    r = db.get(ProjectJoinRequest, request_id)
    if not r:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Join request not found")
    return r


@router.post("/projects/join-requests/{request_id}/approve", status_code=status.HTTP_204_NO_CONTENT)
def approve_join_request(request_id: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    r = _get_join_request(db, request_id)
    try:
        project_service.approve_join(db, admin, r)
    except project_service.ProjectError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.post("/projects/join-requests/{request_id}/reject", status_code=status.HTTP_204_NO_CONTENT)
def reject_join_request(request_id: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    r = _get_join_request(db, request_id)
    try:
        project_service.reject_join(db, admin, r)
    except project_service.ProjectError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.post("/projects/sync", status_code=status.HTTP_204_NO_CONTENT)
def sync_projects(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    audit.log(db, admin, "project", "Triggered a GitHub project sync")
    db.commit()
    github_service.sync_all_projects(db)


# ── github roster ────────────────────────────────────────────────────


@router.get("/github/roster", response_model=list[RosterRow])
def github_roster(db: Session = Depends(get_db)):
    users = (
        db.query(User)
        .join(Membership)
        .filter(Membership.status == MembershipStatus.active)
        .order_by(User.email.asc())
        .all()
    )
    return [
        RosterRow(
            user_id=u.id,
            name=(u.profile.display_name if u.profile and u.profile.display_name else u.email),
            email=u.email,
            github_login=u.github_login,
            invite_status=u.github_org_invite_status.value,
        )
        for u in users
    ]


@router.post("/github/roster/{user_id}/refresh", response_model=RosterRow)
def refresh_roster_row(user_id: str, db: Session = Depends(get_db)):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    github_service.refresh_invite_status(db, u)
    return RosterRow(
        user_id=u.id,
        name=(u.profile.display_name if u.profile and u.profile.display_name else u.email),
        email=u.email,
        github_login=u.github_login,
        invite_status=u.github_org_invite_status.value,
    )


@router.post("/github/roster/{user_id}/resend-invite", status_code=status.HTTP_204_NO_CONTENT)
def resend_invite(user_id: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    try:
        github_service.resend_invite(db, u)
    except github_service.GithubError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    audit.log(db, admin, "project", f"Re-sent GitHub org invite to {u.email}")
    db.commit()
