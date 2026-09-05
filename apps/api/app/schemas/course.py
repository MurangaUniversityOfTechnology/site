import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.models.course_quiz import QuizKind
from app.schemas.arm import ArmRow

# ── public / member ─────────────────────────────────────────────────────


class CourseSummary(BaseModel):
    slug: str
    title: str
    short_description: str
    cover_image_url: str | None
    price_kes: int
    difficulty: int
    module_count: int
    arms: list[ArmRow]

    model_config = {"from_attributes": True}


class LessonPublic(BaseModel):
    id: uuid.UUID
    title: str
    position: int
    locked: bool
    completed: bool


class ModulePublic(BaseModel):
    id: uuid.UUID
    title: str
    summary: str | None
    position: int
    locked: bool
    quiz_passed: bool
    lessons: list[LessonPublic]


class CourseModuleOutline(BaseModel):
    """Module titles only, shown on the course detail/catalog page before
    enrolling — full lesson content and lock state come from
    GET /courses/{slug}/modules/{id} (phase 2), not this endpoint."""

    id: uuid.UUID
    title: str
    summary: str | None
    position: int
    lesson_count: int
    est_minutes: int


class CourseDetail(CourseSummary):
    description: str
    enrolled: bool
    completed: bool
    modules: list[CourseModuleOutline]


class LessonDetail(BaseModel):
    id: uuid.UUID
    title: str
    body: str
    completed: bool


class ChoiceItem(BaseModel):
    id: str
    text: str


class QuizQuestionPublic(BaseModel):
    """Never carries correct_choice_ids/explanation — those are only
    revealed in the grading result, after submit. multi_select doesn't leak
    which choices are correct, only how many — so the frontend knows to
    render checkboxes instead of radio buttons before the student answers."""

    id: uuid.UUID
    prompt: str
    choices: list[ChoiceItem]
    multi_select: bool


class QuizForAttempt(BaseModel):
    quiz_id: uuid.UUID
    pass_threshold_pct: int
    questions: list[QuizQuestionPublic]


class FinalExamIntro(BaseModel):
    intro_text: str | None
    question_count: int
    pass_threshold_pct: int


class AnswerItem(BaseModel):
    question_id: uuid.UUID
    choice_ids: list[str] = Field(default_factory=list)


class QuizAttemptRequest(BaseModel):
    answers: list[AnswerItem]


class GradedAnswer(BaseModel):
    question_id: uuid.UUID
    prompt: str
    choices: list[ChoiceItem]
    submitted_choice_ids: list[str]
    correct_choice_ids: list[str]
    explanation: str | None
    correct: bool


class QuizAttemptResult(BaseModel):
    score_pct: float
    passed: bool
    answers: list[GradedAnswer]


class CoursePaymentStatusResponse(BaseModel):
    id: uuid.UUID
    status: str
    amount: float
    mpesa_receipt: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class EnrollRequest(BaseModel):
    phone: str | None = None


class EnrollmentResponse(BaseModel):
    id: uuid.UUID
    access: str
    enrolled_at: datetime
    completed_at: datetime | None
    payment: CoursePaymentStatusResponse | None = None


class CourseProgressModule(BaseModel):
    id: uuid.UUID
    title: str
    locked: bool
    quiz_passed: bool
    lessons_completed: int
    lessons_total: int


class CourseProgress(BaseModel):
    modules: list[CourseProgressModule]
    capstone_status: str | None
    final_exam_passed: bool
    completed_at: datetime | None


class CourseEnrollmentSummary(BaseModel):
    slug: str
    title: str
    cover_image_url: str | None
    difficulty: int
    completed_at: datetime | None
    modules_total: int
    modules_completed: int


class CapstoneSubmitRequest(BaseModel):
    github_url: str
    what_built: str = Field(min_length=1)


class CapstoneSubmissionResponse(BaseModel):
    id: uuid.UUID
    github_url: str
    what_built: str
    review_status: str
    created_at: datetime


class CapstoneReviewRequest(BaseModel):
    approve: bool


class CapstoneAssignment(BaseModel):
    title: str
    instructions: str
    submission: CapstoneSubmissionResponse | None


# ── admin ────────────────────────────────────────────────────────────────


class CourseWriteRequest(BaseModel):
    slug: str
    title: str
    short_description: str = ""
    description: str = ""
    cover_image_url: str | None = None
    price_kes: int = 0
    difficulty: int = Field(default=1, ge=1, le=5)


class CourseUpdateRequest(BaseModel):
    slug: str | None = None
    title: str | None = None
    short_description: str | None = None
    description: str | None = None
    cover_image_url: str | None = None
    price_kes: int | None = None
    difficulty: int | None = Field(default=None, ge=1, le=5)


class AdminCourseRow(BaseModel):
    id: uuid.UUID
    slug: str
    title: str
    short_description: str
    description: str
    cover_image_url: str | None
    price_kes: int
    difficulty: int
    published_at: datetime | None
    archived_at: datetime | None
    module_count: int
    enrollment_count: int
    created_by: str
    arms: list[ArmRow]


class ModuleWriteRequest(BaseModel):
    title: str
    summary: str | None = None


class ModuleUpdateRequest(BaseModel):
    title: str | None = None
    summary: str | None = None


class AdminModuleRow(BaseModel):
    id: uuid.UUID
    course_id: uuid.UUID
    title: str
    summary: str | None
    position: int
    lesson_count: int
    has_quiz: bool


class CapstoneWriteRequest(BaseModel):
    title: str
    instructions: str = ""


class CapstoneUpdateRequest(BaseModel):
    title: str | None = None
    instructions: str | None = None


class AdminCapstoneAssignmentRow(BaseModel):
    id: uuid.UUID
    course_id: uuid.UUID
    title: str
    instructions: str
    submission_count: int


class AdminCapstoneRow(BaseModel):
    id: uuid.UUID
    who: str
    github_url: str
    what_built: str
    review_status: str
    reviewed_by: str | None
    created_at: datetime


class AdminQuizAttemptRow(BaseModel):
    quiz_title: str
    kind: str
    score_pct: float
    passed: bool
    created_at: datetime


class AdminEnrollmentRow(BaseModel):
    id: uuid.UUID
    who: str
    email: str
    access: str
    enrolled_at: datetime
    modules_completed: int
    modules_total: int
    final_exam_passed: bool
    capstone_status: str | None
    completed_at: datetime | None


class AdminEnrollmentDetail(AdminEnrollmentRow):
    modules: list[CourseProgressModule]
    attempts: list[AdminQuizAttemptRow]


class LessonWriteRequest(BaseModel):
    title: str
    body: str = ""


class LessonUpdateRequest(BaseModel):
    title: str | None = None
    body: str | None = None


class AdminLessonRow(BaseModel):
    id: uuid.UUID
    module_id: uuid.UUID
    title: str
    body: str
    position: int


class ReorderRequest(BaseModel):
    direction: Literal["up", "down"]


class QuizWriteRequest(BaseModel):
    title: str
    intro_text: str | None = None
    pass_threshold_pct: int = 80


class QuizUpdateRequest(BaseModel):
    title: str | None = None
    intro_text: str | None = None
    pass_threshold_pct: int | None = None


class AdminQuizRow(BaseModel):
    id: uuid.UUID
    kind: QuizKind
    course_id: uuid.UUID
    module_id: uuid.UUID | None
    title: str
    intro_text: str | None
    pass_threshold_pct: int
    question_count: int


class QuestionWriteRequest(BaseModel):
    prompt: str
    choices: list[ChoiceItem] = Field(min_length=2, max_length=5)
    correct_choice_ids: list[str] = Field(min_length=1)
    explanation: str | None = None

    @model_validator(mode="after")
    def _correct_choices_must_exist(self) -> "QuestionWriteRequest":
        if not set(self.correct_choice_ids) <= {c.id for c in self.choices}:
            raise ValueError("correct_choice_ids must match given choices")
        return self


class QuestionUpdateRequest(BaseModel):
    prompt: str | None = None
    choices: list[ChoiceItem] | None = Field(default=None, min_length=2, max_length=5)
    correct_choice_ids: list[str] | None = Field(default=None, min_length=1)
    explanation: str | None = None

    @model_validator(mode="after")
    def _correct_choices_must_exist(self) -> "QuestionUpdateRequest":
        if (
            self.choices is not None
            and self.correct_choice_ids is not None
            and not set(self.correct_choice_ids) <= {c.id for c in self.choices}
        ):
            raise ValueError("correct_choice_ids must match given choices")
        return self


class AdminQuestionRow(BaseModel):
    id: uuid.UUID
    quiz_id: uuid.UUID
    prompt: str
    choices: list[ChoiceItem]
    correct_choice_ids: list[str]
    explanation: str | None
    position: int
