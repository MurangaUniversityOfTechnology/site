import csv
import io
from datetime import UTC, datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.form import Form
from app.models.form_field import CHOICE_FIELD_TYPES, FormField
from app.models.form_response import FormResponse
from app.models.user import User
from app.schemas.form import AnswerItem
from app.services import audit


class FormError(Exception):
    pass


class FormAccessDenied(FormError):
    """Raised where a plain FormError would 404 — this maps to 403 instead,
    since the form genuinely exists, the caller just isn't allowed to see
    or answer it right now (not signed in, already responded)."""


# ── forms ────────────────────────────────────────────────────────────────


def get_form(db: Session, slug: str) -> Form:
    """Any status — used by admin authoring, which needs to reach drafts."""
    form = db.query(Form).filter(Form.slug == slug).first()
    if not form:
        raise FormError(f"Unknown form '{slug}'")
    return form


def get_published_form(db: Session, slug: str) -> Form:
    """Public read path — drafts and archived forms 404 exactly like an
    unknown slug, so a leaked draft link reveals nothing."""
    form = db.query(Form).filter(Form.slug == slug, Form.published_at.isnot(None), Form.archived_at.is_(None)).first()
    if not form:
        raise FormError(f"Unknown form '{slug}'")
    return form


def list_admin_forms(db: Session, archived: bool = False) -> list[Form]:
    query = db.query(Form).filter(Form.archived_at.isnot(None) if archived else Form.archived_at.is_(None))
    return query.order_by(Form.created_at.desc()).all()


def create_form(db: Session, admin: User, fields: dict) -> Form:
    if db.query(Form).filter(Form.slug == fields["slug"]).first():
        raise FormError(f"A form with slug '{fields['slug']}' already exists")
    form = Form(**fields, created_by_id=admin.id)
    db.add(form)
    audit.log(db, admin, "form", f"Created form {form.title}")
    db.commit()
    db.refresh(form)
    return form


def update_form(db: Session, admin: User, form: Form, fields: dict) -> Form:
    new_slug = fields.get("slug")
    if new_slug and new_slug != form.slug and db.query(Form).filter(Form.slug == new_slug).first():
        raise FormError(f"A form with slug '{new_slug}' already exists")
    for key, value in fields.items():
        setattr(form, key, value)
    audit.log(db, admin, "form", f"Updated form {form.title}")
    db.commit()
    db.refresh(form)
    return form


def delete_form(db: Session, admin: User, form: Form) -> None:
    count = db.query(FormResponse).filter(FormResponse.form_id == form.id).count()
    if count:
        raise FormError(f"Can't delete — {count} response(s) have already been recorded")
    audit.log(db, admin, "form", f"Deleted form {form.title}")
    db.delete(form)
    db.commit()


def publish_form(db: Session, admin: User, form: Form) -> Form:
    if form.published_at is not None:
        raise FormError("Form is already published")
    if not list_fields(db, form):
        raise FormError("Add at least one field before publishing")
    form.published_at = datetime.now(UTC)
    audit.log(db, admin, "form", f"Published form {form.title}")
    db.commit()
    db.refresh(form)
    return form


def unpublish_form(db: Session, admin: User, form: Form) -> Form:
    if form.published_at is None:
        raise FormError("Form is not published")
    form.published_at = None
    audit.log(db, admin, "form", f"Unpublished form {form.title}")
    db.commit()
    db.refresh(form)
    return form


def archive_form(db: Session, admin: User, form: Form) -> Form:
    if form.archived_at is not None:
        raise FormError("Form is already archived")
    form.archived_at = datetime.now(UTC)
    audit.log(db, admin, "form", f"Archived form {form.title}")
    db.commit()
    db.refresh(form)
    return form


def unarchive_form(db: Session, admin: User, form: Form) -> Form:
    if form.archived_at is None:
        raise FormError("Form is not archived")
    form.archived_at = None
    audit.log(db, admin, "form", f"Unarchived form {form.title}")
    db.commit()
    db.refresh(form)
    return form


# ── positions ────────────────────────────────────────────────────────────


def _swap_positions(db: Session, item: FormField, other: FormField) -> None:
    """Postgres checks UniqueConstraint(form_id, position) per-statement,
    not deferred — so a direct two-way swap would collide mid-transaction.
    Parking `item` on a temporary out-of-range value first avoids that.
    Same technique as services/course.py's _swap_positions."""
    item_pos, other_pos = item.position, other.position
    item.position = -1
    db.flush()
    other.position = item_pos
    db.flush()
    item.position = other_pos


def _reorder(db: Session, siblings: list[FormField], item: FormField, direction: str) -> None:
    idx = next(i for i, s in enumerate(siblings) if s.id == item.id)
    swap_idx = idx - 1 if direction == "up" else idx + 1
    if swap_idx < 0 or swap_idx >= len(siblings):
        raise FormError("Can't move further in that direction")
    _swap_positions(db, item, siblings[swap_idx])


# ── fields ───────────────────────────────────────────────────────────────


def list_fields(db: Session, form: Form) -> list[FormField]:
    return db.query(FormField).filter(FormField.form_id == form.id).order_by(FormField.position.asc()).all()


def get_field(db: Session, field_id) -> FormField:
    field = db.get(FormField, field_id)
    if not field:
        raise FormError("Unknown field")
    return field


def create_field(db: Session, admin: User, form: Form, fields: dict) -> FormField:
    max_pos = db.query(func.max(FormField.position)).filter(FormField.form_id == form.id).scalar() or 0
    field = FormField(form_id=form.id, position=max_pos + 1, **fields)
    db.add(field)
    audit.log(db, admin, "form", f"Added a field to form '{form.title}'")
    db.commit()
    db.refresh(field)
    return field


def update_field(db: Session, admin: User, field: FormField, fields: dict) -> FormField:
    for key, value in fields.items():
        setattr(field, key, value)
    audit.log(db, admin, "form", f"Updated a field in form '{field.form.title}'")
    db.commit()
    db.refresh(field)
    return field


def delete_field(db: Session, admin: User, field: FormField) -> None:
    if field.form.published_at is not None:
        raise FormError("Unpublish the form before deleting a field")
    audit.log(db, admin, "form", f"Deleted a field from form '{field.form.title}'")
    db.delete(field)
    db.commit()


def reorder_field(db: Session, admin: User, field: FormField, direction: str) -> FormField:
    _reorder(db, list_fields(db, field.form), field, direction)
    audit.log(db, admin, "form", f"Reordered a field in form '{field.form.title}'")
    db.commit()
    db.refresh(field)
    return field


# ── responses ────────────────────────────────────────────────────────────


def _validate_answers(fields: list[FormField], answers: list[AnswerItem]) -> None:
    by_id = {f.id: f for f in fields}
    answered = {a.field_id: a for a in answers if a.field_id in by_id}

    for field in fields:
        answer = answered.get(field.id)
        has_value = answer is not None and answer.value not in (None, "", [])
        if field.required and not has_value:
            raise FormError(f"'{field.prompt}' is required")
        if not has_value or field.type not in CHOICE_FIELD_TYPES:
            continue
        given = answer.value if isinstance(answer.value, list) else [answer.value]
        valid_ids = {c["id"] for c in field.choices}
        if not set(given) <= valid_ids:
            raise FormError(f"'{field.prompt}' got a choice that doesn't exist")
        if field.type in ("single_choice", "dropdown") and len(given) > 1:
            raise FormError(f"'{field.prompt}' only accepts one choice")


def submit_response(db: Session, form: Form, user: User | None, answers: list[AnswerItem]) -> FormResponse:
    if form.published_at is None or form.archived_at is not None:
        raise FormError("This form isn't accepting responses")
    if form.closes_at is not None and datetime.now(UTC) >= form.closes_at:
        raise FormError("This form is closed")
    if form.require_login and user is None:
        raise FormAccessDenied("Sign in to respond to this form")
    if user is not None:
        exists = (
            db.query(FormResponse).filter(FormResponse.form_id == form.id, FormResponse.user_id == user.id).first()
        )
        if exists:
            raise FormError("You've already responded to this form")

    _validate_answers(list_fields(db, form), answers)

    response = FormResponse(
        form_id=form.id,
        user_id=user.id if user else None,
        answers=[a.model_dump(mode="json") for a in answers],
    )
    db.add(response)
    db.commit()
    db.refresh(response)
    return response


def list_responses(db: Session, form: Form) -> list[FormResponse]:
    return (
        db.query(FormResponse).filter(FormResponse.form_id == form.id).order_by(FormResponse.submitted_at.desc()).all()
    )


def respondent_name(response: FormResponse) -> str:
    if not response.user:
        return "Anonymous"
    profile = response.user.profile
    return profile.display_name if profile and profile.display_name else response.user.email


def choice_tallies(db: Session, form: Form) -> dict[str, dict[str, int]]:
    """{field_id: {choice_id: count}} for every choice-type field — the raw
    material for the responses page's per-choice bars."""
    fields = [f for f in list_fields(db, form) if f.type in CHOICE_FIELD_TYPES]
    tallies = {str(f.id): {c["id"]: 0 for c in f.choices} for f in fields}

    for response in list_responses(db, form):
        for answer in response.answers:
            counts = tallies.get(answer["field_id"])
            if counts is None:
                continue
            for choice_id in answer["value"] if isinstance(answer["value"], list) else [answer["value"]]:
                if choice_id in counts:
                    counts[choice_id] += 1

    return tallies


def _format_answer(field: FormField, value) -> str:
    if value is None or value == "":
        return ""
    if field.type in CHOICE_FIELD_TYPES:
        labels = {c["id"]: c["text"] for c in field.choices}
        ids = value if isinstance(value, list) else [value]
        return ", ".join(labels.get(i, i) for i in ids)
    return str(value)


def build_responses_csv(db: Session, form: Form) -> str:
    fields = list_fields(db, form)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Submitted at", "Respondent", *(f.prompt for f in fields)])

    for response in list_responses(db, form):
        by_field_id = {a["field_id"]: a["value"] for a in response.answers}
        row = [response.submitted_at.isoformat(), respondent_name(response)]
        row.extend(_format_answer(field, by_field_id.get(str(field.id))) for field in fields)
        writer.writerow(row)

    return output.getvalue()
