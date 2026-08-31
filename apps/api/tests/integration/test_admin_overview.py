from datetime import date, timedelta

import pytest

from app.models.membership import MembershipStatus

pytestmark = pytest.mark.integration


def test_new_this_week_counts_recently_activated_members_not_raw_signups(
    client, db_session, make_user, login_as
):
    admin = make_user(is_admin=True)
    login_as(admin)

    # Active membership activated today — should count as new this week.
    make_user(membership_status=MembershipStatus.active)

    # Active membership activated a month ago — a member, but not "new".
    old_member = make_user(membership_status=MembershipStatus.active)
    old_member.membership.period_start = date.today() - timedelta(days=30)  # noqa: DTZ011
    db_session.commit()

    # Signed up today but never became a member — must not inflate the count.
    make_user(membership_status=MembershipStatus.none)

    res = client.get("/admin/overview")
    assert res.status_code == 200
    body = res.json()
    assert body["total_members"] == 2
    assert body["new_this_week"] == 1
