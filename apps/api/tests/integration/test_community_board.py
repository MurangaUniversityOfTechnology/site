import pytest

from app.core.config import get_settings
from app.services import link_preview

pytestmark = pytest.mark.integration


# Built from whatever cloud name is actually configured (real or blank),
# same as _validate_attachments does — not a hardcoded stand-in, since the
# test .env carries live Cloudinary credentials other tests rely on.
VALID_ATTACHMENT = f"https://res.cloudinary.com/{get_settings().cloudinary_cloud_name}/image/upload/v1/mut-tech/community/photo.jpg"


def _make_question(client, title="Is Rust worth learning?", body=None, is_anonymous=False, attachments=()):
    res = client.post(
        "/community/posts",
        json={
            "kind": "question",
            "title": title,
            "body": body,
            "is_anonymous": is_anonymous,
            "options": [],
            "attachments": list(attachments),
        },
    )
    assert res.status_code == 201, res.text
    return res.json()


def _make_poll(client, options=("Rust", "Go"), is_anonymous=False):
    res = client.post(
        "/community/posts",
        json={"kind": "poll", "title": "Rust or Go?", "body": None, "is_anonymous": is_anonymous, "options": list(options)},
    )
    assert res.status_code == 201, res.text
    return res.json()


def test_any_signed_in_account_can_post(client, make_user, login_as):
    user = make_user()
    login_as(user)
    post = _make_question(client)
    assert post["kind"] == "question"
    assert post["author_display"] == user.email


def test_signed_out_cannot_post(client):
    res = client.post(
        "/community/posts", json={"kind": "question", "title": "x", "body": None, "is_anonymous": False, "options": []}
    )
    assert res.status_code == 401


def test_signed_out_can_browse(client, make_user, login_as):
    author = make_user()
    login_as(author)
    _make_question(client)

    client.post("/auth/logout")
    res = client.get("/community/posts")
    assert res.status_code == 200
    assert len(res.json()) == 1


def test_upvote_downvote_and_toggle_off(client, make_user, login_as):
    author = make_user()
    login_as(author)
    post = _make_question(client)

    voter = make_user()
    login_as(voter)
    res = client.post(f"/community/posts/{post['id']}/vote", json={"value": 1})
    assert res.status_code == 200
    assert res.json()["score"] == 1
    assert res.json()["my_vote"] == 1

    # Casting the same vote again toggles it off.
    res = client.post(f"/community/posts/{post['id']}/vote", json={"value": 1})
    assert res.json()["score"] == 0
    assert res.json()["my_vote"] is None

    # Switching to the opposite vote replaces it, not adds to it.
    client.post(f"/community/posts/{post['id']}/vote", json={"value": 1})
    res = client.post(f"/community/posts/{post['id']}/vote", json={"value": -1})
    assert res.json()["score"] == -1


def test_poll_vote_and_revote(client, make_user, login_as):
    author = make_user()
    login_as(author)
    poll = _make_poll(client)
    option_ids = [o["id"] for o in poll["options"]]

    voter = make_user()
    login_as(voter)
    res = client.post(f"/community/posts/{poll['id']}/poll-vote", json={"option_id": option_ids[0]})
    assert res.status_code == 200
    counts = {o["id"]: o["vote_count"] for o in res.json()["options"]}
    assert counts[option_ids[0]] == 1
    assert counts[option_ids[1]] == 0

    # Re-voting moves the vote rather than adding a second one.
    res = client.post(f"/community/posts/{poll['id']}/poll-vote", json={"option_id": option_ids[1]})
    counts = {o["id"]: o["vote_count"] for o in res.json()["options"]}
    assert counts[option_ids[0]] == 0
    assert counts[option_ids[1]] == 1


def test_cannot_poll_vote_on_a_question(client, make_user, login_as):
    author = make_user()
    login_as(author)
    post = _make_question(client)
    res = client.post(f"/community/posts/{post['id']}/poll-vote", json={"option_id": post["id"]})
    assert res.status_code == 400


def test_comment_flow(client, make_user, login_as):
    author = make_user()
    login_as(author)
    post = _make_question(client)

    commenter = make_user()
    login_as(commenter)
    res = client.post(f"/community/posts/{post['id']}/comments", json={"body": "Good question!", "is_anonymous": False})
    assert res.status_code == 201
    detail = res.json()
    assert detail["comment_count"] == 1
    assert detail["comments"][0]["body"] == "Good question!"
    assert detail["comments"][0]["author_display"] == commenter.email


def test_anonymous_hides_author_from_regular_viewer_but_not_staff(client, make_user, login_as):
    author = make_user()
    login_as(author)
    post = _make_question(client, is_anonymous=True)
    assert post["author_display"] == "Anonymous"

    viewer = make_user()
    login_as(viewer)
    res = client.get(f"/community/posts/{post['id']}")
    assert res.json()["author_display"] == "Anonymous"

    staff = make_user(is_staff=True)
    login_as(staff)
    res = client.get(f"/community/posts/{post['id']}")
    assert res.json()["author_display"] == author.email


def test_anonymous_staff_author_sees_their_own_post_as_anonymous_too(client, make_user, login_as):
    staff_author = make_user(is_staff=True)
    login_as(staff_author)
    post = _make_question(client, is_anonymous=True)
    assert post["author_display"] == "Anonymous"

    res = client.get(f"/community/posts/{post['id']}")
    assert res.json()["author_display"] == "Anonymous"


def test_hidden_post_rejects_new_votes_and_comments(client, make_user, login_as):
    author = make_user()
    login_as(author)
    post = _make_question(client)

    staff = make_user(is_staff=True)
    login_as(staff)
    res = client.post(f"/community/posts/{post['id']}/hide", json={"reason": "spam"})
    assert res.status_code == 200

    voter = make_user()
    login_as(voter)
    res = client.post(f"/community/posts/{post['id']}/vote", json={"value": 1})
    assert res.status_code == 404  # hidden posts 404 for non-staff, same as a nonexistent post

    # A staff/admin viewer can still see the hidden post (to review/unhide
    # it), but voting on it is still rejected.
    login_as(staff)
    res = client.post(f"/community/posts/{post['id']}/vote", json={"value": 1})
    assert res.status_code == 400


def test_staff_can_hide_and_unhide_and_it_is_audited(client, make_user, login_as):
    author = make_user()
    login_as(author)
    post = _make_question(client)

    staff = make_user(is_staff=True)
    login_as(staff)
    res = client.post(f"/community/posts/{post['id']}/hide", json={"reason": "spam"})
    assert res.status_code == 200

    # Hidden posts disappear from the public list.
    other = make_user()
    login_as(other)
    res = client.get("/community/posts")
    assert res.json() == []

    # ...but staff still see it, marked hidden.
    login_as(staff)
    res = client.get("/community/posts")
    assert len(res.json()) == 1
    assert res.json()[0]["is_hidden"] is True

    res = client.post(f"/community/posts/{post['id']}/unhide")
    assert res.status_code == 200
    login_as(other)
    res = client.get("/community/posts")
    assert len(res.json()) == 1


def test_non_staff_cannot_hide(client, make_user, login_as):
    author = make_user()
    login_as(author)
    post = _make_question(client)

    other = make_user()
    login_as(other)
    res = client.post(f"/community/posts/{post['id']}/hide", json={"reason": "spam"})
    assert res.status_code == 403


def test_hide_is_logged_to_audit(client, make_user, login_as, db_session):
    from app.models.audit_log import AuditLog

    author = make_user()
    login_as(author)
    post = _make_question(client)

    staff = make_user(is_staff=True)
    login_as(staff)
    client.post(f"/community/posts/{post['id']}/hide", json={"reason": "spam"})

    entries = db_session.query(AuditLog).filter(AuditLog.kind == "community").all()
    assert len(entries) == 1
    assert "Hid post" in entries[0].action


def test_link_preview_attached_on_create(client, make_user, login_as, monkeypatch):
    monkeypatch.setattr(
        link_preview,
        "fetch_preview",
        lambda url: link_preview.LinkPreview(
            url=url, title="Example Site", description="A description", image_url="https://example.com/og.png", site_name="Example"
        ),
    )
    user = make_user()
    login_as(user)
    post = _make_question(client, body="Check this out: https://example.com/article")
    assert post["link"]["title"] == "Example Site"
    assert post["link"]["url"] == "https://example.com/article"


def test_link_preview_failure_does_not_block_post_creation(client, make_user, login_as, monkeypatch):
    monkeypatch.setattr(link_preview, "fetch_preview", lambda url: None)
    user = make_user()
    login_as(user)
    post = _make_question(client, body="See https://example.com")
    assert post["link"] is None


@pytest.mark.parametrize(
    "url",
    [
        "http://localhost:8000/admin",
        "http://127.0.0.1/",
        "http://169.254.169.254/latest/meta-data/",
        "http://10.0.0.1/",
        "ftp://example.com/",
    ],
)
def test_link_preview_refuses_unsafe_hosts(url):
    assert link_preview.fetch_preview(url) is None


def test_post_accepts_a_real_attachment_url(client, make_user, login_as):
    user = make_user()
    login_as(user)
    post = _make_question(client, attachments=[VALID_ATTACHMENT])
    assert post["attachments"] == [VALID_ATTACHMENT]


def test_post_rejects_a_hotlinked_attachment(client, make_user, login_as):
    user = make_user()
    login_as(user)
    res = client.post(
        "/community/posts",
        json={
            "kind": "question",
            "title": "x",
            "body": None,
            "is_anonymous": False,
            "options": [],
            "attachments": ["https://evil.example.com/not-ours.png"],
        },
    )
    assert res.status_code == 400


def test_post_attachment_count_is_capped(client, make_user, login_as):
    user = make_user()
    login_as(user)
    res = client.post(
        "/community/posts",
        json={
            "kind": "question",
            "title": "x",
            "body": None,
            "is_anonymous": False,
            "options": [],
            "attachments": [VALID_ATTACHMENT] * 5,
        },
    )
    assert res.status_code == 422


def test_comment_attachment_count_is_capped(client, make_user, login_as):
    user = make_user()
    login_as(user)
    post = _make_question(client)
    res = client.post(
        f"/community/posts/{post['id']}/comments",
        json={"body": "x", "is_anonymous": False, "attachments": [VALID_ATTACHMENT] * 3},
    )
    assert res.status_code == 422


def test_comment_with_attachment(client, make_user, login_as):
    author = make_user()
    login_as(author)
    post = _make_question(client)
    res = client.post(
        f"/community/posts/{post['id']}/comments",
        json={"body": "here's a screenshot", "is_anonymous": False, "attachments": [VALID_ATTACHMENT]},
    )
    assert res.status_code == 201
    assert res.json()["comments"][0]["attachments"] == [VALID_ATTACHMENT]


def test_comment_upvote_downvote_and_toggle_off(client, make_user, login_as):
    author = make_user()
    login_as(author)
    post = _make_question(client)
    comment = client.post(
        f"/community/posts/{post['id']}/comments", json={"body": "hi", "is_anonymous": False, "attachments": []}
    ).json()["comments"][0]

    voter = make_user()
    login_as(voter)
    res = client.post(f"/community/comments/{comment['id']}/vote", json={"value": 1})
    assert res.status_code == 200
    assert res.json()["score"] == 1
    assert res.json()["my_vote"] == 1

    res = client.post(f"/community/comments/{comment['id']}/vote", json={"value": 1})
    assert res.json()["score"] == 0
    assert res.json()["my_vote"] is None

    client.post(f"/community/comments/{comment['id']}/vote", json={"value": 1})
    res = client.post(f"/community/comments/{comment['id']}/vote", json={"value": -1})
    assert res.json()["score"] == -1


def test_cannot_vote_on_a_hidden_comment(client, make_user, login_as):
    author = make_user()
    login_as(author)
    post = _make_question(client)
    comment = client.post(
        f"/community/posts/{post['id']}/comments", json={"body": "hi", "is_anonymous": False, "attachments": []}
    ).json()["comments"][0]

    staff = make_user(is_staff=True)
    login_as(staff)
    res = client.post(f"/community/comments/{comment['id']}/hide", json={"reason": "spam"})
    assert res.status_code == 200

    voter = make_user()
    login_as(voter)
    res = client.post(f"/community/comments/{comment['id']}/vote", json={"value": 1})
    assert res.status_code == 404  # hidden from non-staff entirely

    login_as(staff)
    res = client.post(f"/community/comments/{comment['id']}/vote", json={"value": 1})
    assert res.status_code == 400  # staff can see it, but voting is still rejected


def test_upload_requires_sign_in(client):
    res = client.post("/community/uploads", files={"file": ("x.jpg", b"fake-bytes", "image/jpeg")})
    assert res.status_code == 401


def test_upload_rejects_disallowed_content_type(client, make_user, login_as):
    user = make_user()
    login_as(user)
    res = client.post("/community/uploads", files={"file": ("x.exe", b"fake-bytes", "application/x-msdownload")})
    assert res.status_code == 400


def test_upload_success(client, make_user, login_as, monkeypatch):
    from app.services import uploads as uploads_service

    monkeypatch.setattr(uploads_service, "upload_file", lambda *a, **kw: VALID_ATTACHMENT)
    user = make_user()
    login_as(user)
    res = client.post("/community/uploads", files={"file": ("x.jpg", b"fake-bytes", "image/jpeg")})
    assert res.status_code == 200
    assert res.json()["url"] == VALID_ATTACHMENT
