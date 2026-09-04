import pytest

from app.schemas.form import AnswerItem
from app.services import forms as forms_service

pytestmark = pytest.mark.integration


@pytest.fixture
def make_form(db_session, make_user):
    counter = {"n": 0}

    def _make(*, require_login=True, admin=None):
        counter["n"] += 1
        admin = admin or make_user(is_admin=True, email=f"form-admin-{counter['n']}@example.com")
        form = forms_service.create_form(
            db_session,
            admin,
            {
                "slug": f"form-{counter['n']}",
                "title": f"Form {counter['n']}",
                "description": "",
                "require_login": require_login,
                "closes_at": None,
            },
        )
        return form, admin

    return _make


def _add_choice_field(db_session, admin, form, *, required=True):
    return forms_service.create_field(
        db_session,
        admin,
        form,
        {
            "type": "single_choice",
            "prompt": "Favorite language?",
            "help_text": None,
            "required": required,
            "choices": [{"id": "a", "text": "Python"}, {"id": "b", "text": "Rust"}],
        },
    )


# ── admin CRUD over HTTP ─────────────────────────────────────────────────


def test_create_form_requires_admin(client, make_user, login_as):
    user = make_user()
    login_as(user)
    res = client.post("/admin/forms", json={"slug": "x", "title": "X"})
    assert res.status_code == 403


def test_create_form(client, make_user, login_as):
    admin = make_user(is_admin=True)
    login_as(admin)
    res = client.post("/admin/forms", json={"slug": "feedback", "title": "Feedback", "require_login": False})
    assert res.status_code == 201
    body = res.json()
    assert body["slug"] == "feedback"
    assert body["published_at"] is None
    assert body["require_login"] is False


def test_create_form_rejects_duplicate_slug(client, login_as, make_form):
    form, admin = make_form()
    login_as(admin)
    res = client.post("/admin/forms", json={"slug": form.slug, "title": "Dupe"})
    assert res.status_code == 400


def test_update_form(client, login_as, make_form):
    form, admin = make_form()
    login_as(admin)
    res = client.patch(f"/admin/forms/{form.slug}", json={"title": "Renamed"})
    assert res.status_code == 200
    assert res.json()["title"] == "Renamed"


# ── fields ───────────────────────────────────────────────────────────────


def test_create_field(client, login_as, make_form):
    form, admin = make_form()
    login_as(admin)
    res = client.post(
        f"/admin/forms/{form.slug}/fields",
        json={"type": "short_text", "prompt": "Your name?", "required": True, "choices": []},
    )
    assert res.status_code == 201
    assert res.json()["position"] == 1


def test_create_field_rejects_choices_for_non_choice_type(client, login_as, make_form):
    form, admin = make_form()
    login_as(admin)
    res = client.post(
        f"/admin/forms/{form.slug}/fields",
        json={"type": "short_text", "prompt": "Name?", "choices": [{"id": "a", "text": "x"}, {"id": "b", "text": "y"}]},
    )
    assert res.status_code == 422


def test_create_field_requires_2_to_5_choices_for_choice_type(client, login_as, make_form):
    form, admin = make_form()
    login_as(admin)
    res = client.post(
        f"/admin/forms/{form.slug}/fields",
        json={"type": "single_choice", "prompt": "Pick one", "choices": [{"id": "a", "text": "only one"}]},
    )
    assert res.status_code == 422


def test_reorder_field(db_session, make_form):
    form, admin = make_form()
    f1 = forms_service.create_field(db_session, admin, form, {"type": "short_text", "prompt": "1", "help_text": None, "required": True, "choices": []})
    f2 = forms_service.create_field(db_session, admin, form, {"type": "short_text", "prompt": "2", "help_text": None, "required": True, "choices": []})
    assert f1.position == 1
    assert f2.position == 2

    forms_service.reorder_field(db_session, admin, f2, "up")
    assert f1.position == 2
    assert f2.position == 1


def test_reorder_field_cant_move_past_the_end(db_session, make_form):
    form, admin = make_form()
    field = forms_service.create_field(db_session, admin, form, {"type": "short_text", "prompt": "1", "help_text": None, "required": True, "choices": []})
    with pytest.raises(forms_service.FormError, match="further"):
        forms_service.reorder_field(db_session, admin, field, "up")


def test_delete_field_blocked_while_published(db_session, make_form):
    form, admin = make_form()
    field = _add_choice_field(db_session, admin, form)
    forms_service.publish_form(db_session, admin, form)
    with pytest.raises(forms_service.FormError, match="Unpublish"):
        forms_service.delete_field(db_session, admin, field)


# ── publish / archive ────────────────────────────────────────────────────


def test_publish_requires_at_least_one_field(db_session, make_form):
    form, admin = make_form()
    with pytest.raises(forms_service.FormError, match="field"):
        forms_service.publish_form(db_session, admin, form)


def test_publish_succeeds_with_a_field(db_session, make_form):
    form, admin = make_form()
    _add_choice_field(db_session, admin, form)
    published = forms_service.publish_form(db_session, admin, form)
    assert published.published_at is not None


def test_archive_and_unarchive(db_session, make_form):
    form, admin = make_form()
    archived = forms_service.archive_form(db_session, admin, form)
    assert archived.archived_at is not None
    unarchived = forms_service.unarchive_form(db_session, admin, form)
    assert unarchived.archived_at is None


def test_delete_form_blocked_once_a_response_exists(db_session, make_user, make_form):
    form, admin = make_form(require_login=False)
    _add_choice_field(db_session, admin, form, required=False)
    forms_service.publish_form(db_session, admin, form)
    forms_service.submit_response(db_session, form, None, [])

    with pytest.raises(forms_service.FormError, match="response"):
        forms_service.delete_form(db_session, admin, form)


# ── responses + export ───────────────────────────────────────────────────


def test_list_responses_and_tallies(client, login_as, db_session, make_user, make_form):
    form, admin = make_form(require_login=False)
    field = _add_choice_field(db_session, admin, form, required=False)
    forms_service.publish_form(db_session, admin, form)

    member = make_user()
    forms_service.submit_response(db_session, form, member, [AnswerItem(field_id=field.id, value=["a"])])
    forms_service.submit_response(db_session, form, None, [AnswerItem(field_id=field.id, value=["b"])])

    login_as(admin)
    res = client.get(f"/admin/forms/{form.slug}/responses")
    assert res.status_code == 200
    body = res.json()
    assert len(body["responses"]) == 2
    assert body["tallies"][str(field.id)] == {"a": 1, "b": 1}
    respondents = {r["respondent"] for r in body["responses"]}
    assert "Anonymous" in respondents


def test_export_csv(client, login_as, db_session, make_form):
    form, admin = make_form(require_login=False)
    field = _add_choice_field(db_session, admin, form, required=False)
    forms_service.publish_form(db_session, admin, form)
    forms_service.submit_response(db_session, form, None, [AnswerItem(field_id=field.id, value=["a"])])

    login_as(admin)
    res = client.get(f"/admin/forms/{form.slug}/responses/export")
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/csv")
    assert "Python" in res.text
