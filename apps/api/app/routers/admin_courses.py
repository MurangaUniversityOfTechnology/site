import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import require_admin
from app.models.course import Course
from app.models.course_enrollment import CourseEnrollment
from app.models.course_lesson import CourseLesson
from app.models.course_module import CourseModule
from app.models.course_quiz import CourseQuiz
from app.models.course_quiz_question import CourseQuizQuestion
from app.models.user import User
from app.schemas.course import (
    AdminCourseRow,
    AdminLessonRow,
    AdminModuleRow,
    AdminQuestionRow,
    AdminQuizRow,
    CourseUpdateRequest,
    CourseWriteRequest,
    LessonUpdateRequest,
    LessonWriteRequest,
    ModuleUpdateRequest,
    ModuleWriteRequest,
    QuestionUpdateRequest,
    QuestionWriteRequest,
    QuizUpdateRequest,
    QuizWriteRequest,
    ReorderRequest,
)
from app.services import course as course_service

router = APIRouter(prefix="/admin", tags=["admin-courses"], dependencies=[Depends(require_admin)])


# ── row shaping ──────────────────────────────────────────────────────────


def _admin_course_row(db: Session, course: Course) -> AdminCourseRow:
    return AdminCourseRow(
        id=course.id,
        slug=course.slug,
        title=course.title,
        short_description=course.short_description,
        description=course.description,
        cover_image_url=course.cover_image_url,
        price_kes=course.price_kes,
        published_at=course.published_at,
        archived_at=course.archived_at,
        module_count=len(course_service.list_modules(db, course)),
        enrollment_count=db.query(CourseEnrollment).filter(CourseEnrollment.course_id == course.id).count(),
        created_by=_display_name(course.created_by),
    )


def _display_name(user: User) -> str:
    return user.profile.display_name if user.profile and user.profile.display_name else user.email


def _admin_module_row(db: Session, module: CourseModule) -> AdminModuleRow:
    return AdminModuleRow(
        id=module.id,
        course_id=module.course_id,
        title=module.title,
        summary=module.summary,
        position=module.position,
        lesson_count=len(course_service.list_lessons(db, module)),
        has_quiz=course_service.get_module_quiz(db, module) is not None,
    )


def _admin_lesson_row(lesson: CourseLesson) -> AdminLessonRow:
    return AdminLessonRow(
        id=lesson.id,
        module_id=lesson.module_id,
        title=lesson.title,
        body=lesson.body,
        video_url=lesson.video_url,
        position=lesson.position,
    )


def _admin_quiz_row(db: Session, quiz: CourseQuiz) -> AdminQuizRow:
    return AdminQuizRow(
        id=quiz.id,
        kind=quiz.kind,
        course_id=quiz.course_id,
        module_id=quiz.module_id,
        title=quiz.title,
        intro_text=quiz.intro_text,
        pass_threshold_pct=quiz.pass_threshold_pct,
        question_count=len(course_service.list_questions(db, quiz)),
    )


def _admin_question_row(question: CourseQuizQuestion) -> AdminQuestionRow:
    return AdminQuestionRow(
        id=question.id,
        quiz_id=question.quiz_id,
        prompt=question.prompt,
        choices=question.choices,
        correct_choice_id=question.correct_choice_id,
        explanation=question.explanation,
        position=question.position,
    )


# ── 404 helpers ──────────────────────────────────────────────────────────


def _get_course_or_404(db: Session, slug: str) -> Course:
    try:
        return course_service.get_course(db, slug)
    except course_service.CourseError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


def _get_module_or_404(db: Session, module_id: uuid.UUID) -> CourseModule:
    try:
        return course_service.get_module(db, module_id)
    except course_service.CourseError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


def _get_lesson_or_404(db: Session, lesson_id: uuid.UUID) -> CourseLesson:
    try:
        return course_service.get_lesson(db, lesson_id)
    except course_service.CourseError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


def _get_question_or_404(db: Session, question_id: uuid.UUID) -> CourseQuizQuestion:
    try:
        return course_service.get_question(db, question_id)
    except course_service.CourseError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


def _get_quiz_or_404(db: Session, quiz_id: uuid.UUID) -> CourseQuiz:
    quiz = db.get(CourseQuiz, quiz_id)
    if not quiz:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown quiz")
    return quiz


# ── courses ──────────────────────────────────────────────────────────────


@router.get("/courses", response_model=list[AdminCourseRow])
def list_admin_courses(archived: bool = False, db: Session = Depends(get_db)):
    return [_admin_course_row(db, c) for c in course_service.list_admin_courses(db, archived=archived)]


@router.post("/courses", response_model=AdminCourseRow, status_code=status.HTTP_201_CREATED)
def create_course(payload: CourseWriteRequest, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    try:
        course = course_service.create_course(db, admin, payload.model_dump())
    except course_service.CourseError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return _admin_course_row(db, course)


@router.patch("/courses/{slug}", response_model=AdminCourseRow)
def update_course(
    slug: str, payload: CourseUpdateRequest, admin: User = Depends(require_admin), db: Session = Depends(get_db)
):
    course = _get_course_or_404(db, slug)
    try:
        course = course_service.update_course(db, admin, course, payload.model_dump(exclude_unset=True))
    except course_service.CourseError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return _admin_course_row(db, course)


@router.delete("/courses/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(slug: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    course = _get_course_or_404(db, slug)
    try:
        course_service.delete_course(db, admin, course)
    except course_service.CourseError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.post("/courses/{slug}/publish", response_model=AdminCourseRow)
def publish_course(slug: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    course = _get_course_or_404(db, slug)
    try:
        course = course_service.publish_course(db, admin, course)
    except course_service.CourseError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return _admin_course_row(db, course)


@router.post("/courses/{slug}/unpublish", response_model=AdminCourseRow)
def unpublish_course(slug: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    course = _get_course_or_404(db, slug)
    try:
        course = course_service.unpublish_course(db, admin, course)
    except course_service.CourseError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return _admin_course_row(db, course)


@router.post("/courses/{slug}/archive", response_model=AdminCourseRow)
def archive_course(slug: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    course = _get_course_or_404(db, slug)
    try:
        course = course_service.archive_course(db, admin, course)
    except course_service.CourseError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return _admin_course_row(db, course)


@router.post("/courses/{slug}/unarchive", response_model=AdminCourseRow)
def unarchive_course(slug: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    course = _get_course_or_404(db, slug)
    try:
        course = course_service.unarchive_course(db, admin, course)
    except course_service.CourseError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return _admin_course_row(db, course)


# ── modules ──────────────────────────────────────────────────────────────


@router.get("/courses/{slug}/modules", response_model=list[AdminModuleRow])
def list_admin_modules(slug: str, db: Session = Depends(get_db)):
    course = _get_course_or_404(db, slug)
    return [_admin_module_row(db, m) for m in course_service.list_modules(db, course)]


@router.post("/courses/{slug}/modules", response_model=AdminModuleRow, status_code=status.HTTP_201_CREATED)
def create_module(
    slug: str, payload: ModuleWriteRequest, admin: User = Depends(require_admin), db: Session = Depends(get_db)
):
    course = _get_course_or_404(db, slug)
    module = course_service.create_module(db, admin, course, payload.model_dump())
    return _admin_module_row(db, module)


@router.patch("/modules/{module_id}", response_model=AdminModuleRow)
def update_module(
    module_id: uuid.UUID,
    payload: ModuleUpdateRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    module = _get_module_or_404(db, module_id)
    module = course_service.update_module(db, admin, module, payload.model_dump(exclude_unset=True))
    return _admin_module_row(db, module)


@router.delete("/modules/{module_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_module(module_id: uuid.UUID, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    module = _get_module_or_404(db, module_id)
    try:
        course_service.delete_module(db, admin, module)
    except course_service.CourseError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.post("/modules/{module_id}/reorder", response_model=AdminModuleRow)
def reorder_module(
    module_id: uuid.UUID, payload: ReorderRequest, admin: User = Depends(require_admin), db: Session = Depends(get_db)
):
    module = _get_module_or_404(db, module_id)
    try:
        module = course_service.reorder_module(db, admin, module, payload.direction)
    except course_service.CourseError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return _admin_module_row(db, module)


# ── lessons ──────────────────────────────────────────────────────────────


@router.get("/modules/{module_id}/lessons", response_model=list[AdminLessonRow])
def list_admin_lessons(module_id: uuid.UUID, db: Session = Depends(get_db)):
    module = _get_module_or_404(db, module_id)
    return [_admin_lesson_row(lesson) for lesson in course_service.list_lessons(db, module)]


@router.post("/modules/{module_id}/lessons", response_model=AdminLessonRow, status_code=status.HTTP_201_CREATED)
def create_lesson(
    module_id: uuid.UUID,
    payload: LessonWriteRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    module = _get_module_or_404(db, module_id)
    lesson = course_service.create_lesson(db, admin, module, payload.model_dump())
    return _admin_lesson_row(lesson)


@router.patch("/lessons/{lesson_id}", response_model=AdminLessonRow)
def update_lesson(
    lesson_id: uuid.UUID,
    payload: LessonUpdateRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    lesson = _get_lesson_or_404(db, lesson_id)
    lesson = course_service.update_lesson(db, admin, lesson, payload.model_dump(exclude_unset=True))
    return _admin_lesson_row(lesson)


@router.delete("/lessons/{lesson_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lesson(lesson_id: uuid.UUID, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    lesson = _get_lesson_or_404(db, lesson_id)
    try:
        course_service.delete_lesson(db, admin, lesson)
    except course_service.CourseError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.post("/lessons/{lesson_id}/reorder", response_model=AdminLessonRow)
def reorder_lesson(
    lesson_id: uuid.UUID, payload: ReorderRequest, admin: User = Depends(require_admin), db: Session = Depends(get_db)
):
    lesson = _get_lesson_or_404(db, lesson_id)
    try:
        lesson = course_service.reorder_lesson(db, admin, lesson, payload.direction)
    except course_service.CourseError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return _admin_lesson_row(lesson)


# ── quizzes ──────────────────────────────────────────────────────────────


@router.get("/modules/{module_id}/quiz", response_model=AdminQuizRow | None)
def get_module_quiz(module_id: uuid.UUID, db: Session = Depends(get_db)):
    module = _get_module_or_404(db, module_id)
    quiz = course_service.get_module_quiz(db, module)
    return _admin_quiz_row(db, quiz) if quiz else None


@router.post("/modules/{module_id}/quiz", response_model=AdminQuizRow, status_code=status.HTTP_201_CREATED)
def create_module_quiz(
    module_id: uuid.UUID, payload: QuizWriteRequest, admin: User = Depends(require_admin), db: Session = Depends(get_db)
):
    module = _get_module_or_404(db, module_id)
    try:
        quiz = course_service.create_module_quiz(db, admin, module, payload.model_dump())
    except course_service.CourseError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return _admin_quiz_row(db, quiz)


@router.get("/courses/{slug}/final-exam", response_model=AdminQuizRow | None)
def get_final_exam(slug: str, db: Session = Depends(get_db)):
    course = _get_course_or_404(db, slug)
    quiz = course_service.get_final_exam(db, course)
    return _admin_quiz_row(db, quiz) if quiz else None


@router.post("/courses/{slug}/final-exam", response_model=AdminQuizRow, status_code=status.HTTP_201_CREATED)
def create_final_exam(
    slug: str, payload: QuizWriteRequest, admin: User = Depends(require_admin), db: Session = Depends(get_db)
):
    course = _get_course_or_404(db, slug)
    try:
        quiz = course_service.create_final_exam(db, admin, course, payload.model_dump())
    except course_service.CourseError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return _admin_quiz_row(db, quiz)


@router.patch("/quizzes/{quiz_id}", response_model=AdminQuizRow)
def update_quiz(
    quiz_id: uuid.UUID, payload: QuizUpdateRequest, admin: User = Depends(require_admin), db: Session = Depends(get_db)
):
    quiz = _get_quiz_or_404(db, quiz_id)
    quiz = course_service.update_quiz(db, admin, quiz, payload.model_dump(exclude_unset=True))
    return _admin_quiz_row(db, quiz)


@router.delete("/quizzes/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quiz(quiz_id: uuid.UUID, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    quiz = _get_quiz_or_404(db, quiz_id)
    try:
        course_service.delete_quiz(db, admin, quiz)
    except course_service.CourseError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


# ── questions ────────────────────────────────────────────────────────────


@router.get("/quizzes/{quiz_id}/questions", response_model=list[AdminQuestionRow])
def list_admin_questions(quiz_id: uuid.UUID, db: Session = Depends(get_db)):
    quiz = _get_quiz_or_404(db, quiz_id)
    return [_admin_question_row(q) for q in course_service.list_questions(db, quiz)]


@router.post("/quizzes/{quiz_id}/questions", response_model=AdminQuestionRow, status_code=status.HTTP_201_CREATED)
def create_question(
    quiz_id: uuid.UUID,
    payload: QuestionWriteRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    quiz = _get_quiz_or_404(db, quiz_id)
    question = course_service.create_question(db, admin, quiz, payload.model_dump())
    return _admin_question_row(question)


@router.patch("/questions/{question_id}", response_model=AdminQuestionRow)
def update_question(
    question_id: uuid.UUID,
    payload: QuestionUpdateRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    question = _get_question_or_404(db, question_id)
    question = course_service.update_question(db, admin, question, payload.model_dump(exclude_unset=True))
    return _admin_question_row(question)


@router.delete("/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_question(question_id: uuid.UUID, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    question = _get_question_or_404(db, question_id)
    try:
        course_service.delete_question(db, admin, question)
    except course_service.CourseError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.post("/questions/{question_id}/reorder", response_model=AdminQuestionRow)
def reorder_question(
    question_id: uuid.UUID,
    payload: ReorderRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    question = _get_question_or_404(db, question_id)
    try:
        question = course_service.reorder_question(db, admin, question, payload.direction)
    except course_service.CourseError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return _admin_question_row(question)
