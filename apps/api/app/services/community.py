import uuid

from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.models.community import (
    CommunityComment,
    CommunityCommentVote,
    CommunityPollOption,
    CommunityPollVote,
    CommunityPost,
    CommunityPostKind,
    CommunityVote,
)
from app.models.user import User
from app.schemas.community import (
    CommunityCommentRow,
    CommunityPostDetail,
    CommunityPostRow,
    LinkPreviewOut,
    PollOptionOut,
)
from app.services import audit, link_preview


class CommunityError(Exception):
    pass


def _excerpt(body: str | None, max_length: int = 180) -> str | None:
    if not body:
        return None
    flat = " ".join(body.split())
    if len(flat) <= max_length:
        return flat
    return f"{flat[:max_length].rstrip()}…"


def _author_display(author: User, is_anonymous: bool, viewer: User | None) -> str:
    can_see_real_author = viewer is not None and (viewer.is_admin or viewer.is_staff)
    if is_anonymous and not can_see_real_author:
        return "Anonymous"
    return author.profile.display_name if author.profile and author.profile.display_name else author.email


def _validate_attachments(urls: list[str]) -> None:
    """Attachments must be URLs this site's own /community/uploads endpoint
    handed back — not arbitrary hotlinks. (Arbitrary external links are
    already supported separately via the link-preview feature.)"""
    if not urls:
        return
    prefix = f"https://res.cloudinary.com/{get_settings().cloudinary_cloud_name}/"
    for url in urls:
        if not url.startswith(prefix):
            raise CommunityError("Attachments must be uploaded through this site")


def create_post(
    db: Session,
    user: User,
    kind: str,
    title: str,
    body: str | None,
    is_anonymous: bool,
    options: list[str],
    attachments: list[str],
) -> CommunityPost:
    try:
        post_kind = CommunityPostKind(kind)
    except ValueError as exc:
        raise CommunityError("kind must be 'question' or 'poll'") from exc

    if post_kind is CommunityPostKind.poll:
        cleaned = [o.strip() for o in options if o.strip()]
        if len(cleaned) < 2:
            raise CommunityError("A poll needs at least 2 options")
        options = cleaned
    else:
        options = []

    _validate_attachments(attachments)

    post = CommunityPost(
        kind=post_kind,
        author_id=user.id,
        is_anonymous=is_anonymous,
        title=title,
        body=body,
        attachments=attachments,
    )

    preview_url = link_preview.extract_first_url(title, body)
    if preview_url:
        preview = link_preview.fetch_preview(preview_url)
        if preview:
            post.link_url = preview.url
            post.link_title = preview.title
            post.link_description = preview.description
            post.link_image_url = preview.image_url
            post.link_site_name = preview.site_name

    db.add(post)
    db.flush()
    for i, label in enumerate(options):
        db.add(CommunityPollOption(post_id=post.id, label=label, position=i))
    db.commit()
    db.refresh(post)
    return post


def _base_query(db: Session, viewer: User | None):
    q = db.query(CommunityPost).options(selectinload(CommunityPost.options))
    if not (viewer and (viewer.is_admin or viewer.is_staff)):
        q = q.filter(CommunityPost.is_hidden.is_(False))
    return q


def list_posts(db: Session, viewer: User | None, kind: str | None = None) -> list[CommunityPostRow]:
    q = _base_query(db, viewer)
    if kind:
        q = q.filter(CommunityPost.kind == kind)
    posts = q.order_by(CommunityPost.created_at.desc()).limit(100).all()
    return [shape_post(db, p, viewer) for p in posts]


def get_post(db: Session, viewer: User | None, post_id: uuid.UUID) -> CommunityPost | None:
    post = _base_query(db, viewer).filter(CommunityPost.id == post_id).first()
    return post


def shape_detail(db: Session, post: CommunityPost, viewer: User | None) -> CommunityPostDetail:
    row = shape_post(db, post, viewer)
    comments_q = db.query(CommunityComment).filter(CommunityComment.post_id == post.id)
    if not (viewer and (viewer.is_admin or viewer.is_staff)):
        comments_q = comments_q.filter(CommunityComment.is_hidden.is_(False))
    comments = comments_q.order_by(CommunityComment.created_at.asc()).all()
    return CommunityPostDetail(
        **row.model_dump(),
        body=post.body,
        comments=[shape_comment(db, c, viewer) for c in comments],
    )


def shape_post(db: Session, post: CommunityPost, viewer: User | None) -> CommunityPostRow:
    comment_count = (
        db.query(func.count(CommunityComment.id))
        .filter(CommunityComment.post_id == post.id, CommunityComment.is_hidden.is_(False))
        .scalar()
        or 0
    )

    link = None
    if post.link_url:
        link = LinkPreviewOut(
            url=post.link_url,
            title=post.link_title,
            description=post.link_description,
            image_url=post.link_image_url,
            site_name=post.link_site_name,
        )

    score = None
    my_vote = None
    options_out = None
    my_option_id = None

    if post.kind is CommunityPostKind.question:
        score = db.query(func.coalesce(func.sum(CommunityVote.value), 0)).filter(CommunityVote.post_id == post.id).scalar()
        if viewer:
            mine = (
                db.query(CommunityVote)
                .filter(CommunityVote.post_id == post.id, CommunityVote.user_id == viewer.id)
                .first()
            )
            my_vote = mine.value if mine else None
    else:
        counts = dict(
            db.query(CommunityPollVote.option_id, func.count(CommunityPollVote.id))
            .filter(CommunityPollVote.post_id == post.id)
            .group_by(CommunityPollVote.option_id)
            .all()
        )
        options_out = [
            PollOptionOut(id=o.id, label=o.label, position=o.position, vote_count=counts.get(o.id, 0)) for o in post.options
        ]
        if viewer:
            mine = (
                db.query(CommunityPollVote)
                .filter(CommunityPollVote.post_id == post.id, CommunityPollVote.user_id == viewer.id)
                .first()
            )
            my_option_id = mine.option_id if mine else None

    return CommunityPostRow(
        id=post.id,
        kind=post.kind.value,
        title=post.title,
        excerpt=_excerpt(post.body),
        author_display=_author_display(post.author, post.is_anonymous, viewer),
        is_anonymous=post.is_anonymous,
        created_at=post.created_at,
        is_hidden=post.is_hidden,
        comment_count=comment_count,
        score=score,
        my_vote=my_vote,
        options=options_out,
        my_option_id=my_option_id,
        link=link,
        attachments=post.attachments,
    )


def shape_comment(db: Session, comment: CommunityComment, viewer: User | None) -> CommunityCommentRow:
    score = (
        db.query(func.coalesce(func.sum(CommunityCommentVote.value), 0))
        .filter(CommunityCommentVote.comment_id == comment.id)
        .scalar()
    )
    my_vote = None
    if viewer:
        mine = (
            db.query(CommunityCommentVote)
            .filter(CommunityCommentVote.comment_id == comment.id, CommunityCommentVote.user_id == viewer.id)
            .first()
        )
        my_vote = mine.value if mine else None

    return CommunityCommentRow(
        id=comment.id,
        author_display=_author_display(comment.author, comment.is_anonymous, viewer),
        is_anonymous=comment.is_anonymous,
        body=comment.body,
        attachments=comment.attachments,
        created_at=comment.created_at,
        is_hidden=comment.is_hidden,
        score=score,
        my_vote=my_vote,
    )


def _require_not_hidden(post: CommunityPost) -> None:
    if post.is_hidden:
        raise CommunityError("This post has been removed")


def vote(db: Session, user: User, post: CommunityPost, value: int) -> None:
    if post.kind is not CommunityPostKind.question:
        raise CommunityError("Only questions can be upvoted/downvoted")
    if value not in (1, -1):
        raise CommunityError("value must be 1 or -1")
    _require_not_hidden(post)

    existing = db.query(CommunityVote).filter(CommunityVote.post_id == post.id, CommunityVote.user_id == user.id).first()
    if existing and existing.value == value:
        db.delete(existing)  # casting the same vote again toggles it off
    elif existing:
        existing.value = value
    else:
        db.add(CommunityVote(post_id=post.id, user_id=user.id, value=value))
    db.commit()


def poll_vote(db: Session, user: User, post: CommunityPost, option_id: uuid.UUID) -> None:
    if post.kind is not CommunityPostKind.poll:
        raise CommunityError("Only polls can be voted on this way")
    _require_not_hidden(post)
    if not any(o.id == option_id for o in post.options):
        raise CommunityError("That option doesn't belong to this poll")

    existing = (
        db.query(CommunityPollVote).filter(CommunityPollVote.post_id == post.id, CommunityPollVote.user_id == user.id).first()
    )
    if existing:
        existing.option_id = option_id
    else:
        db.add(CommunityPollVote(post_id=post.id, option_id=option_id, user_id=user.id))
    db.commit()


def add_comment(
    db: Session, user: User, post: CommunityPost, body: str, is_anonymous: bool, attachments: list[str]
) -> CommunityComment:
    _require_not_hidden(post)
    _validate_attachments(attachments)
    comment = CommunityComment(post_id=post.id, author_id=user.id, is_anonymous=is_anonymous, body=body, attachments=attachments)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


def vote_comment(db: Session, user: User, comment: CommunityComment, value: int) -> None:
    if value not in (1, -1):
        raise CommunityError("value must be 1 or -1")
    if comment.is_hidden:
        raise CommunityError("This comment has been removed")

    existing = (
        db.query(CommunityCommentVote)
        .filter(CommunityCommentVote.comment_id == comment.id, CommunityCommentVote.user_id == user.id)
        .first()
    )
    if existing and existing.value == value:
        db.delete(existing)  # casting the same vote again toggles it off
    elif existing:
        existing.value = value
    else:
        db.add(CommunityCommentVote(comment_id=comment.id, user_id=user.id, value=value))
    db.commit()


def hide_post(db: Session, staff: User, post: CommunityPost, reason: str | None) -> None:
    post.is_hidden = True
    post.hidden_reason = reason
    audit.log(db, staff, "community", f'Hid post "{post.title}" by {post.author.email}')
    db.commit()


def unhide_post(db: Session, staff: User, post: CommunityPost) -> None:
    post.is_hidden = False
    post.hidden_reason = None
    audit.log(db, staff, "community", f'Unhid post "{post.title}" by {post.author.email}')
    db.commit()


def get_comment(db: Session, comment_id: uuid.UUID) -> CommunityComment | None:
    return db.get(CommunityComment, comment_id)


def get_comment_visible(db: Session, viewer: User | None, comment_id: uuid.UUID) -> CommunityComment | None:
    """Like get_comment, but 404s (via a None return) a comment that's hidden
    — or whose parent post is hidden — from anyone who isn't staff/admin,
    same visibility rule as _base_query for posts."""
    comment = db.get(CommunityComment, comment_id)
    if not comment:
        return None
    if viewer and (viewer.is_admin or viewer.is_staff):
        return comment
    if comment.is_hidden:
        return None
    post_hidden = db.query(CommunityPost.is_hidden).filter(CommunityPost.id == comment.post_id).scalar()
    return None if post_hidden else comment


def hide_comment(db: Session, staff: User, comment: CommunityComment, reason: str | None) -> None:
    comment.is_hidden = True
    comment.hidden_reason = reason
    audit.log(db, staff, "community", f"Hid comment by {comment.author.email}")
    db.commit()


def unhide_comment(db: Session, staff: User, comment: CommunityComment) -> None:
    comment.is_hidden = False
    comment.hidden_reason = None
    audit.log(db, staff, "community", f"Unhid comment by {comment.author.email}")
    db.commit()
