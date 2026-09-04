import pytest

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


def _add_short_text_field(db_session, admin, form, *, required=True):
    return forms_service.create_field(
        db_session,
        admin,
        form,
        {"type": "short_text", "prompt": "Your name?", "help_text": None, "required": required, "choices": []},
    )


def test_unpublished_form_404s(client, make_form):
    form, _admin = make_form()
    res = client.get(f"/forms/{form.slug}")
    assert res.status_code == 404


def test_get_published_form(client, db_session, make_form):
    form, admin = make_form()
    _add_short_text_field(db_session, admin, form)
    forms_service.publish_form(db_session, admin, form)

    res = client.get(f"/forms/{form.slug}")
    assert res.status_code == 200
    body = res.json()
    assert body["title"] == form.title
    assert body["closed"] is False
    assert len(body["fields"]) == 1


def test_submit_requires_login_when_form_demands_it(client, db_session, make_form):
    form, admin = make_form(require_login=True)
    field = _add_short_text_field(db_session, admin, form, required=False)
    forms_service.publish_form(db_session, admin, form)

    res = client.post(f"/forms/{form.slug}/responses", json={"answers": [{"field_id": str(field.id), "value": "hi"}]})
    assert res.status_code == 401


def test_submit_allows_anonymous_when_form_allows_it(client, db_session, make_form):
    form, admin = make_form(require_login=False)
    field = _add_short_text_field(db_session, admin, form, required=False)
    forms_service.publish_form(db_session, admin, form)

    res = client.post(f"/forms/{form.slug}/responses", json={"answers": [{"field_id": str(field.id), "value": "hi"}]})
    assert res.status_code == 204


def test_submit_requires_required_fields(client, db_session, make_form):
    form, admin = make_form(require_login=False)
    _add_short_text_field(db_session, admin, form, required=True)
    forms_service.publish_form(db_session, admin, form)

    res = client.post(f"/forms/{form.slug}/responses", json={"answers": []})
    assert res.status_code == 400


def test_signed_in_member_cant_submit_twice(client, make_user, login_as, db_session, make_form):
    form, admin = make_form(require_login=True)
    field = _add_short_text_field(db_session, admin, form, required=False)
    forms_service.publish_form(db_session, admin, form)

    member = make_user()
    login_as(member)
    payload = {"answers": [{"field_id": str(field.id), "value": "hi"}]}
    first = client.post(f"/forms/{form.slug}/responses", json=payload)
    assert first.status_code == 204
    second = client.post(f"/forms/{form.slug}/responses", json=payload)
    assert second.status_code == 400


def test_submit_rejects_unknown_choice_id(client, db_session, make_form):
    form, admin = make_form(require_login=False)
    field = forms_service.create_field(
        db_session,
        admin,
        form,
        {
            "type": "single_choice",
            "prompt": "Pick one",
            "help_text": None,
            "required": True,
            "choices": [{"id": "a", "text": "A"}, {"id": "b", "text": "B"}],
        },
    )
    forms_service.publish_form(db_session, admin, form)

    res = client.post(f"/forms/{form.slug}/responses", json={"answers": [{"field_id": str(field.id), "value": ["z"]}]})
    assert res.status_code == 400


def test_submit_rejects_when_closed(client, db_session, make_form):
    from datetime import UTC, datetime, timedelta

    form, admin = make_form(require_login=False)
    field = _add_short_text_field(db_session, admin, form, required=False)
    forms_service.publish_form(db_session, admin, form)
    forms_service.update_form(db_session, admin, form, {"closes_at": datetime.now(UTC) - timedelta(minutes=1)})

    res = client.post(f"/forms/{form.slug}/responses", json={"answers": [{"field_id": str(field.id), "value": "hi"}]})
    assert res.status_code == 400

    get_res = client.get(f"/forms/{form.slug}")
    assert get_res.status_code == 200
    assert get_res.json()["closed"] is True
