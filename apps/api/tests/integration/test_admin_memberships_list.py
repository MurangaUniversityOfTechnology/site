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


def test_memberships_list_expired_filter_returns_only_expired(client, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    lapsed = make_user(email="lapsed@example.com", membership_status=MembershipStatus.expired)
    login_as(admin)

    res = client.get("/admin/memberships", params={"status_filter": "expired"})
    assert res.status_code == 200
    user_ids = {r["user_id"] for r in res.json()}
    assert user_ids == {str(lapsed.id)}


def test_memberships_list_search_matches_name_email_and_reg_number(client, db_session, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    ann = make_user(email="ann@example.com", membership_status=MembershipStatus.active)
    ann.profile.first_name = "Ann"
    ann.profile.last_name = "Wanjiru"
    ann.profile.registration_number = "SCT211-0042/2022"
    make_user(email="bob@example.com", membership_status=MembershipStatus.active)
    db_session.commit()
    login_as(admin)

    for term in ("wanjiru", "ann w", "ann@exam", "0042"):
        res = client.get("/admin/memberships", params={"status_filter": "all", "q": term})
        assert {r["user_id"] for r in res.json()} == {str(ann.id)}, term


def test_memberships_inactive_filter_returns_never_paid(client, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    fresh = make_user(email="new@example.com", membership_status=MembershipStatus.none)
    make_user(email="paid@example.com", membership_status=MembershipStatus.active)
    login_as(admin)

    res = client.get("/admin/memberships", params={"status_filter": "inactive"})
    assert {r["user_id"] for r in res.json()} == {str(fresh.id)}


def test_admin_can_set_membership_status(client, db_session, make_user, login_as):
    admin = make_user(is_admin=True, membership_status=MembershipStatus.active)
    member = make_user(email="cash@example.com", membership_status=MembershipStatus.none)
    login_as(admin)

    res = client.post(f"/admin/users/{member.id}/membership-status", json={"status": "active", "reason": "Paid cash"})
    assert res.status_code == 204
    db_session.refresh(member.membership)
    assert member.membership.status == MembershipStatus.active
    assert member.membership.period_end is not None

    res = client.post(f"/admin/users/{member.id}/membership-status", json={"status": "expired", "reason": "Lapsed"})
    assert res.status_code == 204
    db_session.refresh(member.membership)
    assert member.membership.status == MembershipStatus.expired

    res = client.post(f"/admin/users/{member.id}/membership-status", json={"status": "expired", "reason": "again"})
    assert res.status_code == 400
