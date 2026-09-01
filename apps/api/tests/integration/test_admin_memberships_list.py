import pytest

from app.models.membership import MembershipStatus

pytestmark = pytest.mark.integration


def test_memberships_list_includes_goals_and_experience_level(client, db_session, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    member = make_user(email="builder@example.com", membership_status=MembershipStatus.active)
    member.profile.goals = ["Build projects", "Meet other developers"]
    member.profile.experience_level = "independent"
    db_session.commit()
    login_as(admin)

    res = client.get("/admin/memberships", params={"status_filter": "all"})
    assert res.status_code == 200
    row = next(r for r in res.json() if r["user_id"] == str(member.id))
    assert row["goals"] == ["Build projects", "Meet other developers"]
    assert row["experience_level"] == "independent"


def test_memberships_list_defaults_goals_and_experience_when_unset(client, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    member = make_user(email="fresh@example.com", membership_status=MembershipStatus.active)
    login_as(admin)

    res = client.get("/admin/memberships", params={"status_filter": "all"})
    assert res.status_code == 200
    row = next(r for r in res.json() if r["user_id"] == str(member.id))
    assert row["goals"] == []
    assert row["experience_level"] is None
