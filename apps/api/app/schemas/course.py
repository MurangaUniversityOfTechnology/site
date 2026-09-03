import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.models.course_quiz import QuizKind

# ── public / member ─────────────────────────────────────────────────────


class CourseSummary(BaseModel):
    slug: str
    title: str
    short_description: str
    cover_image_url: str | None
    price_kes: int
    module_count: int

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


class CourseDetail(CourseSummary):
    description: str
    enrolled: bool
    modules: list[CourseModuleOutline]


class LessonDetail(BaseModel):
    id: uuid.UUID
    title: str
    body: str
    video_url: str | None
    completed: bool


class ChoiceItem(BaseModel):
    id: str
    text: str


class QuizQuestionPublic(BaseModel):
    """Never carries correct_choice_id/explanation — those are only
    revealed in the grading result, after submit."""

    id: uuid.UUID
    prompt: str
    choices: list[ChoiceItem]


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
    choice_id: str


class QuizAttemptRequest(BaseModel):
    answers: list[AnswerItem]


class GradedAnswer(BaseModel):
    question_id: uuid.UUID
    prompt: str
    choices: list[ChoiceItem]
    submitted_choice_id: str | None
    correct_choice_id: str
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


class ReviewableCapstoneRow(BaseModel):
    id: uuid.UUID
    who: str
    github_url: str
    what_built: str
    created_at: datetime


class CapstoneReviewRequest(BaseModel):
    approve: bool


# ── admin ────────────────────────────────────────────────────────────────


class CourseWriteRequest(BaseModel):
    slug: str
    title: str
    short_description: str = ""
    description: str = ""
    cover_image_url: str | None = None
    price_kes: int = 0


class CourseUpdateRequest(BaseModel):
    slug: str | None = None
    title: str | None = None
    short_description: str | None = None
    description: str | None = None
    cover_image_url: str | None = None
    price_kes: int | None = None


class AdminCourseRow(BaseModel):
    id: uuid.UUID
    slug: str
    title: str
    short_description: str
    description: str
    cover_image_url: str | None
    price_kes: int
    published_at: datetime | None
    archived_at: datetime | None
    module_count: int
    enrollment_count: int
    created_by: str


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


class LessonWriteRequest(BaseModel):
    title: str
    body: str = ""
    video_url: str | None = None


class LessonUpdateRequest(BaseModel):
    title: str | None = None
    body: str | None = None
    video_url: str | None = None


class AdminLessonRow(BaseModel):
    id: uuid.UUID
    module_id: uuid.UUID
    title: str
    body: str
    video_url: str | None
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
    correct_choice_id: str
    explanation: str | None = None

    @model_validator(mode="after")
    def _correct_choice_must_exist(self) -> "QuestionWriteRequest":
        if self.correct_choice_id not in {c.id for c in self.choices}:
            raise ValueError("correct_choice_id must match one of the given choices")
        return self


class QuestionUpdateRequest(BaseModel):
    prompt: str | None = None
    choices: list[ChoiceItem] | None = Field(default=None, min_length=2, max_length=5)
    correct_choice_id: str | None = None
    explanation: str | None = None

    @model_validator(mode="after")
    def _correct_choice_must_exist(self) -> "QuestionUpdateRequest":
        if (
            self.choices is not None
            and self.correct_choice_id is not None
            and self.correct_choice_id not in {c.id for c in self.choices}
        ):
            raise ValueError("correct_choice_id must match one of the given choices")
        return self


class AdminQuestionRow(BaseModel):
    id: uuid.UUID
    quiz_id: uuid.UUID
    prompt: str
    choices: list[ChoiceItem]
    correct_choice_id: str
    explanation: str | None
    position: int


class AdminCapstoneRow(BaseModel):
    id: uuid.UUID
    who: str
    github_url: str
    what_built: str
    review_status: str
    reviewed_by: str | None
    created_at: datetime
