from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user, get_current_user_optional
from app.core.rate_limit import limiter
from app.models.course import Course
from app.models.course_enrollment import CourseEnrollment
from app.models.course_module import CourseModule
from app.models.course_quiz import CourseQuiz, QuizKind
from app.models.user import User
from app.schemas.arm import ArmRow
from app.schemas.course import (
    ChoiceItem,
    CourseDetail,
    CourseEnrollmentSummary,
    CourseModuleOutline,
    CoursePaymentStatusResponse,
    CourseProgress,
    CourseSummary,
    EnrollmentResponse,
    EnrollRequest,
    FinalExamIntro,
    LessonDetail,
    LessonPublic,
    ModulePublic,
    QuizAttemptRequest,
    QuizAttemptResult,
    QuizForAttempt,
    QuizQuestionPublic,
)
from app.services import arms as arms_service
from app.services import course as course_service
from app.services import course_payment

router = APIRouter(prefix="/courses", tags=["courses"])


def _summary(db: Session, course: Course) -> CourseSummary:
    return CourseSummary(
        slug=course.slug,
        title=course.title,
        short_description=course.short_description,
        cover_image_url=course.cover_image_url,
        price_kes=course.price_kes,
        module_count=len(course_service.list_modules(db, course)),
        arms=[ArmRow.model_validate(a) for a in arms_service.list_course_arms(db, course)],
    )


def _detail(db: Session, course: Course, user: User | None) -> CourseDetail:
    modules = course_service.list_modules(db, course)
    enrollment = course_service.get_enrollment(db, course, user) if user else None
    return CourseDetail(
        **_summary(db, course).model_dump(),
        description=course.description,
        enrolled=bool(enrollment),
        completed=bool(enrollment and enrollment.completed_at),
        modules=[
            CourseModuleOutline(
                id=m.id,
                title=m.title,
                summary=m.summary,
                position=m.position,
                lesson_count=len(course_service.list_lessons(db, m)),
            )
            for m in modules
        ],
    )


def _enrollment_response(db: Session, enrollment: CourseEnrollment) -> EnrollmentResponse:
    payment = course_payment.latest_payment_for(db, enrollment.id)
    if payment:
        course_payment.sync_pending_course_payment(db, payment)
    return EnrollmentResponse(
        id=enrollment.id,
        access=enrollment.access.value,
        enrolled_at=enrollment.enrolled_at,
        completed_at=enrollment.completed_at,
        payment=CoursePaymentStatusResponse.model_validate(payment) if payment else None,
    )


@router.get("", response_model=list[CourseSummary])
def list_courses(arm: str | None = None, db: Session = Depends(get_db)):
    return [_summary(db, c) for c in course_service.list_published_courses(db, arm_slug=arm)]


@router.get("/arms", response_model=list[ArmRow])
def list_arms(db: Session = Depends(get_db)):
    """Declared ahead of /{slug} — a literal segment must be matched before
    the catch-all param, same convention /mpesa/callback below uses."""
    return arms_service.list_arms(db)


@router.get("/my-enrollments", response_model=list[CourseEnrollmentSummary])
def my_enrollments(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Also declared ahead of /{slug} for the same reason as /arms above."""
    return [CourseEnrollmentSummary(**row) for row in course_service.list_my_enrollments_summary(db, user)]


@router.post("/mpesa/callback", status_code=status.HTTP_200_OK)
async def mpesa_course_callback(request: Request, db: Session = Depends(get_db)):
    payload = await request.json()
    course_payment.apply_stk_callback(db, payload)
    # Safaricom expects this exact envelope to consider the callback acknowledged.
    return {"ResultCode": 0, "ResultDesc": "Accepted"}


@router.get("/{slug}", response_model=CourseDetail)
def get_course_detail(slug: str, user: User | None = Depends(get_current_user_optional), db: Session = Depends(get_db)):
    try:
        course = course_service.get_published_course(db, slug)
    except course_service.CourseError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    return _detail(db, course, user)


@router.post("/{slug}/enroll", response_model=EnrollmentResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/hour")
def enroll(
    request: Request,
    slug: str,
    payload: EnrollRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        enrollment = course_service.enroll(db, slug, user, payload.phone)
    except course_service.CourseError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return _enrollment_response(db, enrollment)


@router.get("/{slug}/my-enrollment", response_model=EnrollmentResponse | None)
def my_enrollment(slug: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        course = course_service.get_course(db, slug)
    except course_service.CourseError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    enrollment = course_service.get_enrollment(db, course, user)
    if not enrollment:
        return None
    return _enrollment_response(db, enrollment)


# ── lessons / quizzes / progress (student-facing, phase 2) ─────────────
#
# Every endpoint below requires an authenticated user and calls either
# require_access (read) or require_enrollment (write) first — access can
# lapse mid-course (e.g. a free_member's membership expires), so this is
# re-checked on every request, never just once at enroll time.


def _get_course_or_404(db: Session, slug: str) -> Course:
    try:
        return course_service.get_published_course(db, slug)
    except course_service.CourseError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


def _module_public(db: Session, module: CourseModule, enrollment: CourseEnrollment | None, locked: bool) -> ModulePublic:
    quiz = course_service.get_module_quiz(db, module)
    lessons = course_service.list_lessons(db, module)
    return ModulePublic(
        id=module.id,
        title=module.title,
        summary=module.summary,
        position=module.position,
        locked=locked,
        quiz_passed=bool(quiz and course_service.has_passed_quiz(db, quiz, enrollment)),
        lessons=[
            LessonPublic(
                id=lesson.id,
                title=lesson.title,
                position=lesson.position,
                locked=locked,
                completed=course_service.is_lesson_completed(db, enrollment, lesson),
            )
            for lesson in lessons
        ],
    )


def _quiz_for_attempt(quiz: CourseQuiz, questions: list) -> QuizForAttempt:
    # Module quizzes always require 100% — the DB column only means
    # anything for the final exam, so it's hidden behind this constant
    # rather than surfaced, to keep the frontend copy generic across kinds.
    threshold = 100 if quiz.kind == QuizKind.module_quiz else quiz.pass_threshold_pct
    return QuizForAttempt(
        quiz_id=quiz.id,
        pass_threshold_pct=threshold,
        questions=[
            QuizQuestionPublic(id=q.id, prompt=q.prompt, choices=[ChoiceItem(**c) for c in q.choices])
            for q in questions
        ],
    )


@router.get("/{slug}/modules", response_model=list[ModulePublic])
def list_modules(slug: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = _get_course_or_404(db, slug)
    try:
        enrollment = course_service.get_enrollment_for_access(db, course, user)
    except course_service.CourseAccessDenied as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    lock_states = course_service.compute_module_lock_states(db, course, enrollment)
    return [
        _module_public(db, module, enrollment, lock_states[module.id])
        for module in course_service.list_modules(db, course)
    ]


@router.get("/{slug}/lessons/{lesson_id}", response_model=LessonDetail)
def get_lesson(slug: str, lesson_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = _get_course_or_404(db, slug)
    try:
        enrollment = course_service.get_enrollment_for_access(db, course, user)
        lesson = course_service.get_lesson_in_course(db, course, lesson_id)
    except course_service.CourseAccessDenied as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    except course_service.CourseError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    if course_service.is_module_locked(db, course, lesson.module, enrollment):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This module is still locked")
    return LessonDetail(
        id=lesson.id,
        title=lesson.title,
        body=lesson.body,
        video_url=lesson.video_url,
        completed=course_service.is_lesson_completed(db, enrollment, lesson),
    )


@router.post("/{slug}/lessons/{lesson_id}/complete", response_model=LessonPublic)
def complete_lesson(slug: str, lesson_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = _get_course_or_404(db, slug)
    try:
        enrollment = course_service.require_enrollment(db, course, user)
        lesson = course_service.get_lesson_in_course(db, course, lesson_id)
    except course_service.CourseAccessDenied as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    except course_service.CourseError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    if course_service.is_module_locked(db, course, lesson.module, enrollment):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This module is still locked")
    course_service.mark_lesson_complete(db, enrollment, lesson)
    return LessonPublic(id=lesson.id, title=lesson.title, position=lesson.position, locked=False, completed=True)


@router.get("/{slug}/modules/{module_id}/quiz", response_model=QuizForAttempt)
def get_module_quiz(slug: str, module_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = _get_course_or_404(db, slug)
    try:
        enrollment = course_service.get_enrollment_for_access(db, course, user)
        module = course_service.get_module_in_course(db, course, module_id)
    except course_service.CourseAccessDenied as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    except course_service.CourseError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    if course_service.is_module_locked(db, course, module, enrollment):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This module is still locked")
    quiz = course_service.get_module_quiz(db, module)
    if not quiz:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This module has no quiz")
    return _quiz_for_attempt(quiz, course_service.list_questions(db, quiz))


@router.post("/{slug}/modules/{module_id}/quiz/attempt", response_model=QuizAttemptResult)
@limiter.limit("30/hour")
def attempt_module_quiz(
    request: Request,
    slug: str,
    module_id: str,
    payload: QuizAttemptRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    course = _get_course_or_404(db, slug)
    try:
        enrollment = course_service.require_enrollment(db, course, user)
        module = course_service.get_module_in_course(db, course, module_id)
    except course_service.CourseAccessDenied as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    except course_service.CourseError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    if course_service.is_module_locked(db, course, module, enrollment):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This module is still locked")
    quiz = course_service.get_module_quiz(db, module)
    if not quiz:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This module has no quiz")
    attempt = course_service.grade_quiz_attempt(db, enrollment, quiz, [a.model_dump() for a in payload.answers])
    return QuizAttemptResult(score_pct=attempt.score_pct, passed=attempt.passed, answers=attempt.answers)


@router.get("/{slug}/final-exam", response_model=FinalExamIntro)
def get_final_exam_intro(slug: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = _get_course_or_404(db, slug)
    try:
        enrollment = course_service.get_enrollment_for_access(db, course, user)
    except course_service.CourseAccessDenied as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    if not course_service.all_module_quizzes_passed(db, course, enrollment):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Pass every module quiz first")
    quiz = course_service.get_final_exam(db, course)
    if not quiz:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This course has no final exam")
    return FinalExamIntro(
        intro_text=quiz.intro_text,
        question_count=len(course_service.list_questions(db, quiz)),
        pass_threshold_pct=quiz.pass_threshold_pct,
    )


@router.get("/{slug}/final-exam/questions", response_model=QuizForAttempt)
def get_final_exam_questions(slug: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = _get_course_or_404(db, slug)
    try:
        enrollment = course_service.get_enrollment_for_access(db, course, user)
    except course_service.CourseAccessDenied as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    if not course_service.all_module_quizzes_passed(db, course, enrollment):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Pass every module quiz first")
    quiz = course_service.get_final_exam(db, course)
    if not quiz:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This course has no final exam")
    return _quiz_for_attempt(quiz, course_service.list_questions(db, quiz))


@router.post("/{slug}/final-exam/attempt", response_model=QuizAttemptResult)
@limiter.limit("30/hour")
def attempt_final_exam(
    request: Request,
    slug: str,
    payload: QuizAttemptRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    course = _get_course_or_404(db, slug)
    try:
        enrollment = course_service.require_enrollment(db, course, user)
    except course_service.CourseAccessDenied as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    if not course_service.all_module_quizzes_passed(db, course, enrollment):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Pass every module quiz first")
    try:
        attempt = course_service.attempt_final_exam(
            db, course, enrollment, [a.model_dump() for a in payload.answers]
        )
    except course_service.CourseError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    return QuizAttemptResult(score_pct=attempt.score_pct, passed=attempt.passed, answers=attempt.answers)


@router.get("/{slug}/progress", response_model=CourseProgress)
def get_progress(slug: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = _get_course_or_404(db, slug)
    try:
        enrollment = course_service.require_enrollment(db, course, user)
    except course_service.CourseAccessDenied as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    return CourseProgress(**course_service.build_course_progress(db, course, enrollment))
