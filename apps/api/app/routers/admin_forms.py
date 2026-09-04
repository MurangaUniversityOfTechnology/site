import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import require_staff
from app.models.form import Form
from app.models.form_field import FormField
from app.models.user import User
from app.schemas.form import (
    AdminFieldRow,
    AdminFormRow,
    AdminResponseRow,
    AdminResponsesPage,
    ChoiceItem,
    FieldUpdateRequest,
    FieldWriteRequest,
    FormUpdateRequest,
    FormWriteRequest,
    ReorderRequest,
)
from app.services import forms as forms_service

router = APIRouter(prefix="/admin/forms", tags=["admin-forms"], dependencies=[Depends(require_staff)])


# ── row shaping ──────────────────────────────────────────────────────────


def _display_name(user: User) -> str:
    return user.profile.display_name if user.profile and user.profile.display_name else user.email


def _admin_form_row(db: Session, form: Form) -> AdminFormRow:
    return AdminFormRow(
        id=form.id,
        slug=form.slug,
        title=form.title,
        description=form.description,
        require_login=form.require_login,
        closes_at=form.closes_at,
        published_at=form.published_at,
        archived_at=form.archived_at,
        field_count=len(forms_service.list_fields(db, form)),
        response_count=len(forms_service.list_responses(db, form)),
        created_by=_display_name(form.created_by),
    )


def _admin_field_row(field: FormField) -> AdminFieldRow:
    return AdminFieldRow(
        id=field.id,
        form_id=field.form_id,
        type=field.type,
        prompt=field.prompt,
        help_text=field.help_text,
        required=field.required,
        choices=[ChoiceItem(**c) for c in field.choices],
        position=field.position,
    )


def _get_form_or_404(db: Session, slug: str) -> Form:
    try:
        return forms_service.get_form(db, slug)
    except forms_service.FormError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


def _get_field_or_404(db: Session, field_id: uuid.UUID) -> FormField:
    try:
        return forms_service.get_field(db, field_id)
    except forms_service.FormError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


# ── forms ────────────────────────────────────────────────────────────────


@router.get("", response_model=list[AdminFormRow])
def list_admin_forms(archived: bool = False, db: Session = Depends(get_db)):
    return [_admin_form_row(db, f) for f in forms_service.list_admin_forms(db, archived=archived)]


@router.post("", response_model=AdminFormRow, status_code=status.HTTP_201_CREATED)
def create_form(payload: FormWriteRequest, admin: User = Depends(require_staff), db: Session = Depends(get_db)):
    try:
        form = forms_service.create_form(db, admin, payload.model_dump())
    except forms_service.FormError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return _admin_form_row(db, form)


@router.patch("/{slug}", response_model=AdminFormRow)
def update_form(
    slug: str, payload: FormUpdateRequest, admin: User = Depends(require_staff), db: Session = Depends(get_db)
):
    form = _get_form_or_404(db, slug)
    try:
        form = forms_service.update_form(db, admin, form, payload.model_dump(exclude_unset=True))
    except forms_service.FormError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return _admin_form_row(db, form)


@router.delete("/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def delete_form(slug: str, admin: User = Depends(require_staff), db: Session = Depends(get_db)):
    form = _get_form_or_404(db, slug)
    try:
        forms_service.delete_form(db, admin, form)
    except forms_service.FormError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.post("/{slug}/publish", response_model=AdminFormRow)
def publish_form(slug: str, admin: User = Depends(require_staff), db: Session = Depends(get_db)):
    form = _get_form_or_404(db, slug)
    try:
        form = forms_service.publish_form(db, admin, form)
    except forms_service.FormError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return _admin_form_row(db, form)


@router.post("/{slug}/unpublish", response_model=AdminFormRow)
def unpublish_form(slug: str, admin: User = Depends(require_staff), db: Session = Depends(get_db)):
    form = _get_form_or_404(db, slug)
    try:
        form = forms_service.unpublish_form(db, admin, form)
    except forms_service.FormError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return _admin_form_row(db, form)


@router.post("/{slug}/archive", response_model=AdminFormRow)
def archive_form(slug: str, admin: User = Depends(require_staff), db: Session = Depends(get_db)):
    form = _get_form_or_404(db, slug)
    try:
        form = forms_service.archive_form(db, admin, form)
    except forms_service.FormError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return _admin_form_row(db, form)


@router.post("/{slug}/unarchive", response_model=AdminFormRow)
def unarchive_form(slug: str, admin: User = Depends(require_staff), db: Session = Depends(get_db)):
    form = _get_form_or_404(db, slug)
    try:
        form = forms_service.unarchive_form(db, admin, form)
    except forms_service.FormError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return _admin_form_row(db, form)


# ── fields ───────────────────────────────────────────────────────────────


@router.get("/{slug}/fields", response_model=list[AdminFieldRow])
def list_admin_fields(slug: str, db: Session = Depends(get_db)):
    form = _get_form_or_404(db, slug)
    return [_admin_field_row(f) for f in forms_service.list_fields(db, form)]


@router.post("/{slug}/fields", response_model=AdminFieldRow, status_code=status.HTTP_201_CREATED)
def create_field(
    slug: str, payload: FieldWriteRequest, admin: User = Depends(require_staff), db: Session = Depends(get_db)
):
    form = _get_form_or_404(db, slug)
    field = forms_service.create_field(db, admin, form, payload.model_dump())
    return _admin_field_row(field)


@router.patch("/fields/{field_id}", response_model=AdminFieldRow)
def update_field(
    field_id: uuid.UUID,
    payload: FieldUpdateRequest,
    admin: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    field = _get_field_or_404(db, field_id)
    field = forms_service.update_field(db, admin, field, payload.model_dump(exclude_unset=True))
    return _admin_field_row(field)


@router.delete("/fields/{field_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_field(field_id: uuid.UUID, admin: User = Depends(require_staff), db: Session = Depends(get_db)):
    field = _get_field_or_404(db, field_id)
    try:
        forms_service.delete_field(db, admin, field)
    except forms_service.FormError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.post("/fields/{field_id}/reorder", response_model=AdminFieldRow)
def reorder_field(
    field_id: uuid.UUID, payload: ReorderRequest, admin: User = Depends(require_staff), db: Session = Depends(get_db)
):
    field = _get_field_or_404(db, field_id)
    try:
        field = forms_service.reorder_field(db, admin, field, payload.direction)
    except forms_service.FormError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return _admin_field_row(field)


# ── responses ────────────────────────────────────────────────────────────


@router.get("/{slug}/responses", response_model=AdminResponsesPage)
def list_responses(slug: str, db: Session = Depends(get_db)):
    form = _get_form_or_404(db, slug)
    responses = [
        AdminResponseRow(
            id=r.id,
            respondent=forms_service.respondent_name(r),
            submitted_at=r.submitted_at,
            answers=r.answers,
        )
        for r in forms_service.list_responses(db, form)
    ]
    return AdminResponsesPage(responses=responses, tallies=forms_service.choice_tallies(db, form))


@router.get("/{slug}/responses/export")
def export_responses(slug: str, db: Session = Depends(get_db)):
    form = _get_form_or_404(db, slug)
    csv_text = forms_service.build_responses_csv(db, form)
    return StreamingResponse(
        iter([csv_text]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{form.slug}-responses.csv"'},
    )
