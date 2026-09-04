from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user_optional
from app.models.form import Form
from app.models.user import User
from app.schemas.form import (
    ChoiceItem,
    FormFieldPublic,
    FormPublic,
    SubmitResponseRequest,
)
from app.services import forms as forms_service

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
