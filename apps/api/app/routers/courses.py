from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user, get_current_user_optional
from app.core.rate_limit import limiter
from app.models.course import Course
from app.models.course_enrollment import CourseEnrollment
from app.models.user import User
from app.schemas.arm import ArmRow
from app.schemas.course import (
    CourseDetail,
    CourseModuleOutline,
    CoursePaymentStatusResponse,
    CourseSummary,
    EnrollmentResponse,
    EnrollRequest,
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
    enrolled = bool(user and course_service.get_enrollment(db, course, user))
    return CourseDetail(
        **_summary(db, course).model_dump(),
        description=course.description,
        enrolled=enrolled,
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
