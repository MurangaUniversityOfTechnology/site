from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import require_admin
from app.models.audit_log import AuditLog
from app.models.content import Content
from app.models.event_registration import EventRegistration
from app.models.membership import Membership, MembershipStatus
from app.models.payment import Payment, PaymentStatus
from app.models.project_join_request import ProjectJoinRequest
from app.models.user import User
from app.schemas.admin import (
    AddMemberRequest,
    AddMemberResponse,
    AdminOverview,
    AdminRow,
    AuditEntry,
    MembershipApplication,
    PaymentRow,
    PaymentsOverview,
    PaymentTotal,
)
from app.schemas.content import AdminContentRow
from app.schemas.event import AdminRegistrationRow
from app.schemas.github import RosterRow
from app.schemas.project import AdminJoinRequestRow
from app.services import audit
from app.services import content as content_service
from app.services import event as event_service
from app.services import github as github_service
from app.services import membership as membership_service
from app.services import project as project_service

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])

STATUS_FILTERS = {
    "pending": [MembershipStatus.approval_pending],
    "active": [MembershipStatus.active],
    "rejected": [MembershipStatus.rejected],
    "all": None,
}


@router.get("/overview", response_model=AdminOverview)
def overview(db: Session = Depends(get_db)):
    week_ago = datetime.now(UTC) - timedelta(days=7)
    return AdminOverview(
        total_members=db.query(Membership).filter(Membership.status == MembershipStatus.active).count(),
        pending_approval=db.query(Membership).filter(Membership.status == MembershipStatus.approval_pending).count(),
        new_this_week=db.query(User).filter(User.created_at >= week_ago).count(),
        unmatched_payments=db.query(Payment)
        .filter(Payment.status.in_([PaymentStatus.pending, PaymentStatus.failed]))
        .count(),
    )


@router.get("/memberships", response_model=list[MembershipApplication])
def list_memberships(status_filter: str = "pending", db: Session = Depends(get_db)):
    statuses = STATUS_FILTERS.get(status_filter, STATUS_FILTERS["pending"])
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


@router.post("/memberships/{user_id}/approve", status_code=status.HTTP_204_NO_CONTENT)
def approve_membership(user_id: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    applicant = db.get(User, user_id)
    if not applicant:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    try:
        membership_service.approve(db, admin, applicant)
    except membership_service.MembershipError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.post("/memberships/{user_id}/reject", status_code=status.HTTP_204_NO_CONTENT)
def reject_membership(user_id: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    applicant = db.get(User, user_id)
    if not applicant:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    try:
        membership_service.reject(db, admin, applicant)
    except membership_service.MembershipError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


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


@router.get("/admins", response_model=list[AdminRow])
def list_admins(db: Session = Depends(get_db)):
    admins = db.query(User).filter(User.is_admin.is_(True)).all()
    return [
        AdminRow(
            user_id=u.id,
            name=(u.profile.display_name if u.profile and u.profile.display_name else u.email),
            email=u.email,
            is_admin=True,
        )
        for u in admins
    ]


@router.get("/users/search", response_model=AdminRow | None)
def search_user(email: str, db: Session = Depends(get_db)):
    u = db.query(User).filter(User.email == email.lower()).first()
    if not u:
        return None
    return AdminRow(
        user_id=u.id,
        name=(u.profile.display_name if u.profile and u.profile.display_name else u.email),
        email=u.email,
        is_admin=u.is_admin,
    )


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
        )
    except membership_service.MembershipError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

    return AddMemberResponse(user_id=user.id, email=user.email, temp_password=temp_password)


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
