import uuid
from datetime import UTC, datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.arm import Arm
from app.models.course import Course
from app.models.course_arm import CourseArm
from app.models.course_enrollment import CourseAccessType, CourseEnrollment
from app.models.course_lesson import CourseLesson
from app.models.course_lesson_completion import CourseLessonCompletion
from app.models.course_module import CourseModule
from app.models.course_quiz import CourseQuiz, QuizKind
from app.models.course_quiz_attempt import CourseQuizAttempt
from app.models.course_quiz_question import CourseQuizQuestion
from app.models.payment import PaymentStatus
from app.models.user import User
from app.services import audit, course_payment, notification
from app.services.membership_access import is_active_member


class CourseError(Exception):
    pass


class CourseAccessDenied(CourseError):
    """Raised where a plain CourseError would 404 — this maps to 403
    instead, since the course/lesson/quiz genuinely exists, the caller
    just isn't allowed to read or attempt it right now."""


# ── courses ──────────────────────────────────────────────────────────────


def get_course(db: Session, slug: str) -> Course:
    """Any status — used by admin authoring, which needs to reach drafts."""
    course = db.query(Course).filter(Course.slug == slug).first()
    if not course:
        raise CourseError(f"Unknown course '{slug}'")
    return course


def get_published_course(db: Session, slug: str) -> Course:
    """Public read path — drafts and archived courses 404 exactly like an
    unknown slug, so a leaked draft link reveals nothing."""
    course = (
        db.query(Course)
        .filter(Course.slug == slug, Course.published_at.isnot(None), Course.archived_at.is_(None))
        .first()
    )
    if not course:
        raise CourseError(f"Unknown course '{slug}'")
    return course


def list_published_courses(db: Session, arm_slug: str | None = None) -> list[Course]:
    query = db.query(Course).filter(Course.published_at.isnot(None), Course.archived_at.is_(None))
    if arm_slug:
        query = (
            query.join(CourseArm, CourseArm.course_id == Course.id)
            .join(Arm, Arm.id == CourseArm.arm_id)
            .filter(Arm.slug == arm_slug)
        )
    return query.order_by(Course.created_at.desc()).all()


def list_admin_courses(db: Session, archived: bool = False) -> list[Course]:
    query = db.query(Course).filter(Course.archived_at.isnot(None) if archived else Course.archived_at.is_(None))
    return query.order_by(Course.created_at.desc()).all()


def create_course(db: Session, admin: User, fields: dict) -> Course:
    if db.query(Course).filter(Course.slug == fields["slug"]).first():
        raise CourseError(f"A course with slug '{fields['slug']}' already exists")
    course = Course(**fields, created_by_id=admin.id)
    db.add(course)
    audit.log(db, admin, "course", f"Created course {course.title}")
    db.commit()
    db.refresh(course)
    return course


def update_course(db: Session, admin: User, course: Course, fields: dict) -> Course:
    new_slug = fields.get("slug")
    if new_slug and new_slug != course.slug and db.query(Course).filter(Course.slug == new_slug).first():
        raise CourseError(f"A course with slug '{new_slug}' already exists")
    for key, value in fields.items():
        setattr(course, key, value)
    audit.log(db, admin, "course", f"Updated course {course.title}")
    db.commit()
    db.refresh(course)
    return course


def delete_course(db: Session, admin: User, course: Course) -> None:
    count = db.query(CourseEnrollment).filter(CourseEnrollment.course_id == course.id).count()
    if count:
        raise CourseError(f"Can't delete — {count} student(s) are enrolled in this course")
    audit.log(db, admin, "course", f"Deleted course {course.title}")
    db.delete(course)
    db.commit()


def publish_course(db: Session, admin: User, course: Course) -> Course:
    if course.published_at is not None:
        raise CourseError("Course is already published")

    modules = list_modules(db, course)
    if not modules:
        raise CourseError("Add at least one module before publishing")

    for module in modules:
        quiz = get_module_quiz(db, module)
        if not quiz:
            raise CourseError(f"Module '{module.title}' needs a quiz before publishing")
        if not list_questions(db, quiz):
            raise CourseError(f"Module '{module.title}''s quiz needs at least one question")

    final_exam = get_final_exam(db, course)
    if not final_exam:
        raise CourseError("Add a final exam before publishing")
    if not list_questions(db, final_exam):
        raise CourseError("The final exam needs at least one question")

    course.published_at = datetime.now(UTC)
    audit.log(db, admin, "course", f"Published course {course.title}")
    db.commit()
    db.refresh(course)
    return course


def unpublish_course(db: Session, admin: User, course: Course) -> Course:
    if course.published_at is None:
        raise CourseError("Course is not published")
    course.published_at = None
    audit.log(db, admin, "course", f"Unpublished course {course.title}")
    db.commit()
    db.refresh(course)
    return course


def archive_course(db: Session, admin: User, course: Course) -> Course:
    if course.archived_at is not None:
        raise CourseError("Course is already archived")
    course.archived_at = datetime.now(UTC)
    audit.log(db, admin, "course", f"Archived course {course.title}")
    db.commit()
    db.refresh(course)
    return course


def unarchive_course(db: Session, admin: User, course: Course) -> Course:
    if course.archived_at is None:
        raise CourseError("Course is not archived")
    course.archived_at = None
    audit.log(db, admin, "course", f"Unarchived course {course.title}")
    db.commit()
    db.refresh(course)
    return course


# ── positions (shared by modules / lessons / questions) ────────────────


def _swap_positions(db: Session, item, other) -> None:
    """Postgres checks a UniqueConstraint(..., position) per-statement, not
    deferred — so a direct two-way swap would collide mid-transaction.
    Parking `item` on a temporary out-of-range value first avoids that."""
    item_pos, other_pos = item.position, other.position
    item.position = -1
    db.flush()
    other.position = item_pos
    db.flush()
    item.position = other_pos


def _reorder(db: Session, siblings: list, item, direction: str) -> None:
    idx = next(i for i, s in enumerate(siblings) if s.id == item.id)
    swap_idx = idx - 1 if direction == "up" else idx + 1
    if swap_idx < 0 or swap_idx >= len(siblings):
        raise CourseError("Can't move further in that direction")
    _swap_positions(db, item, siblings[swap_idx])


# ── modules ──────────────────────────────────────────────────────────────


def list_modules(db: Session, course: Course) -> list[CourseModule]:
    return (
        db.query(CourseModule)
        .filter(CourseModule.course_id == course.id)
        .order_by(CourseModule.position.asc())
        .all()
    )


def get_module(db: Session, module_id) -> CourseModule:
    module = db.get(CourseModule, module_id)
    if not module:
        raise CourseError("Unknown module")
    return module


def create_module(db: Session, admin: User, course: Course, fields: dict) -> CourseModule:
    max_pos = db.query(func.max(CourseModule.position)).filter(CourseModule.course_id == course.id).scalar() or 0
    module = CourseModule(course_id=course.id, position=max_pos + 1, **fields)
    db.add(module)
    audit.log(db, admin, "course", f"Added module '{module.title}' to {course.title}")
    db.commit()
    db.refresh(module)
    return module


def update_module(db: Session, admin: User, module: CourseModule, fields: dict) -> CourseModule:
    for key, value in fields.items():
        setattr(module, key, value)
    audit.log(db, admin, "course", f"Updated module '{module.title}'")
    db.commit()
    db.refresh(module)
    return module


def delete_module(db: Session, admin: User, module: CourseModule) -> None:
    if module.course.published_at is not None:
        raise CourseError("Unpublish the course before deleting a module")
    audit.log(db, admin, "course", f"Deleted module '{module.title}' from {module.course.title}")
    db.delete(module)
    db.commit()


def reorder_module(db: Session, admin: User, module: CourseModule, direction: str) -> CourseModule:
    _reorder(db, list_modules(db, module.course), module, direction)
    audit.log(db, admin, "course", f"Reordered module '{module.title}'")
    db.commit()
    db.refresh(module)
    return module


# ── lessons ──────────────────────────────────────────────────────────────


def list_lessons(db: Session, module: CourseModule) -> list[CourseLesson]:
    return (
        db.query(CourseLesson)
        .filter(CourseLesson.module_id == module.id)
        .order_by(CourseLesson.position.asc())
        .all()
    )


def get_lesson(db: Session, lesson_id) -> CourseLesson:
    lesson = db.get(CourseLesson, lesson_id)
    if not lesson:
        raise CourseError("Unknown lesson")
    return lesson


def create_lesson(db: Session, admin: User, module: CourseModule, fields: dict) -> CourseLesson:
    max_pos = db.query(func.max(CourseLesson.position)).filter(CourseLesson.module_id == module.id).scalar() or 0
    lesson = CourseLesson(module_id=module.id, position=max_pos + 1, **fields)
    db.add(lesson)
    audit.log(db, admin, "course", f"Added lesson '{lesson.title}' to module '{module.title}'")
    db.commit()
    db.refresh(lesson)
    return lesson


def update_lesson(db: Session, admin: User, lesson: CourseLesson, fields: dict) -> CourseLesson:
    for key, value in fields.items():
        setattr(lesson, key, value)
    audit.log(db, admin, "course", f"Updated lesson '{lesson.title}'")
    db.commit()
    db.refresh(lesson)
    return lesson


def delete_lesson(db: Session, admin: User, lesson: CourseLesson) -> None:
    if lesson.module.course.published_at is not None:
        raise CourseError("Unpublish the course before deleting a lesson")
    audit.log(db, admin, "course", f"Deleted lesson '{lesson.title}'")
    db.delete(lesson)
    db.commit()


def reorder_lesson(db: Session, admin: User, lesson: CourseLesson, direction: str) -> CourseLesson:
    _reorder(db, list_lessons(db, lesson.module), lesson, direction)
    audit.log(db, admin, "course", f"Reordered lesson '{lesson.title}'")
    db.commit()
    db.refresh(lesson)
    return lesson


# ── quizzes ──────────────────────────────────────────────────────────────


def get_module_quiz(db: Session, module: CourseModule) -> CourseQuiz | None:
    return db.query(CourseQuiz).filter(CourseQuiz.module_id == module.id).first()


def get_final_exam(db: Session, course: Course) -> CourseQuiz | None:
    return db.query(CourseQuiz).filter(CourseQuiz.course_id == course.id, CourseQuiz.kind == QuizKind.final_exam).first()


def create_module_quiz(db: Session, admin: User, module: CourseModule, fields: dict) -> CourseQuiz:
    if get_module_quiz(db, module):
        raise CourseError(f"Module '{module.title}' already has a quiz")
    quiz = CourseQuiz(kind=QuizKind.module_quiz, course_id=module.course_id, module_id=module.id, **fields)
    db.add(quiz)
    audit.log(db, admin, "course", f"Added quiz to module '{module.title}'")
    db.commit()
    db.refresh(quiz)
    return quiz


def create_final_exam(db: Session, admin: User, course: Course, fields: dict) -> CourseQuiz:
    if get_final_exam(db, course):
        raise CourseError(f"'{course.title}' already has a final exam")
    quiz = CourseQuiz(kind=QuizKind.final_exam, course_id=course.id, module_id=None, **fields)
    db.add(quiz)
    audit.log(db, admin, "course", f"Added final exam to {course.title}")
    db.commit()
    db.refresh(quiz)
    return quiz


def update_quiz(db: Session, admin: User, quiz: CourseQuiz, fields: dict) -> CourseQuiz:
    for key, value in fields.items():
        setattr(quiz, key, value)
    audit.log(db, admin, "course", f"Updated quiz '{quiz.title}'")
    db.commit()
    db.refresh(quiz)
    return quiz


def delete_quiz(db: Session, admin: User, quiz: CourseQuiz) -> None:
    if quiz.course.published_at is not None:
        raise CourseError("Unpublish the course before deleting a quiz")
    audit.log(db, admin, "course", f"Deleted quiz '{quiz.title}'")
    db.delete(quiz)
    db.commit()


# ── questions ────────────────────────────────────────────────────────────


def list_questions(db: Session, quiz: CourseQuiz) -> list[CourseQuizQuestion]:
    return (
        db.query(CourseQuizQuestion)
        .filter(CourseQuizQuestion.quiz_id == quiz.id)
        .order_by(CourseQuizQuestion.position.asc())
        .all()
    )


def get_question(db: Session, question_id) -> CourseQuizQuestion:
    question = db.get(CourseQuizQuestion, question_id)
    if not question:
        raise CourseError("Unknown question")
    return question


def create_question(db: Session, admin: User, quiz: CourseQuiz, fields: dict) -> CourseQuizQuestion:
    max_pos = (
        db.query(func.max(CourseQuizQuestion.position)).filter(CourseQuizQuestion.quiz_id == quiz.id).scalar() or 0
    )
    question = CourseQuizQuestion(quiz_id=quiz.id, position=max_pos + 1, **fields)
    db.add(question)
    audit.log(db, admin, "course", f"Added a question to quiz '{quiz.title}'")
    db.commit()
    db.refresh(question)
    return question


def update_question(db: Session, admin: User, question: CourseQuizQuestion, fields: dict) -> CourseQuizQuestion:
    for key, value in fields.items():
        setattr(question, key, value)
    audit.log(db, admin, "course", f"Updated a question in quiz '{question.quiz.title}'")
    db.commit()
    db.refresh(question)
    return question


def delete_question(db: Session, admin: User, question: CourseQuizQuestion) -> None:
    if question.quiz.course.published_at is not None:
        raise CourseError("Unpublish the course before deleting a question")
    audit.log(db, admin, "course", f"Deleted a question from quiz '{question.quiz.title}'")
    db.delete(question)
    db.commit()


def reorder_question(db: Session, admin: User, question: CourseQuizQuestion, direction: str) -> CourseQuizQuestion:
    _reorder(db, list_questions(db, question.quiz), question, direction)
    audit.log(db, admin, "course", f"Reordered a question in quiz '{question.quiz.title}'")
    db.commit()
    db.refresh(question)
    return question


# ── enrollment ───────────────────────────────────────────────────────────


def get_enrollment(db: Session, course: Course, user: User) -> CourseEnrollment | None:
    return (
        db.query(CourseEnrollment)
        .filter(CourseEnrollment.course_id == course.id, CourseEnrollment.user_id == user.id)
        .first()
    )


def has_course_access(db: Session, user: User, course: Course) -> bool:
    """Re-checked on every content-bearing read, not just at enroll time —
    a free_member's access tracks their CURRENT membership status (it lapses
    the moment membership does) UNLESS the course itself is priced at zero,
    in which case it's free for everyone regardless of membership and never
    revoked. Paid access is permanent once the fee actually clears,
    regardless of membership status thereafter."""
    if user.is_admin:
        return True
    enrollment = get_enrollment(db, course, user)
    if not enrollment:
        return False
    if enrollment.access == CourseAccessType.free_member:
        return course.price_kes <= 0 or is_active_member(user)
    payment = course_payment.latest_payment_for(db, enrollment.id)
    return bool(payment and payment.status == PaymentStatus.completed)


def enroll(db: Session, slug: str, user: User, phone: str | None) -> CourseEnrollment:
    course = get_published_course(db, slug)

    if get_enrollment(db, course, user):
        raise CourseError("You're already enrolled in this course")

    # Free for active members and admins, and for anyone when the course
    # itself is priced at zero — otherwise a non-member has to pay.
    if is_active_member(user) or course.price_kes <= 0:
        enrollment = CourseEnrollment(course_id=course.id, user_id=user.id, access=CourseAccessType.free_member)
        db.add(enrollment)
        db.commit()
        db.refresh(enrollment)
        return enrollment

    if not phone:
        raise CourseError(f"A phone number is required to pay the KSh {course.price_kes} course fee")

    enrollment = CourseEnrollment(course_id=course.id, user_id=user.id, access=CourseAccessType.paid)
    db.add(enrollment)
    db.flush()
    try:
        course_payment.start_course_payment(db, enrollment, phone, course.price_kes)
    except course_payment.CoursePaymentError as exc:
        # Nothing committed yet — roll back the enrollment too, rather than
        # leaving an unpaid enrollment behind a payment that never sent.
        db.rollback()
        raise CourseError(str(exc)) from exc

    db.commit()
    db.refresh(enrollment)
    return enrollment


# ── learner access (lessons / quizzes / progress) ───────────────────────


def require_access(db: Session, user: User, course: Course) -> None:
    if not has_course_access(db, user, course):
        raise CourseAccessDenied("You don't have access to this course")


def get_enrollment_for_access(db: Session, course: Course, user: User) -> CourseEnrollment | None:
    """Read-path gate: raises if access is denied, but returns None (not
    an error) when the caller is an admin QA-ing content without ever
    enrolling — module-lock and completion logic below already treat a
    None enrollment as "show everything unlocked, nothing completed"."""
    require_access(db, user, course)
    return get_enrollment(db, course, user)


def require_enrollment(db: Session, course: Course, user: User) -> CourseEnrollment:
    """Write-path gate for lesson-complete / quiz-attempt — those need a
    real enrollment row to attach to, so even an admin must actually
    enroll (like anyone else) to submit an attempt."""
    require_access(db, user, course)
    enrollment = get_enrollment(db, course, user)
    if not enrollment:
        raise CourseAccessDenied("Enroll in this course first")
    return enrollment


def get_module_in_course(db: Session, course: Course, module_id) -> CourseModule:
    module = get_module(db, module_id)
    if module.course_id != course.id:
        raise CourseError("Unknown module")
    return module


def get_lesson_in_course(db: Session, course: Course, lesson_id) -> CourseLesson:
    lesson = get_lesson(db, lesson_id)
    if lesson.module.course_id != course.id:
        raise CourseError("Unknown lesson")
    return lesson


def has_passed_quiz(db: Session, quiz: CourseQuiz, enrollment: CourseEnrollment | None) -> bool:
    if not enrollment:
        return False
    return (
        db.query(CourseQuizAttempt)
        .filter(
            CourseQuizAttempt.enrollment_id == enrollment.id,
            CourseQuizAttempt.quiz_id == quiz.id,
            CourseQuizAttempt.passed.is_(True),
        )
        .first()
        is not None
    )


def compute_module_lock_states(
    db: Session, course: Course, enrollment: CourseEnrollment | None
) -> dict[uuid.UUID, bool]:
    """A module is locked until every earlier module's quiz has been
    passed — sequential, computed fresh on every read rather than stored,
    so it can never drift from the attempts table. enrollment=None (admin
    QA, never enrolled) sees every module unlocked."""
    states: dict[uuid.UUID, bool] = {}
    unlocked_so_far = True
    for module in list_modules(db, course):
        states[module.id] = not unlocked_so_far
        if not enrollment:
            continue
        quiz = get_module_quiz(db, module)
        unlocked_so_far = unlocked_so_far and bool(quiz and has_passed_quiz(db, quiz, enrollment))
    return states


def is_module_locked(db: Session, course: Course, module: CourseModule, enrollment: CourseEnrollment | None) -> bool:
    return compute_module_lock_states(db, course, enrollment)[module.id]


def all_module_quizzes_passed(db: Session, course: Course, enrollment: CourseEnrollment | None) -> bool:
    if not enrollment:
        return True
    for module in list_modules(db, course):
        quiz = get_module_quiz(db, module)
        if not quiz or not has_passed_quiz(db, quiz, enrollment):
            return False
    return True


def is_lesson_completed(db: Session, enrollment: CourseEnrollment | None, lesson: CourseLesson) -> bool:
    if not enrollment:
        return False
    return (
        db.query(CourseLessonCompletion)
        .filter(CourseLessonCompletion.enrollment_id == enrollment.id, CourseLessonCompletion.lesson_id == lesson.id)
        .first()
        is not None
    )


def mark_lesson_complete(db: Session, enrollment: CourseEnrollment, lesson: CourseLesson) -> None:
    if is_lesson_completed(db, enrollment, lesson):
        return
    db.add(CourseLessonCompletion(enrollment_id=enrollment.id, lesson_id=lesson.id))
    db.commit()


def grade_quiz_attempt(
    db: Session, enrollment: CourseEnrollment, quiz: CourseQuiz, answers: list[dict]
) -> CourseQuizAttempt:
    """Module quizzes require a perfect score to pass — pass_threshold_pct
    is ignored entirely for that kind, and only ever applies to the final
    exam. Unknown question_ids in the payload are ignored and a missing or
    invalid choice_id just counts as wrong, so a malformed submission never
    500s. Every submission is stored as a new row (append-only history) so
    an admin later editing pass_threshold_pct can't retroactively flip a
    result that already happened."""
    questions = list_questions(db, quiz)
    submitted = {a["question_id"]: a.get("choice_id") for a in answers}

    graded: list[dict] = []
    correct_count = 0
    for question in questions:
        submitted_choice_id = submitted.get(question.id)
        correct = submitted_choice_id is not None and submitted_choice_id == question.correct_choice_id
        correct_count += int(correct)
        graded.append(
            {
                "question_id": str(question.id),
                "prompt": question.prompt,
                "choices": question.choices,
                "submitted_choice_id": submitted_choice_id,
                "correct_choice_id": question.correct_choice_id,
                "explanation": question.explanation,
                "correct": correct,
            }
        )

    score_pct = (100 * correct_count / len(questions)) if questions else 0.0
    passed = score_pct == 100 if quiz.kind == QuizKind.module_quiz else score_pct >= quiz.pass_threshold_pct

    attempt = CourseQuizAttempt(
        enrollment_id=enrollment.id, quiz_id=quiz.id, score_pct=score_pct, passed=passed, answers=graded
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return attempt


def attempt_final_exam(
    db: Session, course: Course, enrollment: CourseEnrollment, answers: list[dict]
) -> CourseQuizAttempt:
    quiz = get_final_exam(db, course)
    if not quiz:
        raise CourseError("This course has no final exam")
    attempt = grade_quiz_attempt(db, enrollment, quiz, answers)
    if attempt.passed:
        complete_course(db, enrollment)
    return attempt


def complete_course(db: Session, enrollment: CourseEnrollment) -> None:
    """Idempotent — only ever fires the notification once, on the first
    final-exam pass."""
    if enrollment.completed_at:
        return
    enrollment.completed_at = datetime.now(UTC)
    notification.notify(
        db,
        enrollment.user,
        "course",
        f"You completed {enrollment.course.title} \U0001f393",
        "Nice work — your certificate is ready.",
    )
    db.commit()


def build_course_progress(db: Session, course: Course, enrollment: CourseEnrollment) -> dict:
    lock_states = compute_module_lock_states(db, course, enrollment)
    module_rows = []
    for module in list_modules(db, course):
        quiz = get_module_quiz(db, module)
        lessons = list_lessons(db, module)
        module_rows.append(
            {
                "id": module.id,
                "title": module.title,
                "locked": lock_states[module.id],
                "quiz_passed": bool(quiz and has_passed_quiz(db, quiz, enrollment)),
                "lessons_completed": sum(1 for lesson in lessons if is_lesson_completed(db, enrollment, lesson)),
                "lessons_total": len(lessons),
            }
        )
    final_exam = get_final_exam(db, course)
    return {
        "modules": module_rows,
        "capstone_status": None,
        "final_exam_passed": bool(final_exam and has_passed_quiz(db, final_exam, enrollment)),
        "completed_at": enrollment.completed_at,
    }


def list_completed_courses(db: Session, user_id) -> list[Course]:
    """Badge shelf on the public member profile — anyone whose profile
    visibility already lets a viewer see it gets to see which courses they
    finished too; this doesn't add its own visibility check."""
    return (
        db.query(Course)
        .join(CourseEnrollment, CourseEnrollment.course_id == Course.id)
        .filter(CourseEnrollment.user_id == user_id, CourseEnrollment.completed_at.isnot(None))
        .order_by(CourseEnrollment.completed_at.desc())
        .all()
    )


def list_my_enrollments_summary(db: Session, user: User) -> list[dict]:
    enrollments = (
        db.query(CourseEnrollment)
        .filter(CourseEnrollment.user_id == user.id)
        .order_by(CourseEnrollment.enrolled_at.desc())
        .all()
    )
    rows = []
    for enrollment in enrollments:
        course = enrollment.course
        modules = list_modules(db, course)
        modules_completed = sum(
            1
            for module in modules
            if (quiz := get_module_quiz(db, module)) and has_passed_quiz(db, quiz, enrollment)
        )
        rows.append(
            {
                "slug": course.slug,
                "title": course.title,
                "cover_image_url": course.cover_image_url,
                "completed_at": enrollment.completed_at,
                "modules_total": len(modules),
                "modules_completed": modules_completed,
            }
        )
    return rows
