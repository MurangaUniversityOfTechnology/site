import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.models.form_field import CHOICE_FIELD_TYPES

# Keep this in lockstep with FIELD_TYPES in models/form_field.py.
FieldType = Literal[
    "short_text", "long_text", "single_choice", "multi_choice", "dropdown", "yes_no", "rating", "date", "number", "email"
]


class ChoiceItem(BaseModel):
    id: str
    text: str


# ── public ───────────────────────────────────────────────────────────────


class FormFieldPublic(BaseModel):
    id: uuid.UUID
    type: FieldType
    prompt: str
    help_text: str | None
    required: bool
    choices: list[ChoiceItem]


class FormPublic(BaseModel):
    slug: str
    title: str
    description: str
    require_login: bool
    # True once closes_at has passed — the form still renders (read-only)
    # instead of 404ing, same reasoning a closed Google Form still shows.
    closed: bool
    fields: list[FormFieldPublic]


class AnswerItem(BaseModel):
    field_id: uuid.UUID
    # str for text/date/email/number, list[str] of choice ids for
    # choice-types, bool for yes_no, int for rating.
    value: str | int | bool | list[str] | None


class SubmitResponseRequest(BaseModel):
    answers: list[AnswerItem]


# ── admin ────────────────────────────────────────────────────────────────


class FormWriteRequest(BaseModel):
    slug: str
    title: str
    description: str = ""
    require_login: bool = True
    closes_at: datetime | None = None


class FormUpdateRequest(BaseModel):
    slug: str | None = None
    title: str | None = None
    description: str | None = None
    require_login: bool | None = None
    closes_at: datetime | None = None


class AdminFormRow(BaseModel):
    id: uuid.UUID
    slug: str
    title: str
    description: str
    require_login: bool
    closes_at: datetime | None
    published_at: datetime | None
    archived_at: datetime | None
    field_count: int
    response_count: int
    created_by: str


class FieldWriteRequest(BaseModel):
    type: FieldType
    prompt: str
    help_text: str | None = None
    required: bool = True
    choices: list[ChoiceItem] = Field(default_factory=list)

    @model_validator(mode="after")
    def _choices_match_type(self) -> "FieldWriteRequest":
        if self.type in CHOICE_FIELD_TYPES:
            if not (2 <= len(self.choices) <= 5):
                raise ValueError("Choice fields need 2-5 choices")
        elif self.choices:
            raise ValueError(f"'{self.type}' fields don't take choices")
        return self


class FieldUpdateRequest(BaseModel):
    type: FieldType | None = None
    prompt: str | None = None
    help_text: str | None = None
    required: bool | None = None
    choices: list[ChoiceItem] | None = None

    @model_validator(mode="after")
    def _choices_match_type(self) -> "FieldUpdateRequest":
        if self.type in CHOICE_FIELD_TYPES and self.choices is not None and not (2 <= len(self.choices) <= 5):
            raise ValueError("Choice fields need 2-5 choices")
        return self


class AdminFieldRow(BaseModel):
    id: uuid.UUID
    form_id: uuid.UUID
    type: FieldType
    prompt: str
    help_text: str | None
    required: bool
    choices: list[ChoiceItem]
    position: int


class ReorderRequest(BaseModel):
    direction: Literal["up", "down"]


class AdminResponseRow(BaseModel):
    id: uuid.UUID
    respondent: str
    submitted_at: datetime
    answers: list[AnswerItem]


class AdminResponsesPage(BaseModel):
    responses: list[AdminResponseRow]
    # {field_id: {choice_id: count}} — only choice-type fields are present.
    tallies: dict[str, dict[str, int]]
