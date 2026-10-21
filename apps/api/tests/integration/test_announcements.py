from datetime import UTC, datetime, timedelta

import pytest

from app.models.audit_log import AuditLog
from app.models.membership import MembershipStatus

pytestmark = pytest.mark.integration


def _iso(delta: timedelta) -> str:
    return (datetime.now(UTC) + delta).isoformat()


def _make(client, **overrides):
    payload = {
        "title": "We need a graphic designer",
        "body": "Got an eye for design? Join the team.",
        "cta_label": "Apply",
        "cta_url": "/forms/designer",
        **overrides,
    }
    res = client.post("/admin/announcements", json=payload)
    assert res.status_code == 201, res.text
    return res.json()


@pytest.fixture
def admin(make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    login_as(admin)
    return admin


def test_admin_routes_reject_non_staff(client, make_user, login_as):
    login_as(make_user(membership_status=MembershipStatus.active))
    assert client.get("/admin/announcements").status_code == 403
    assert client.post("/admin/announcements", json={"title": "x"}).status_code == 403


def test_public_list_needs_no_login_and_only_shows_live(client, admin):
    live = _make(client)
    _make(client, title="Switched off", is_active=False)
    _make(client, title="Not yet", starts_at=_iso(timedelta(days=1)))
    _make(client, title="Over", starts_at=_iso(timedelta(days=-3)), ends_at=_iso(timedelta(days=-1)))

    client.cookies.clear()
    res = client.get("/announcements")
    assert res.status_code == 200
    assert [a["id"] for a in res.json()] == [live["id"]]
    assert "is_active" not in res.json()[0]


def test_admin_row_reports_state(client, admin):
    assert _make(client)["state"] == "live"
    assert _make(client, is_active=False)["state"] == "off"
    assert _make(client, starts_at=_iso(timedelta(days=1)))["state"] == "scheduled"
    assert _make(client, starts_at=_iso(timedelta(days=-3)), ends_at=_iso(timedelta(days=-1)))["state"] == "ended"


def test_update_and_delete(client, admin, db_session):
    created = _make(client)
    res = client.put(
        f"/admin/announcements/{created['id']}",
        json={"title": "Designer found!", "is_active": False},
    )
    assert res.status_code == 200
    assert res.json()["title"] == "Designer found!"
    assert res.json()["cta_url"] is None
    assert res.json()["state"] == "off"

    assert client.delete(f"/admin/announcements/{created['id']}").status_code == 204
    assert client.put(f"/admin/announcements/{created['id']}", json={"title": "x"}).status_code == 404
    assert client.get("/admin/announcements").json() == []
    kinds = [a.kind for a in db_session.query(AuditLog).all()]
    assert kinds.count("announcement") == 3


@pytest.mark.parametrize(
    "overrides",
    [
        {"cta_url": "javascript:alert(1)"},
        {"cta_url": "//evil.example"},
        {"cta_label": None},  # link without a label
        {"cta_label": "Apply", "cta_url": None},  # label without a link
        {"starts_at": _iso(timedelta(days=2)), "ends_at": _iso(timedelta(days=1))},
        {"title": ""},
    ],
)
def test_rejects_invalid_payloads(client, admin, overrides):
    res = client.post("/admin/announcements", json={"title": "ok", "cta_label": "Go", "cta_url": "/x", **overrides})
    assert res.status_code == 422


def test_external_link_allowed(client, admin):
    assert _make(client, cta_url="https://example.com/apply")["cta_url"] == "https://example.com/apply"
