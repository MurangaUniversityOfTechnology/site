from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user, get_current_user_optional, require_staff
from app.models.community import CommunityPost
from app.models.user import User
from app.schemas.community import (
    CommunityCommentRow,
    CommunityPostDetail,
    CommunityPostRow,
    CreateCommentRequest,
    CreatePostRequest,
    HideRequest,
    PollVoteRequest,
    UpdateCommentRequest,
    UpdatePostRequest,
    VoteRequest,
)
from app.schemas.upload import FileUploadResponse
from app.services import community as community_service
from app.services import uploads as uploads_service

router = APIRouter(prefix="/community", tags=["community"])


@router.post("/uploads", response_model=FileUploadResponse)
def upload_attachment(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    try:
        url = uploads_service.upload_file(
            file.file.read(),
            file.content_type,
            folder="mut-tech/community",
            allowed_types=uploads_service.COMMUNITY_ALLOWED_CONTENT_TYPES,
        )
    except uploads_service.UploadError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return FileUploadResponse(url=url)


def _get_post_or_404(db: Session, viewer: User | None, post_id: str) -> CommunityPost:
    post = community_service.get_post(db, viewer, post_id)
    if not post:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found")
    return post


@router.get("/posts", response_model=list[CommunityPostRow])
def list_posts(
    kind: str | None = None,
    user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    return community_service.list_posts(db, user, kind)


@router.get("/posts/{post_id}", response_model=CommunityPostDetail)
def get_post(post_id: str, user: User | None = Depends(get_current_user_optional), db: Session = Depends(get_db)):
    post = _get_post_or_404(db, user, post_id)
    return community_service.shape_detail(db, post, user)


@router.post("/posts", response_model=CommunityPostRow, status_code=status.HTTP_201_CREATED)
def create_post(payload: CreatePostRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        post = community_service.create_post(
            db, user, payload.kind, payload.title, payload.body, payload.is_anonymous, payload.options, payload.attachments
        )
    except community_service.CommunityError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return community_service.shape_post(db, post, user)


@router.patch("/posts/{post_id}", response_model=CommunityPostRow)
def update_post(
    post_id: str, payload: UpdatePostRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    post = _get_post_or_404(db, user, post_id)
    if post.author_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only edit your own post")
    try:
        community_service.update_post(db, post, payload.title, payload.body, payload.is_anonymous, payload.attachments)
    except community_service.CommunityError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return community_service.shape_post(db, post, user)


@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(post_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    post = _get_post_or_404(db, user, post_id)
    if post.author_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only delete your own post")
    community_service.delete_post(db, user, post)


@router.post("/posts/{post_id}/vote", response_model=CommunityPostRow)
def vote(
    post_id: str, payload: VoteRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    post = _get_post_or_404(db, user, post_id)
    try:
        community_service.vote(db, user, post, payload.value)
    except community_service.CommunityError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return community_service.shape_post(db, post, user)


@router.post("/posts/{post_id}/poll-vote", response_model=CommunityPostRow)
def poll_vote(
    post_id: str, payload: PollVoteRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    post = _get_post_or_404(db, user, post_id)
    try:
        community_service.poll_vote(db, user, post, payload.option_id)
    except community_service.CommunityError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return community_service.shape_post(db, post, user)


@router.post("/posts/{post_id}/comments", response_model=CommunityPostDetail, status_code=status.HTTP_201_CREATED)
def add_comment(
    post_id: str, payload: CreateCommentRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    post = _get_post_or_404(db, user, post_id)
    try:
        community_service.add_comment(db, user, post, payload.body, payload.is_anonymous, payload.attachments)
    except community_service.CommunityError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return community_service.shape_detail(db, post, user)


@router.patch("/comments/{comment_id}", response_model=CommunityCommentRow)
def update_comment(
    comment_id: str, payload: UpdateCommentRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    comment = community_service.get_comment_visible(db, user, comment_id)
    if not comment:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Comment not found")
    if comment.author_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only edit your own comment")
    try:
        community_service.update_comment(db, comment, payload.body, payload.is_anonymous, payload.attachments)
    except community_service.CommunityError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return community_service.shape_comment(db, comment, user)


@router.post("/comments/{comment_id}/vote", response_model=CommunityCommentRow)
def vote_comment(
    comment_id: str, payload: VoteRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    comment = community_service.get_comment_visible(db, user, comment_id)
    if not comment:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Comment not found")
    try:
        community_service.vote_comment(db, user, comment, payload.value)
    except community_service.CommunityError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return community_service.shape_comment(db, comment, user)


@router.post("/posts/{post_id}/hide", dependencies=[Depends(require_staff)])
def hide_post(
    post_id: str, payload: HideRequest, staff: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    post = _get_post_or_404(db, staff, post_id)
    community_service.hide_post(db, staff, post, payload.reason)


@router.post("/posts/{post_id}/unhide", dependencies=[Depends(require_staff)])
def unhide_post(post_id: str, staff: User = Depends(get_current_user), db: Session = Depends(get_db)):
    post = _get_post_or_404(db, staff, post_id)
    community_service.unhide_post(db, staff, post)


@router.post("/comments/{comment_id}/hide", dependencies=[Depends(require_staff)])
def hide_comment(
    comment_id: str, payload: HideRequest, staff: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    comment = community_service.get_comment(db, comment_id)
    if not comment:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Comment not found")
    community_service.hide_comment(db, staff, comment, payload.reason)


@router.post("/comments/{comment_id}/unhide", dependencies=[Depends(require_staff)])
def unhide_comment(comment_id: str, staff: User = Depends(get_current_user), db: Session = Depends(get_db)):
    comment = community_service.get_comment(db, comment_id)
    if not comment:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Comment not found")
    community_service.unhide_comment(db, staff, comment)
