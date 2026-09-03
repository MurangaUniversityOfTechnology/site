import pytest

from app.models.membership import MembershipStatus
from app.services import course as course_service

pytestmark = pytest.mark.integration


@pytest.fixture
def make_course(db_session, make_user):
    counter = {"n": 0}

    def _make(*, price_kes=0, admin=None):
        counter["n"] += 1
        admin = admin or make_user(is_admin=True, email=f"course-admin-{counter['n']}@example.com")
        course = course_service.create_course(
            db_session,
            admin,
            {
                "slug": f"course-{counter['n']}",
                "title": f"Course {counter['n']}",
                "short_description": "short",
                "description": "full description",
                "cover_image_url": None,
                "price_kes": price_kes,
            },
        )
        return course, admin

    return _make


def _fully_structure(db_session, admin, course):
    """Adds one module with a passing quiz question, plus a final exam
    with a question — the minimum shape publish_course() will accept."""
    module = course_service.create_module(db_session, admin, course, {"title": "Module 1", "summary": None})
    quiz = course_service.create_module_quiz(
        db_session, admin, module, {"title": "Module 1 Quiz", "intro_text": None, "pass_threshold_pct": 80}
    )
    course_service.create_question(
        db_session,
        admin,
        quiz,
        {
            "prompt": "2 + 2?",
            "choices": [{"id": "a", "text": "3"}, {"id": "b", "text": "4"}],
            "correct_choice_id": "b",
            "explanation": None,
        },
    )
    final_exam = course_service.create_final_exam(
        db_session, admin, course, {"title": "Final Exam", "intro_text": "Long exam", "pass_threshold_pct": 70}
    )
    course_service.create_question(
        db_session,
        admin,
        final_exam,
        {
            "prompt": "3 + 3?",
            "choices": [{"id": "a", "text": "6"}, {"id": "b", "text": "5"}],
            "correct_choice_id": "a",
            "explanation": None,
        },
    )
    return module, quiz, final_exam


# ── admin CRUD over HTTP ─────────────────────────────────────────────────


def test_create_course_requires_admin(client, make_user, login_as):
    user = make_user()
    login_as(user)
    res = client.post("/admin/courses", json={"slug": "x", "title": "X"})
    assert res.status_code == 403


def test_create_course(client, make_user, login_as):
    admin = make_user(is_admin=True)
    login_as(admin)
    res = client.post("/admin/courses", json={"slug": "backend-101", "title": "Backend 101", "price_kes": 500})
    assert res.status_code == 201
    body = res.json()
    assert body["slug"] == "backend-101"
    assert body["published_at"] is None
    assert body["price_kes"] == 500


def test_create_course_rejects_duplicate_slug(client, make_user, login_as, make_course):
    course, admin = make_course()
    login_as(admin)
    res = client.post("/admin/courses", json={"slug": course.slug, "title": "Dupe"})
    assert res.status_code == 400


def test_update_course(client, make_course, login_as):
    course, admin = make_course()
    login_as(admin)
    res = client.patch(f"/admin/courses/{course.slug}", json={"title": "Renamed"})
    assert res.status_code == 200
    assert res.json()["title"] == "Renamed"


# ── publish validation ───────────────────────────────────────────────────


def test_publish_requires_at_least_one_module(db_session, make_course):
    course, admin = make_course()
    with pytest.raises(course_service.CourseError, match="module"):
        course_service.publish_course(db_session, admin, course)


def test_publish_requires_module_quiz(db_session, make_course):
    course, admin = make_course()
    course_service.create_module(db_session, admin, course, {"title": "Module 1", "summary": None})
    with pytest.raises(course_service.CourseError, match="quiz"):
        course_service.publish_course(db_session, admin, course)


def test_publish_requires_question_on_module_quiz(db_session, make_course):
    course, admin = make_course()
    module = course_service.create_module(db_session, admin, course, {"title": "Module 1", "summary": None})
    course_service.create_module_quiz(db_session, admin, module, {"title": "Quiz", "intro_text": None, "pass_threshold_pct": 80})
    with pytest.raises(course_service.CourseError, match="question"):
        course_service.publish_course(db_session, admin, course)


def test_publish_requires_final_exam(db_session, make_course):
    course, admin = make_course()
    module = course_service.create_module(db_session, admin, course, {"title": "Module 1", "summary": None})
    quiz = course_service.create_module_quiz(
        db_session, admin, module, {"title": "Quiz", "intro_text": None, "pass_threshold_pct": 80}
    )
    course_service.create_question(
        db_session, admin, quiz, {"prompt": "?", "choices": [{"id": "a", "text": "x"}, {"id": "b", "text": "y"}], "correct_choice_id": "a", "explanation": None}
    )
    with pytest.raises(course_service.CourseError, match="final exam"):
        course_service.publish_course(db_session, admin, course)


def test_publish_succeeds_when_fully_structured(db_session, make_course):
    course, admin = make_course()
    _fully_structure(db_session, admin, course)
    published = course_service.publish_course(db_session, admin, course)
    assert published.published_at is not None


def test_publish_endpoint_reports_specific_error(client, make_course, login_as):
    course, admin = make_course()
    login_as(admin)
    res = client.post(f"/admin/courses/{course.slug}/publish")
    assert res.status_code == 400
    assert "module" in res.json()["detail"]


# ── delete / archive guards ──────────────────────────────────────────────


def test_delete_course_blocked_when_enrolled(db_session, make_course, make_user):
    course, admin = make_course()
    _fully_structure(db_session, admin, course)
    course_service.publish_course(db_session, admin, course)
    student = make_user(email="student@example.com", membership_status=MembershipStatus.active)
    course_service.enroll(db_session, course.slug, student, None)

    with pytest.raises(course_service.CourseError, match="enrolled"):
        course_service.delete_course(db_session, admin, course)


def test_delete_module_blocked_once_published(db_session, make_course):
    course, admin = make_course()
    module, _, _ = _fully_structure(db_session, admin, course)
    course_service.publish_course(db_session, admin, course)

    with pytest.raises(course_service.CourseError, match="Unpublish"):
        course_service.delete_module(db_session, admin, module)


def test_archive_and_unarchive_course(db_session, make_course):
    course, admin = make_course()
    archived = course_service.archive_course(db_session, admin, course)
    assert archived.archived_at is not None

    unarchived = course_service.unarchive_course(db_session, admin, course)
    assert unarchived.archived_at is None


# ── reordering ───────────────────────────────────────────────────────────


def test_reorder_module_swaps_positions(db_session, make_course):
    course, admin = make_course()
    m1 = course_service.create_module(db_session, admin, course, {"title": "One", "summary": None})
    m2 = course_service.create_module(db_session, admin, course, {"title": "Two", "summary": None})
    assert (m1.position, m2.position) == (1, 2)

    course_service.reorder_module(db_session, admin, m2, "up")
    db_session.refresh(m1)
    db_session.refresh(m2)
    assert (m1.position, m2.position) == (2, 1)


def test_reorder_first_module_up_fails(db_session, make_course):
    course, admin = make_course()
    m1 = course_service.create_module(db_session, admin, course, {"title": "One", "summary": None})
    with pytest.raises(course_service.CourseError):
        course_service.reorder_module(db_session, admin, m1, "up")


# ── question authoring validation ───────────────────────────────────────


def test_question_correct_choice_must_match_a_choice(client, make_course, login_as):
    course, admin = make_course()
    login_as(admin)
    mres = client.post(f"/admin/courses/{course.slug}/modules", json={"title": "Module 1"})
    module_id = mres.json()["id"]
    qres = client.post(f"/admin/modules/{module_id}/quiz", json={"title": "Quiz"})
    quiz_id = qres.json()["id"]

    res = client.post(
        f"/admin/quizzes/{quiz_id}/questions",
        json={
            "prompt": "?",
            "choices": [{"id": "a", "text": "x"}, {"id": "b", "text": "y"}],
            "correct_choice_id": "z",
        },
    )
    assert res.status_code == 422
