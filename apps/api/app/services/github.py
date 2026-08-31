import logging
from datetime import UTC, datetime

import httpx
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.project import Project
from app.models.user import GithubOrgInviteStatus, User
from app.services import notification

settings = get_settings()
logger = logging.getLogger(__name__)

API_BASE = "https://api.github.com"
INVITE_EXPIRY_DAYS = 7


class GithubError(Exception):
    pass


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.github_sync_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def _log_failure(action: str, exc: httpx.HTTPError) -> None:
    # These calls fail silently by design (rate limits shouldn't error the
    # request), but silent shouldn't mean invisible — this is exactly the gap
    # that hid a 403 permission error for a while during development.
    if isinstance(exc, httpx.HTTPStatusError):
        logger.warning("%s: GitHub API returned %s — %s", action, exc.response.status_code, exc.response.text[:300])
    else:
        logger.warning("%s: GitHub API request failed — %s", action, exc)


def sync_project(db: Session, project: Project) -> None:
    """Refreshes repo metadata + good-first-issue cache from GitHub. Leaves
    synced_at (and all cached data) untouched on failure — a rate limit or
    outage should degrade to "showing the last sync", never to an error."""
    try:
        with httpx.Client(timeout=15, headers=_headers()) as client:
            repo_res = client.get(f"{API_BASE}/repos/{project.repo_owner}/{project.repo_name}")
            repo_res.raise_for_status()
            repo = repo_res.json()

            issues_res = client.get(
                f"{API_BASE}/repos/{project.repo_owner}/{project.repo_name}/issues",
                params={"state": "open", "labels": "good first issue", "per_page": 20},
            )
            issues_res.raise_for_status()
            issues = [i for i in issues_res.json() if "pull_request" not in i]
    except httpx.HTTPError as exc:
        _log_failure(f"sync_project({project.slug})", exc)
        return

    project.description = repo.get("description")
    project.language = repo.get("language")
    project.topics = repo.get("topics") or []
    project.stars = repo.get("stargazers_count", 0)
    project.open_issues_count = repo.get("open_issues_count", 0)
    project.cached_issues = [
        {
            "id": i["number"],
            "title": i["title"],
            "url": i["html_url"],
            "labels": [label["name"] for label in i.get("labels", [])],
            "created_at": i["created_at"],
        }
        for i in issues
    ]
    project.synced_at = datetime.now(UTC)
    db.commit()


def sync_all_projects(db: Session) -> None:
    for project in db.query(Project).all():
        sync_project(db, project)


def maybe_invite_to_org(db: Session, user: User) -> None:
    """Fires the moment both conditions are true: membership is active and
    GitHub is linked. Idempotent — a no-op once already invited/accepted, so
    it's safe to call from both the membership-approval path and the GitHub
    OAuth callback without tracking which one happened first."""
    if not settings.github_org or not settings.github_sync_token:
        return
    if not user.github_id or not user.membership or user.membership.status.value != "active":
        return
    if user.github_org_invite_status != GithubOrgInviteStatus.none:
        return

    try:
        res = httpx.post(
            f"{API_BASE}/orgs/{settings.github_org}/invitations",
            headers=_headers(),
            json={"invitee_id": user.github_id, "role": "direct_member"},
            timeout=15,
        )
        res.raise_for_status()
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 422 and "already a part of this organization" in exc.response.text:
            refresh_invite_status(db, user)
            return
        _log_failure(f"maybe_invite_to_org({user.email})", exc)
        return
    except httpx.HTTPError as exc:
        _log_failure(f"maybe_invite_to_org({user.email})", exc)
        return

    user.github_org_invite_status = GithubOrgInviteStatus.invited
    user.github_org_invited_at = datetime.now(UTC)
    db.commit()
    notification.notify(
        db,
        user,
        "github",
        "Check your GitHub email",
        f"An invitation to {settings.github_org} is waiting. Accept it and you can push to club repos.",
    )
    db.commit()


def refresh_invite_status(db: Session, user: User) -> None:
    """Re-checks GitHub's own membership/invitation state for one linked
    user — used by the admin roster screen's per-row refresh and to flip
    invited -> expired after 7 days without silently believing our own
    stale copy forever."""
    if not user.github_login or not settings.github_org:
        return

    try:
        res = httpx.get(
            f"{API_BASE}/orgs/{settings.github_org}/memberships/{user.github_login}",
            headers=_headers(),
            timeout=15,
        )
    except httpx.HTTPError as exc:
        _log_failure(f"refresh_invite_status({user.email})", exc)
        return

    if res.status_code == 200:
        state = res.json().get("state")
        if state == "active":
            user.github_org_invite_status = GithubOrgInviteStatus.accepted
            db.commit()
        elif state == "pending":
            user.github_org_invite_status = GithubOrgInviteStatus.invited
            db.commit()
    elif res.status_code == 404:
        if (
            user.github_org_invite_status == GithubOrgInviteStatus.invited
            and user.github_org_invited_at
            and (datetime.now(UTC) - user.github_org_invited_at).days >= INVITE_EXPIRY_DAYS
        ):
            user.github_org_invite_status = GithubOrgInviteStatus.expired
            db.commit()


def resend_invite(db: Session, user: User) -> None:
    if not user.github_id:
        raise GithubError(f"{user.email} hasn't linked GitHub yet")
    user.github_org_invite_status = GithubOrgInviteStatus.none
    db.commit()
    maybe_invite_to_org(db, user)
