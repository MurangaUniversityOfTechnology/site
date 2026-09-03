from datetime import UTC, datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.arm import Arm
from app.models.course import Course
from app.models.course_arm import CourseArm
from app.models.course_enrollment import CourseAccessType, CourseEnrollment
from app.models.course_lesson import CourseLesson
from app.models.course_module import CourseModule
from app.models.course_quiz import CourseQuiz, QuizKind
from app.models.course_quiz_question import CourseQuizQuestion
from app.models.payment import PaymentStatus
from app.models.user import User
from app.services import audit, course_payment
from app.services.membership_access import is_active_member


class CourseError(Exception):
    pass


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
