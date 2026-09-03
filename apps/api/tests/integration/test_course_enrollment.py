import httpx
import pytest
import respx

from app.models.course_enrollment import CourseAccessType, CourseEnrollment
from app.models.course_payment import CoursePayment
from app.models.membership import MembershipStatus
from app.models.payment import PaymentStatus
from app.services import course as course_service
from app.services import course_payment

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
        module = course_service.create_module(db_session, admin, course, {"title": "Module 1", "summary": None})
        quiz = course_service.create_module_quiz(
            db_session, admin, module, {"title": "Quiz", "intro_text": None, "pass_threshold_pct": 80}
        )
        course_service.create_question(
            db_session,
            admin,
            quiz,
            {
                "prompt": "2 + 2?",
                "choices": [{"id": "a", "text": "3"}, {"id": "b", "text": "4"}],
                "correct_choice_ids": ["b"],
                "explanation": None,
            },
        )
        final_exam = course_service.create_final_exam(
            db_session, admin, course, {"title": "Final Exam", "intro_text": "Long", "pass_threshold_pct": 70}
        )
        course_service.create_question(
            db_session,
            admin,
            final_exam,
            {
                "prompt": "3 + 3?",
                "choices": [{"id": "a", "text": "6"}, {"id": "b", "text": "5"}],
                "correct_choice_ids": ["a"],
                "explanation": None,
            },
        )
        course_service.publish_course(db_session, admin, course)
        return course, admin

    return _make


def _stk_callback(checkout_request_id, result_code, result_desc="", items=None):
    body = {
        "MerchantRequestID": "mr-1",
        "CheckoutRequestID": checkout_request_id,
        "ResultCode": result_code,
        "ResultDesc": result_desc,
    }
    if items is not None:
        body["CallbackMetadata"] = {"Item": items}
    return {"Body": {"stkCallback": body}}


# ── free access ──────────────────────────────────────────────────────────


def test_active_member_gets_instant_free_access(db_session, make_course, make_user):
    course, _ = make_course(price_kes=500)
    student = make_user(email="member@example.com", membership_status=MembershipStatus.active)

    enrollment = course_service.enroll(db_session, course.slug, student, None)
    assert enrollment.access == CourseAccessType.free_member
    assert db_session.query(CoursePayment).count() == 0
    assert course_service.has_course_access(db_session, student, course)


def test_admin_gets_instant_access_regardless_of_membership(db_session, make_course, make_user):
    course, _ = make_course(price_kes=500)
    admin_student = make_user(email="admin-student@example.com", is_admin=True)
    enrollment = course_service.enroll(db_session, course.slug, admin_student, None)
    assert enrollment.access == CourseAccessType.free_member
    assert course_service.has_course_access(db_session, admin_student, course)


def test_free_course_grants_access_to_non_member(db_session, make_course, make_user):
    course, _ = make_course(price_kes=0)
    non_member = make_user(email="nonmember@example.com")
    enrollment = course_service.enroll(db_session, course.slug, non_member, None)
    assert enrollment.access == CourseAccessType.free_member
    assert course_service.has_course_access(db_session, non_member, course)


# ── paid access ──────────────────────────────────────────────────────────


def test_non_member_paid_course_requires_phone(db_session, make_course, make_user):
    course, _ = make_course(price_kes=500)
    non_member = make_user(email="nonmember@example.com")
    with pytest.raises(course_service.CourseError, match="phone"):
        course_service.enroll(db_session, course.slug, non_member, None)


def test_non_member_paid_course_starts_pending_payment(db_session, make_course, make_user, mock_mpesa_success):
    course, _ = make_course(price_kes=500)
    non_member = make_user(email="nonmember@example.com")

    enrollment = course_service.enroll(db_session, course.slug, non_member, "0712345678")
    assert enrollment.access == CourseAccessType.paid
    assert not course_service.has_course_access(db_session, non_member, course)

    payment = course_payment.latest_payment_for(db_session, enrollment.id)
    assert payment.status == PaymentStatus.pending
    assert payment.checkout_request_id == "ws_CO_1"
    assert payment.amount == 500


def test_paid_course_daraja_failure_rolls_back_enrollment(db_session, make_course, make_user):
    course, _ = make_course(price_kes=500)
    non_member = make_user(email="nonmember@example.com")

    with respx.mock(assert_all_called=False) as m:
        m.get(url__regex=r".*/oauth/v1/generate").mock(return_value=httpx.Response(200, json={"access_token": "tok"}))
        m.post(url__regex=r".*/mpesa/stkpush/v1/processrequest").mock(
            return_value=httpx.Response(200, json={"errorCode": "500.001.1001", "errorMessage": "Invalid Access Token"})
        )
        with pytest.raises(course_service.CourseError):
            course_service.enroll(db_session, course.slug, non_member, "0712345678")

    assert db_session.query(CoursePayment).count() == 0
    assert db_session.query(CourseEnrollment).count() == 0


def test_double_enroll_blocked(db_session, make_course, make_user):
    course, _ = make_course(price_kes=0)
    student = make_user(email="student@example.com")
    course_service.enroll(db_session, course.slug, student, None)
    with pytest.raises(course_service.CourseError, match="already enrolled"):
        course_service.enroll(db_session, course.slug, student, None)


def test_course_stk_callback_marks_payment_completed(db_session, make_course, make_user, mock_mpesa_success):
    course, _ = make_course(price_kes=500)
    non_member = make_user(email="nonmember@example.com")
    enrollment = course_service.enroll(db_session, course.slug, non_member, "0712345678")

    payload = _stk_callback(
        "ws_CO_1", 0, items=[{"Name": "Amount", "Value": 500.0}, {"Name": "MpesaReceiptNumber", "Value": "XYZ789"}]
    )
    course_payment.apply_stk_callback(db_session, payload)

    payment = course_payment.latest_payment_for(db_session, enrollment.id)
    assert payment.status == PaymentStatus.completed
    assert payment.mpesa_receipt == "XYZ789"
    assert course_service.has_course_access(db_session, non_member, course)


def test_course_mpesa_callback_endpoint(client, db_session, make_course, make_user, mock_mpesa_success):
    course, _ = make_course(price_kes=500)
    non_member = make_user(email="nonmember@example.com")
    enrollment = course_service.enroll(db_session, course.slug, non_member, "0712345678")

    payload = _stk_callback("ws_CO_1", 0, items=[{"Name": "Amount", "Value": 500.0}, {"Name": "MpesaReceiptNumber", "Value": "XYZ789"}])
    res = client.post("/courses/mpesa/callback", json=payload)
    assert res.status_code == 200

    payment = course_payment.latest_payment_for(db_session, enrollment.id)
    assert payment.status == PaymentStatus.completed


# ── the asymmetry that matters most: free vs paid access under a lapsed membership ──


def test_free_member_access_revoked_when_membership_lapses(db_session, make_course, make_user):
    course, _ = make_course(price_kes=500)
    student = make_user(email="member@example.com", membership_status=MembershipStatus.active)
    course_service.enroll(db_session, course.slug, student, None)
    assert course_service.has_course_access(db_session, student, course)

    student.membership.status = MembershipStatus.expired
    db_session.commit()

    assert not course_service.has_course_access(db_session, student, course)


def test_paid_access_survives_membership_never_being_active(db_session, make_course, make_user, mock_mpesa_success):
    course, _ = make_course(price_kes=500)
    non_member = make_user(email="nonmember@example.com")
    course_service.enroll(db_session, course.slug, non_member, "0712345678")

    payload = _stk_callback("ws_CO_1", 0, items=[{"Name": "Amount", "Value": 500.0}, {"Name": "MpesaReceiptNumber", "Value": "XYZ789"}])
    course_payment.apply_stk_callback(db_session, payload)

    # Never became a member, before or after paying — access still holds,
    # because it was bought outright rather than derived from membership.
    assert non_member.membership.status == MembershipStatus.none
    assert course_service.has_course_access(db_session, non_member, course)


# ── HTTP surface ─────────────────────────────────────────────────────────


def test_enroll_endpoint_requires_login(client, make_course):
    course, _ = make_course(price_kes=0)
    res = client.post(f"/courses/{course.slug}/enroll", json={})
    assert res.status_code == 401


def test_enroll_endpoint_returns_nested_payment(client, make_course, make_user, login_as, mock_mpesa_success):
    course, _ = make_course(price_kes=500)
    student = make_user(email="student@example.com")
    login_as(student)

    res = client.post(f"/courses/{course.slug}/enroll", json={"phone": "0712345678"})
    assert res.status_code == 201
    body = res.json()
    assert body["access"] == "paid"
    assert body["payment"]["status"] == "pending"
    assert body["payment"]["amount"] == 500


def test_course_detail_404s_for_draft_course(client, db_session, make_user):
    admin = make_user(is_admin=True, email="draft-admin@example.com")
    draft = course_service.create_course(
        db_session,
        admin,
        {
            "slug": "draft-course",
            "title": "Draft",
            "short_description": "",
            "description": "",
            "cover_image_url": None,
            "price_kes": 0,
        },
    )
    res = client.get(f"/courses/{draft.slug}")
    assert res.status_code == 404


def test_course_catalog_lists_only_published(client, db_session, make_user):
    admin = make_user(is_admin=True, email="draft-admin2@example.com")
    course_service.create_course(
        db_session,
        admin,
        {
            "slug": "still-a-draft",
            "title": "Draft",
            "short_description": "",
            "description": "",
            "cover_image_url": None,
            "price_kes": 0,
        },
    )
    res = client.get("/courses")
    assert res.status_code == 200
    assert all(c["slug"] != "still-a-draft" for c in res.json())


# ── admin ledger ─────────────────────────────────────────────────────────


def test_admin_payments_ledger_includes_course_fees(
    client, db_session, make_course, make_user, login_as, mock_mpesa_success
):
    course, admin = make_course(price_kes=500)
    non_member = make_user(email="nonmember@example.com")
    course_service.enroll(db_session, course.slug, non_member, "0712345678")

    login_as(admin)
    res = client.get("/admin/payments")
    assert res.status_code == 200
    rows = res.json()["rows"]
    assert any(r["source"] == "course" for r in rows)
