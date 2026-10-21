from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user_optional
from app.core.rate_limit import limiter
from app.models.form import Form
from app.models.user import User
from app.schemas.form import (
    ChoiceItem,
    FormFieldPublic,
    FormPublic,
    SubmitResponseRequest,
)
from app.schemas.upload import FileUploadResponse
from app.services import forms as forms_service
from app.services import uploads as uploads_service

router = APIRouter(prefix="/forms", tags=["forms"])


def _get_form_or_404(db: Session, slug: str) -> Form:
    try:
        return forms_service.get_published_form(db, slug)
    except forms_service.FormError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


def _public(db: Session, form: Form) -> FormPublic:
    closed = form.closes_at is not None and datetime.now(UTC) >= form.closes_at
    return FormPublic(
        slug=form.slug,
        title=form.title,
        description=form.description,
        require_login=form.require_login,
        closed=closed,
        fields=[
            FormFieldPublic(
                id=f.id,
                type=f.type,
                prompt=f.prompt,
                help_text=f.help_text,
                required=f.required,
                choices=[ChoiceItem(**c) for c in f.choices],
            )
            for f in forms_service.list_fields(db, form)
        ],
    )


@router.get("/{slug}", response_model=FormPublic)
def get_form(slug: str, db: Session = Depends(get_db)):
    form = _get_form_or_404(db, slug)
    return _public(db, form)


@router.post("/{slug}/upload", response_model=FileUploadResponse)
@limiter.limit("30/hour")
def upload_form_file(
    request: Request,
    slug: str,
    file: UploadFile = File(...),
    user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """Host a file for a form's file_upload field; the returned URL is then
    submitted as that field's answer. Only works while the form is open and
    actually has such a field, so it can't be used as free file storage."""
    form = _get_form_or_404(db, slug)
    try:
        forms_service.ensure_accepting_responses(form, user)
        forms_service.ensure_has_file_field(db, form)
        url = uploads_service.upload_file(
            file.file.read(),
            file.content_type,
            folder="mut-tech/forms",
            allowed_types=uploads_service.FORM_ALLOWED_CONTENT_TYPES,
            max_bytes=uploads_service.FORM_MAX_UPLOAD_BYTES,
        )
    except forms_service.FormAccessDenied as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(exc)) from exc
    except (forms_service.FormError, uploads_service.UploadError) as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return FileUploadResponse(url=url)


@router.post("/{slug}/responses", status_code=status.HTTP_204_NO_CONTENT)
def submit_response(
    slug: str,
    payload: SubmitResponseRequest,
    user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    form = _get_form_or_404(db, slug)
    try:
        forms_service.submit_response(db, form, user, payload.answers)
    except forms_service.FormAccessDenied as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(exc)) from exc
    except forms_service.FormError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
